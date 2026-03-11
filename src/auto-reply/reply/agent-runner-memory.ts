import crypto from "node:crypto";
import fs from "node:fs";
import type { OpenClawConfig } from "../../config/config.js";
import type { TemplateContext } from "../templating.js";
import type { VerboseLevel } from "../thinking.js";
import type { GetReplyOptions } from "../types.js";
import type { FollowupRun } from "./queue.js";
import { resolveAgentModelFallbacksOverride } from "../../agents/agent-scope.js";
import { runWithModelFallback } from "../../agents/model-fallback.js";
import { isCliProvider } from "../../agents/model-selection.js";
import { truncateOversizedToolResultsInSession } from "../../agents/pi-embedded-runner/tool-result-truncation.js";
import { compactEmbeddedPiSession, runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
import { resolveSandboxConfigForAgent, resolveSandboxRuntimeStatus } from "../../agents/sandbox.js";
import {
  resolveAgentIdFromSessionKey,
  resolveSessionFilePath,
  resolveSessionFilePathOptions,
  type SessionEntry,
  updateSessionStoreEntry,
} from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";
import { registerAgentRunContext } from "../../infra/agent-events.js";
import { logInfo } from "../../logger.js";
import { buildThreadingToolContext, resolveEnforceFinalTag } from "./agent-runner-utils.js";
import {
  type MemoryFlushSettings,
  resolveMemoryFlushContextWindowTokens,
  resolveMemoryFlushSettings,
  shouldRunMemoryFlush,
} from "./memory-flush.js";
import { incrementCompactionCount } from "./session-updates.js";

/**
 * Estimate totalTokens from session JSONL file size when the provider
 * (e.g. claude-max proxy) does not report usage data.
 * Rough heuristic: ~4 bytes per token in typical JSONL session content.
 */
const BYTES_PER_TOKEN_ESTIMATE = 4;

function estimateTotalTokensFromSessionFile(sessionFile?: string): number | undefined {
  if (!sessionFile) {
    return undefined;
  }
  try {
    const stat = fs.statSync(sessionFile);
    if (stat.size <= 0) {
      return undefined;
    }
    return Math.ceil(stat.size / BYTES_PER_TOKEN_ESTIMATE);
  } catch {
    return undefined;
  }
}

function resolveFlushSkipReason(
  entry:
    | Pick<
        SessionEntry,
        "totalTokens" | "totalTokensFresh" | "compactionCount" | "memoryFlushCompactionCount"
      >
    | undefined,
  settings: MemoryFlushSettings,
  ctxParams: { modelId?: string; agentCfgContextTokens?: number },
): string {
  const totalTokens = entry?.totalTokens;
  if (typeof totalTokens !== "number" || !Number.isFinite(totalTokens) || totalTokens <= 0) {
    return totalTokens === undefined ? "no-totalTokens" : `invalid-totalTokens(${totalTokens})`;
  }
  const contextWindow = resolveMemoryFlushContextWindowTokens(ctxParams);
  const threshold = Math.max(
    0,
    contextWindow - settings.reserveTokensFloor - settings.softThresholdTokens,
  );
  if (totalTokens < threshold) {
    return `under-threshold(${totalTokens}/${threshold})`;
  }
  const compactionCount = entry?.compactionCount ?? 0;
  const lastFlushAt = entry?.memoryFlushCompactionCount;
  if (typeof lastFlushAt === "number" && lastFlushAt === compactionCount) {
    return `already-flushed(compaction=${compactionCount})`;
  }
  return `unknown(${totalTokens})`;
}

export async function runMemoryFlushIfNeeded(params: {
  cfg: OpenClawConfig;
  followupRun: FollowupRun;
  sessionCtx: TemplateContext;
  opts?: GetReplyOptions;
  defaultModel: string;
  agentCfgContextTokens?: number;
  resolvedVerboseLevel: VerboseLevel;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
  isHeartbeat: boolean;
}): Promise<SessionEntry | undefined> {
  const memoryFlushSettings = resolveMemoryFlushSettings(params.cfg);
  if (!memoryFlushSettings) {
    logInfo("memory-flush: disabled in config");
    return params.sessionEntry;
  }

  const memoryFlushWritable = (() => {
    if (!params.sessionKey) {
      return true;
    }
    const runtime = resolveSandboxRuntimeStatus({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
    });
    if (!runtime.sandboxed) {
      return true;
    }
    const sandboxCfg = resolveSandboxConfigForAgent(params.cfg, runtime.agentId);
    return sandboxCfg.workspaceAccess === "rw";
  })();

  // Resolve the entry, with a file-size-based totalTokens fallback when the
  // provider (e.g. claude-max OpenAI-compat proxy) does not report usage.
  const resolvedEntry: typeof params.sessionEntry = (() => {
    const entry =
      params.sessionEntry ??
      (params.sessionKey ? params.sessionStore?.[params.sessionKey] : undefined);
    if (!entry) {
      return entry;
    }
    const hasTotalTokens =
      typeof entry.totalTokens === "number" &&
      Number.isFinite(entry.totalTokens) &&
      entry.totalTokens > 0;
    if (hasTotalTokens) {
      return entry;
    }
    const estimated = estimateTotalTokensFromSessionFile(entry.sessionFile);
    if (typeof estimated === "number" && estimated > 0) {
      logInfo(
        `memory-flush: totalTokens missing, using file-size estimate (${estimated} tokens from session file)`,
      );
      return { ...entry, totalTokens: estimated, totalTokensFresh: false };
    }
    return entry;
  })();

  const shouldFlushMemory =
    memoryFlushSettings &&
    memoryFlushWritable &&
    (!params.isHeartbeat || memoryFlushSettings.allowHeartbeat) &&
    !isCliProvider(params.followupRun.run.provider, params.cfg) &&
    shouldRunMemoryFlush({
      entry: resolvedEntry,
      contextWindowTokens: resolveMemoryFlushContextWindowTokens({
        modelId: params.followupRun.run.model ?? params.defaultModel,
        agentCfgContextTokens: params.agentCfgContextTokens,
      }),
      reserveTokensFloor: memoryFlushSettings.reserveTokensFloor,
      softThresholdTokens: memoryFlushSettings.softThresholdTokens,
    });

  if (!shouldFlushMemory) {
    if (memoryFlushSettings) {
      const reason = !memoryFlushWritable
        ? "sandbox-ro"
        : params.isHeartbeat && !memoryFlushSettings.allowHeartbeat
          ? "heartbeat-excluded"
          : isCliProvider(params.followupRun.run.provider, params.cfg)
            ? "cli-provider"
            : resolveFlushSkipReason(resolvedEntry, memoryFlushSettings, {
                modelId: params.followupRun.run.model ?? params.defaultModel,
                agentCfgContextTokens: params.agentCfgContextTokens,
              });
      logInfo(`memory-flush: skipped — ${reason}`);
    }
    return params.sessionEntry;
  }

  let activeSessionEntry = params.sessionEntry;
  const activeSessionStore = params.sessionStore;
  const flushRunId = crypto.randomUUID();
  if (params.sessionKey) {
    registerAgentRunContext(flushRunId, {
      sessionKey: params.sessionKey,
      verboseLevel: params.resolvedVerboseLevel,
    });
  }
  let memoryCompactionCompleted = false;
  const flushSystemPrompt = [
    params.followupRun.run.extraSystemPrompt,
    memoryFlushSettings.systemPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    await runWithModelFallback({
      cfg: params.followupRun.run.config,
      provider: params.followupRun.run.provider,
      model: params.followupRun.run.model,
      agentDir: params.followupRun.run.agentDir,
      fallbacksOverride: resolveAgentModelFallbacksOverride(
        params.followupRun.run.config,
        resolveAgentIdFromSessionKey(params.followupRun.run.sessionKey),
      ),
      run: (provider, model) => {
        const authProfileId =
          provider === params.followupRun.run.provider
            ? params.followupRun.run.authProfileId
            : undefined;
        return runEmbeddedPiAgent({
          sessionId: params.followupRun.run.sessionId,
          sessionKey: params.sessionKey,
          agentId: params.followupRun.run.agentId,
          messageProvider: params.sessionCtx.Provider?.trim().toLowerCase() || undefined,
          agentAccountId: params.sessionCtx.AccountId,
          messageTo: params.sessionCtx.OriginatingTo ?? params.sessionCtx.To,
          messageThreadId: params.sessionCtx.MessageThreadId ?? undefined,
          // Provider threading context for tool auto-injection
          ...buildThreadingToolContext({
            sessionCtx: params.sessionCtx,
            config: params.followupRun.run.config,
            hasRepliedRef: params.opts?.hasRepliedRef,
          }),
          senderId: params.sessionCtx.SenderId?.trim() || undefined,
          senderName: params.sessionCtx.SenderName?.trim() || undefined,
          senderUsername: params.sessionCtx.SenderUsername?.trim() || undefined,
          senderE164: params.sessionCtx.SenderE164?.trim() || undefined,
          sessionFile: params.followupRun.run.sessionFile,
          workspaceDir: params.followupRun.run.workspaceDir,
          agentDir: params.followupRun.run.agentDir,
          config: params.followupRun.run.config,
          skillsSnapshot: params.followupRun.run.skillsSnapshot,
          prompt: memoryFlushSettings.prompt,
          extraSystemPrompt: flushSystemPrompt,
          ownerNumbers: params.followupRun.run.ownerNumbers,
          enforceFinalTag: resolveEnforceFinalTag(params.followupRun.run, provider),
          provider,
          model,
          authProfileId,
          authProfileIdSource: authProfileId
            ? params.followupRun.run.authProfileIdSource
            : undefined,
          thinkLevel: params.followupRun.run.thinkLevel,
          verboseLevel: params.followupRun.run.verboseLevel,
          reasoningLevel: params.followupRun.run.reasoningLevel,
          execOverrides: params.followupRun.run.execOverrides,
          bashElevated: params.followupRun.run.bashElevated,
          timeoutMs: params.followupRun.run.timeoutMs,
          runId: flushRunId,
          onAgentEvent: (evt) => {
            if (evt.stream === "compaction") {
              const phase = typeof evt.data.phase === "string" ? evt.data.phase : "";
              if (phase === "end") {
                memoryCompactionCompleted = true;
              }
            }
          },
        });
      },
    });
    let memoryFlushCompactionCount =
      activeSessionEntry?.compactionCount ??
      (params.sessionKey ? activeSessionStore?.[params.sessionKey]?.compactionCount : 0) ??
      0;
    if (memoryCompactionCompleted) {
      const nextCount = await incrementCompactionCount({
        sessionEntry: activeSessionEntry,
        sessionStore: activeSessionStore,
        sessionKey: params.sessionKey,
        storePath: params.storePath,
      });
      if (typeof nextCount === "number") {
        memoryFlushCompactionCount = nextCount;
      }
    }
    if (params.storePath && params.sessionKey) {
      try {
        const updatedEntry = await updateSessionStoreEntry({
          storePath: params.storePath,
          sessionKey: params.sessionKey,
          update: async () => ({
            memoryFlushAt: Date.now(),
            memoryFlushCompactionCount,
          }),
        });
        if (updatedEntry) {
          activeSessionEntry = updatedEntry;
          logInfo(`memory-flush: completed (compaction=${memoryFlushCompactionCount})`);
        }
      } catch (err) {
        logVerbose(`failed to persist memory flush metadata: ${String(err)}`);
      }
    }
  } catch (err) {
    logVerbose(`memory flush run failed: ${String(err)}`);
  }

  return activeSessionEntry;
}

// ─── Proactive compaction ────────────────────────────────────────────────────
// When the provider (e.g. claude-max) doesn't report usage, the SDK never
// triggers auto-compaction internally. The session grows until it overflows,
// at which point the API returns an error and the overflow handler reacts.
// Proactive compaction prevents this by estimating tokens from file size and
// triggering compaction before the overflow point.

/** Default: trigger proactive compaction at 75% of context window. */
const PROACTIVE_COMPACTION_RATIO = 0.75;

export async function runProactiveCompactionIfNeeded(params: {
  cfg: OpenClawConfig;
  followupRun: FollowupRun;
  defaultModel: string;
  agentCfgContextTokens?: number;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
}): Promise<{ compacted: boolean; sessionEntry?: SessionEntry }> {
  const entry =
    params.sessionEntry ??
    (params.sessionKey ? params.sessionStore?.[params.sessionKey] : undefined);
  if (!entry) {
    return { compacted: false, sessionEntry: params.sessionEntry };
  }

  // Skip if provider reports real usage (SDK handles compaction natively)
  const hasRealUsage =
    typeof entry.totalTokens === "number" &&
    Number.isFinite(entry.totalTokens) &&
    entry.totalTokens > 0 &&
    entry.totalTokensFresh === true;
  if (hasRealUsage) {
    logInfo("proactive-compaction: skipped — provider reports real usage");
    return { compacted: false, sessionEntry: params.sessionEntry };
  }

  // Estimate tokens from session file size
  const sessionFile =
    entry.sessionFile ??
    (params.sessionKey
      ? resolveSessionFilePath(
          entry.sessionId,
          entry,
          resolveSessionFilePathOptions({
            agentId: resolveAgentIdFromSessionKey(params.sessionKey),
            storePath: params.storePath,
          }),
        )
      : undefined);
  const estimatedTokens = estimateTotalTokensFromSessionFile(sessionFile);
  if (!estimatedTokens || estimatedTokens <= 0) {
    return { compacted: false, sessionEntry: params.sessionEntry };
  }

  // Compute threshold
  const contextWindow = resolveMemoryFlushContextWindowTokens({
    modelId: params.followupRun.run.model ?? params.defaultModel,
    agentCfgContextTokens: params.agentCfgContextTokens,
  });
  const threshold = Math.floor(contextWindow * PROACTIVE_COMPACTION_RATIO);
  if (estimatedTokens < threshold) {
    logInfo(
      `proactive-compaction: skipped — under threshold (${estimatedTokens}/${threshold} est. tokens)`,
    );
    return { compacted: false, sessionEntry: params.sessionEntry };
  }

  // If the session is extremely oversized (>2x context window), compaction
  // will hit E2BIG. The overflow handler in run.ts will reset these sessions.
  const maxCompactableTokens = contextWindow * 2;
  if (estimatedTokens > maxCompactableTokens) {
    logInfo(
      `proactive-compaction: skipped — session too large for compaction (${estimatedTokens} > ${maxCompactableTokens} est. tokens). Will be reset on next overflow.`,
    );
    return { compacted: false, sessionEntry: params.sessionEntry };
  }

  logInfo(
    `proactive-compaction: triggering — ${estimatedTokens} est. tokens >= ${threshold} threshold (${contextWindow} context window)`,
  );

  // Pre-compact: truncate oversized tool results to avoid E2BIG when the
  // session file is too large for the OS to pass as a subprocess argument.
  if (sessionFile && estimatedTokens > contextWindow) {
    try {
      const truncResult = await truncateOversizedToolResultsInSession({
        sessionFile,
        contextWindowTokens: contextWindow,
        sessionId: params.followupRun.run.sessionId,
        sessionKey: params.sessionKey,
      });
      if (truncResult.truncated) {
        logInfo(
          `proactive-compaction: pre-truncated ${truncResult.truncatedCount} oversized tool result(s)`,
        );
      }
    } catch (err) {
      logVerbose(`proactive-compaction: pre-truncation failed — ${String(err)}`);
    }
  }

  try {
    const result = await compactEmbeddedPiSession({
      sessionId: params.followupRun.run.sessionId,
      sessionKey: params.sessionKey,
      sessionFile: params.followupRun.run.sessionFile,
      workspaceDir: params.followupRun.run.workspaceDir,
      agentDir: params.followupRun.run.agentDir,
      config: params.followupRun.run.config,
      skillsSnapshot: params.followupRun.run.skillsSnapshot,
      provider: params.followupRun.run.provider,
      model: params.followupRun.run.model,
      thinkLevel: params.followupRun.run.thinkLevel,
      reasoningLevel: params.followupRun.run.reasoningLevel,
      bashElevated: params.followupRun.run.bashElevated,
      customInstructions: params.cfg?.agents?.defaults?.compaction?.customInstructions,
      trigger: "overflow",
      ownerNumbers: params.followupRun.run.ownerNumbers,
    });

    if (result.ok && result.compacted) {
      logInfo(
        `proactive-compaction: completed (${result.result?.tokensBefore ?? "?"} → ${result.result?.tokensAfter ?? "?"} tokens)`,
      );
      const nextCount = await incrementCompactionCount({
        sessionEntry: params.sessionEntry,
        sessionStore: params.sessionStore,
        sessionKey: params.sessionKey,
        storePath: params.storePath,
        tokensAfter: result.result?.tokensAfter,
      });
      let updatedEntry = params.sessionEntry;
      if (params.storePath && params.sessionKey && typeof nextCount === "number") {
        try {
          const persisted = await updateSessionStoreEntry({
            storePath: params.storePath,
            sessionKey: params.sessionKey,
            update: async () => ({
              compactionCount: nextCount,
              totalTokens: result.result?.tokensAfter,
              totalTokensFresh: false,
            }),
          });
          if (persisted) {
            updatedEntry = persisted;
          }
        } catch (err) {
          logVerbose(`proactive-compaction: failed to persist metadata: ${String(err)}`);
        }
      }
      return { compacted: true, sessionEntry: updatedEntry };
    }

    logInfo(`proactive-compaction: did not compact — ${result.reason ?? "nothing to compact"}`);
    return { compacted: false, sessionEntry: params.sessionEntry };
  } catch (err) {
    logVerbose(`proactive-compaction: failed — ${String(err)}`);
    return { compacted: false, sessionEntry: params.sessionEntry };
  }
}
