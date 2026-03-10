import type { GatewayBrowserClient } from "../gateway.ts";

export type AgentRoutingChainItem = {
  profileId: string;
  provider: string;
  model: string;
  status: "active" | "cooldown" | "disabled";
  cooldownRemainingMs?: number;
  cooldownMaxMs?: number;
};

export type AgentRoutingStatusResult = {
  defaultRoute: { provider: string; model: string };
  servingNow: { provider: string; model: string };
  chain: AgentRoutingChainItem[];
  fallbackCount: number;
};

export type AgentRoutingState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentRoutingLoading: boolean;
  agentRoutingError: string | null;
  agentRoutingData: AgentRoutingStatusResult | null;
  agentRoutingAgentId: string | null;
};

export async function loadAgentRouting(state: AgentRoutingState, agentId: string) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.agentRoutingLoading) {
    return;
  }
  state.agentRoutingLoading = true;
  state.agentRoutingError = null;
  try {
    const res = await state.client.request<AgentRoutingStatusResult>("agent.routing.status", {
      agentId,
    });
    if (res) {
      state.agentRoutingData = res;
      state.agentRoutingAgentId = agentId;
    }
  } catch (err) {
    state.agentRoutingError = String(err);
  } finally {
    state.agentRoutingLoading = false;
  }
}
