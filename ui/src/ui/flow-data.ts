import type { Node, Edge } from "@xyflow/react";
import type { CronJob } from "./types.ts";
import type { GatewaySessionRow } from "./types.ts";

const GATEWAY_ID = "gateway";
const LAYOUT_KEY = "openclaw-flow-layout";

export type FlowDataInput = {
  cronJobs: CronJob[];
  sessions: GatewaySessionRow[];
};

function cronScheduleSummary(schedule: CronJob["schedule"]): string {
  if (schedule.kind === "cron" && schedule.expr) {
    return schedule.expr;
  }
  if (schedule.kind === "every" && schedule.everyMs) {
    const m = schedule.everyMs / 60000;
    if (m < 1) return `${schedule.everyMs / 1000}s`;
    if (m < 60) return `${Math.round(m)}m`;
    return `${Math.round(m / 60)}h`;
  }
  if (schedule.kind === "at" && schedule.at) {
    return "once";
  }
  return "—";
}

export function buildFlowFromData(input: FlowDataInput): { nodes: Node[]; edges: Edge[] } {
  const { cronJobs, sessions } = input;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Gateway node (center)
  nodes.push({
    id: GATEWAY_ID,
    type: "gateway",
    data: { label: "Gateway", subtitle: "Heartbeat · Cron · Sessions" },
    position: { x: 400, y: 200 },
  });

  // Cron nodes (left of gateway)
  const cronGap = 180;
  cronJobs.forEach((job, i) => {
    const id = `cron-${job.id}`;
    const scheduleStr = cronScheduleSummary(job.schedule);
    nodes.push({
      id,
      type: "cron",
      data: {
        label: job.name,
        subtitle: scheduleStr,
        enabled: job.enabled,
        jobId: job.id,
      },
      position: { x: 120, y: 80 + i * cronGap },
    });
    edges.push({ id: `e-${id}`, source: id, target: GATEWAY_ID });
  });

  // Session nodes (right of gateway) — limit to a reasonable number for layout
  const sessionList = sessions.slice(0, 20);
  const sessionGap = 100;
  sessionList.forEach((session, i) => {
    const id = `session-${session.key.replace(/[^a-z0-9-]/gi, "_")}`;
    const label = session.label ?? session.displayName ?? session.key;
    const sub = session.model ?? session.key.split(":")[0] ?? "";
    nodes.push({
      id,
      type: "session",
      data: {
        label: label.length > 24 ? label.slice(0, 22) + "…" : label,
        subtitle: sub,
        sessionKey: session.key,
      },
      position: { x: 720, y: 60 + i * sessionGap },
    });
    edges.push({ id: `e-${id}`, source: GATEWAY_ID, target: id });
  });

  return { nodes, edges };
}

export type SavedLayout = {
  nodePositions: Record<string, { x: number; y: number }>;
  version: number;
};

const LAYOUT_VERSION = 1;

export function loadFlowLayout(): SavedLayout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLayout;
    if (parsed.version !== LAYOUT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFlowLayout(nodePositions: Record<string, { x: number; y: number }>): void {
  const payload: SavedLayout = {
    nodePositions,
    version: LAYOUT_VERSION,
  };
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function applySavedLayout(
  nodes: Node[],
  saved: SavedLayout | null,
): Node[] {
  if (!saved?.nodePositions) return nodes;
  return nodes.map((n) => {
    const pos = saved.nodePositions[n.id];
    if (!pos) return n;
    return { ...n, position: pos };
  });
}
