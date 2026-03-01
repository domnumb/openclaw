import { loadConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const opsLog = createSubsystemLogger("discord/ops");

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Post an operational alert as a Discord embed. Always logs at error level.
 * If `channels.discord.opsTarget` + `channels.discord.token` are configured,
 * posts a minimal grey embed to that Discord channel.
 */
export function opsPost(message: string, meta?: Record<string, unknown>): void {
  opsLog.error(message, meta);

  try {
    const cfg = loadConfig();
    const discord = cfg.channels?.discord as Record<string, unknown> | undefined;
    const opsTarget = discord?.opsTarget;
    const token = discord?.token;
    if (typeof opsTarget === "string" && opsTarget && typeof token === "string" && token) {
      // Strip "channel:" prefix from opsTarget config value
      const channelId = opsTarget.replace(/^channel:/, "");
      const embed = {
        title: "🖥️ Gateway",
        description: message.slice(0, 200),
        color: 0x95a5a6, // gris — gateway = infra, pas sécurité
        timestamp: new Date().toISOString(),
        footer: { text: "openclaw-gateway" },
      };
      void fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
      }).catch((err: unknown) => {
        opsLog.warn(`opsPost delivery failed: ${String(err)}`);
      });
    }
  } catch {
    // Config not loaded yet or send infra unavailable — log only.
  }
}

// --- Aggregated preflight drop counter (GAP-G3) ---

const preflightDropCounts = new Map<string, number>();
let preflightDropTimerId: ReturnType<typeof setInterval> | null = null;
const PREFLIGHT_REPORT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function recordPreflightDrop(reason: string): void {
  preflightDropCounts.set(reason, (preflightDropCounts.get(reason) ?? 0) + 1);
  ensurePreflightDropTimer();
}

function ensurePreflightDropTimer(): void {
  if (preflightDropTimerId) {
    return;
  }
  preflightDropTimerId = setInterval(() => {
    flushPreflightDropCounts();
  }, PREFLIGHT_REPORT_INTERVAL_MS);
  // Allow process to exit without waiting for timer.
  if (
    preflightDropTimerId &&
    typeof preflightDropTimerId === "object" &&
    "unref" in preflightDropTimerId
  ) {
    preflightDropTimerId.unref();
  }
}

function flushPreflightDropCounts(): void {
  if (preflightDropCounts.size === 0) {
    return;
  }
  const entries = Array.from(preflightDropCounts.entries());
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const summary = entries.map(([reason, count]) => `${reason}=${count}`).join(", ");
  preflightDropCounts.clear();

  opsPost(`Preflight drops (5min): total=${total} — ${summary}`, {
    preflightDrops: Object.fromEntries(entries),
    total,
  });
}
