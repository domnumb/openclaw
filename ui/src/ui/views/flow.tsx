import React, { useMemo, useCallback, useEffect, useState } from "react";
import { ReactFlowWrapper } from "../components/react-flow-wrapper.tsx";
import { flowNodeTypes } from "../components/flow-nodes.tsx";
import {
  buildFlowFromData,
  loadFlowLayout,
  saveFlowLayout,
  applySavedLayout,
} from "../flow-data.ts";
import type { Node, Edge } from "@xyflow/react";
import type { CronJob } from "../types.ts";
import type { GatewaySessionRow } from "../types.ts";

export type FlowViewProps = {
  cronJobs?: CronJob[];
  sessions?: GatewaySessionRow[];
  onRefresh?: () => void;
  nodes?: Node[];
  edges?: Edge[];
  onNodesChange?: (changes: any) => void;
  onEdgesChange?: (changes: any) => void;
  onConnect?: (connection: any) => void;
};

export function FlowView({
  cronJobs = [],
  sessions = [],
  onRefresh,
  nodes: controlledNodes,
  edges: controlledEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: FlowViewProps) {
  const [layoutSaved, setLayoutSaved] = useState(false);

  const { nodes: dataNodes, edges: dataEdges } = useMemo(() => {
    if (cronJobs.length > 0 || sessions.length > 0) {
      return buildFlowFromData({ cronJobs, sessions });
    }
    return { nodes: [] as Node[], edges: [] as Edge[] };
  }, [cronJobs, sessions]);

  const savedLayout = useMemo(() => loadFlowLayout(), []);

  const initialNodes = useMemo(() => {
    const base = controlledNodes?.length ? controlledNodes : dataNodes;
    if (base.length === 0) {
      return [
        { id: "1", type: "input", data: { label: "Start" }, position: { x: 250, y: 100 } },
        { id: "2", data: { label: "Process" }, position: { x: 250, y: 200 } },
        { id: "3", type: "output", data: { label: "End" }, position: { x: 250, y: 300 } },
      ] as Node[];
    }
    return applySavedLayout(base, savedLayout);
  }, [controlledNodes, dataNodes, savedLayout]);

  const initialEdges = useMemo(() => {
    if (controlledEdges?.length) return controlledEdges;
    if (dataEdges.length > 0) return dataEdges;
    return [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
    ] as Edge[];
  }, [controlledEdges, dataEdges]);

  const handleLayoutChange = useCallback((nodes: Node[]) => {
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      positions[n.id] = { x: n.position.x, y: n.position.y };
    });
    saveFlowLayout(positions);
    setLayoutSaved(true);
  }, []);

  useEffect(() => {
    if (!layoutSaved) return;
    const t = setTimeout(() => setLayoutSaved(false), 2000);
    return () => clearTimeout(t);
  }, [layoutSaved]);

  const hasData = cronJobs.length > 0 || sessions.length > 0;

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border, #e0e0e0)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Flow</h2>
          {typeof onRefresh === "function" && (
            <button
              type="button"
              onClick={onRefresh}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
                border: "1px solid var(--border, #e0e0e0)",
                borderRadius: 6,
                background: "var(--bg-secondary, #f8fafc)",
              }}
            >
              Refresh data
            </button>
          )}
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--text-secondary, #666)" }}>
          {hasData
            ? `Gateway · ${cronJobs.length} cron job(s) · ${sessions.length} session(s). Drag to rearrange; layout is saved.`
            : "Visualize workflows, agent connections, and process flows. Click “Refresh data” or open Cron/Sessions first."}
        </p>
        {layoutSaved && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary, #22c55e)" }}>
            Layout saved.
          </p>
        )}
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlowWrapper
          key={hasData ? "data" : "default"}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          nodeTypes={hasData ? flowNodeTypes : undefined}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onLayoutChange={handleLayoutChange}
          showControls={true}
          showMinimap={true}
          showBackground={true}
        />
      </div>
    </div>
  );
}
