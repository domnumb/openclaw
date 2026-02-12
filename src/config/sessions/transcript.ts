import { CURRENT_SESSION_VERSION, SessionManager } from "@mariozechner/pi-coding-agent";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SessionEntry } from "./types.js";
import { emitSessionTranscriptUpdate } from "../../sessions/transcript-events.js";
import { resolveDefaultSessionStorePath, resolveSessionFilePath } from "./paths.js";
import { loadSessionStore, updateSessionStore } from "./store.js";

function stripQuery(value: string): string {
  const noHash = value.split("#")[0] ?? value;
  return noHash.split("?")[0] ?? noHash;
}

function extractFileNameFromMediaUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = stripQuery(trimmed);
  try {
    const parsed = new URL(cleaned);
    const base = path.basename(parsed.pathname);
    if (!base) {
      return null;
    }
    try {
      return decodeURIComponent(base);
    } catch {
      return base;
    }
  } catch {
    const base = path.basename(cleaned);
    if (!base || base === "/" || base === ".") {
      return null;
    }
    return base;
  }
}

export function resolveMirroredTranscriptText(params: {
  text?: string;
  mediaUrls?: string[];
}): string | null {
  const mediaUrls = params.mediaUrls?.filter((url) => url && url.trim()) ?? [];
  if (mediaUrls.length > 0) {
    const names = mediaUrls
      .map((url) => extractFileNameFromMediaUrl(url))
      .filter((name): name is string => Boolean(name && name.trim()));
    if (names.length > 0) {
      return names.join(", ");
    }
    return "media";
  }

  const text = params.text ?? "";
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

async function ensureSessionHeader(params: {
  sessionFile: string;
  sessionId: string;
}): Promise<void> {
  if (fs.existsSync(params.sessionFile)) {
    return;
  }
  await fs.promises.mkdir(path.dirname(params.sessionFile), { recursive: true });
  const header = {
    type: "session",
    version: CURRENT_SESSION_VERSION,
    id: params.sessionId,
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
  };
  await fs.promises.writeFile(params.sessionFile, `${JSON.stringify(header)}\n`, "utf-8");
}

export async function appendAssistantMessageToSessionTranscript(params: {
  agentId?: string;
  sessionKey: string;
  text?: string;
  mediaUrls?: string[];
  /** Optional override for store path (mostly for tests). */
  storePath?: string;
}): Promise<{ ok: true; sessionFile: string } | { ok: false; reason: string }> {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    return { ok: false, reason: "missing sessionKey" };
  }

  const mirrorText = resolveMirroredTranscriptText({
    text: params.text,
    mediaUrls: params.mediaUrls,
  });
  if (!mirrorText) {
    return { ok: false, reason: "empty text" };
  }

  const storePath = params.storePath ?? resolveDefaultSessionStorePath(params.agentId);
  const store = loadSessionStore(storePath, { skipCache: true });
  const entry = store[sessionKey] as SessionEntry | undefined;
  if (!entry?.sessionId) {
    return { ok: false, reason: `unknown sessionKey: ${sessionKey}` };
  }

  let sessionFile: string;
  try {
    sessionFile = resolveSessionFilePath(entry.sessionId, entry, {
      agentId: params.agentId,
      sessionsDir: path.dirname(storePath),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  await ensureSessionHeader({ sessionFile, sessionId: entry.sessionId });

  // Store delivery-mirror as a custom JSONL entry (type: "custom") instead of
  // a regular message (type: "message"). This ensures the mirrored text is
  // recorded in the transcript for auditing, but is NOT included in the
  // conversation history sent to the LLM. Previously, storing it as an
  // assistant message would prime the model with a greeting/status message it
  // never generated, causing self-reinforcing shallow responses.
  const sessionManager = SessionManager.open(sessionFile);
  const parentId = sessionManager.getLeafId?.() ?? null;
  const customEntry = {
    type: "custom",
    customType: "delivery-mirror",
    data: {
      text: mirrorText,
      timestamp: Date.now(),
    },
    id: crypto.randomUUID().slice(0, 8),
    parentId,
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(sessionFile, `${JSON.stringify(customEntry)}\n`, "utf-8");

  if (!entry.sessionFile || entry.sessionFile !== sessionFile) {
    await updateSessionStore(
      storePath,
      (current) => {
        current[sessionKey] = {
          ...entry,
          sessionFile,
        };
      },
      { activeSessionKey: sessionKey },
    );
  }

  emitSessionTranscriptUpdate(sessionFile);
  return { ok: true, sessionFile };
}
