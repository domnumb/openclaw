import { html, nothing } from "lit";
import type {
  AgentRoutingChainItem,
  AgentRoutingStatusResult,
} from "../controllers/agent-routing.ts";

function formatCooldownRemaining(ms: number): string {
  if (ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function renderChainItem(item: AgentRoutingChainItem, isFirst: boolean, isLast: boolean) {
  const statusClass =
    item.status === "active"
      ? "routing-pill--active"
      : item.status === "cooldown"
        ? "routing-pill--cooldown"
        : "routing-pill--disabled";

  const statusLabel =
    item.status === "active" ? "active" : item.status === "cooldown" ? "cooldown" : "disabled";

  const cooldownText =
    item.status === "cooldown" && typeof item.cooldownRemainingMs === "number"
      ? ` (${formatCooldownRemaining(item.cooldownRemainingMs)})`
      : "";

  return html`
    <div class="routing-chain-item">
      ${
        !isFirst
          ? html`
              <span class="routing-chain-arrow">→</span>
            `
          : nothing
      }
      <div class="routing-pill ${statusClass}">
        <span class="routing-pill-id mono">${item.profileId}</span>
        <span class="routing-pill-status">${statusLabel}${cooldownText}</span>
      </div>
    </div>
  `;
}

export function renderAgentRouting(params: {
  loading: boolean;
  error: string | null;
  data: AgentRoutingStatusResult | null;
  agentId: string;
  onRefresh: () => void;
}) {
  const { loading, error, data, onRefresh } = params;

  const anyCooldown = data?.chain.some(
    (entry) => entry.status === "cooldown" || entry.status === "disabled",
  );

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">
            Model Routing
            ${data ? html`<span class="agent-pill" style="margin-left: 8px;">${data.fallbackCount} fallback${data.fallbackCount !== 1 ? "s" : ""}</span>` : nothing}
          </div>
          <div class="card-sub">Auth profile rotation and cooldown status.</div>
        </div>
        <button
          class="btn btn--sm"
          ?disabled=${loading}
          @click=${onRefresh}
        >
          ${loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      ${error ? html`<div class="callout danger" style="margin-top: 12px;">${error}</div>` : nothing}

      ${
        loading && !data
          ? html`
              <div class="muted" style="margin-top: 16px">Loading routing status…</div>
            `
          : nothing
      }

      ${
        data
          ? html`
              <div class="agents-overview-grid" style="margin-top: 16px;">
                <div class="agent-kv">
                  <div class="label">SERVING NOW</div>
                  <div class="mono">${data.servingNow.provider}/${data.servingNow.model}</div>
                </div>
                <div class="agent-kv">
                  <div class="label">DEFAULT ROUTE</div>
                  <div class="mono">${data.defaultRoute.provider}/${data.defaultRoute.model}</div>
                </div>
                ${
                  anyCooldown
                    ? html`
                        <div class="agent-kv">
                          <div class="label">COOLDOWN</div>
                          <div>
                            ${data.chain
                              .filter((e) => e.status !== "active")
                              .map(
                                (e) => html`
                                <span class="mono" style="display: block;">
                                  ${e.profileId}
                                  ${
                                    e.status === "cooldown" &&
                                    typeof e.cooldownRemainingMs === "number"
                                      ? html` — ${formatCooldownRemaining(e.cooldownRemainingMs)} remaining`
                                      : nothing
                                  }
                                  ${
                                    e.status === "disabled"
                                      ? html`
                                          — disabled
                                        `
                                      : nothing
                                  }
                                </span>
                              `,
                              )}
                          </div>
                        </div>
                      `
                    : nothing
                }
              </div>

              <div style="margin-top: 20px;">
                <div class="label" style="margin-bottom: 8px;">FALLBACK CHAIN</div>
                <div class="routing-chain">
                  ${
                    data.chain.length === 0
                      ? html`
                          <div class="muted">No profiles configured.</div>
                        `
                      : data.chain.map((item, idx) =>
                          renderChainItem(item, idx === 0, idx === data.chain.length - 1),
                        )
                  }
                </div>
              </div>
            `
          : nothing
      }

      ${
        !loading && !data && !error
          ? html`
              <div class="muted" style="margin-top: 16px">No routing data. Click Refresh to load.</div>
            `
          : nothing
      }
    </section>
  `;
}
