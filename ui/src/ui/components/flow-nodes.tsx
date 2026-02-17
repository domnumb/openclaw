import React from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";

const baseStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  minWidth: "140px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
};

export function GatewayNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          ...baseStyle,
          background: "var(--bg-secondary, #f0f4ff)",
          border: "1px solid var(--border, #c7d2fe)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Gateway</div>
        <div style={{ color: "var(--text-secondary, #64748b)", fontSize: 11 }}>
          {data.subtitle ?? "OpenClaw"}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function CronNode({ data }: NodeProps) {
  const enabled = data.enabled !== false;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          ...baseStyle,
          background: enabled ? "var(--bg-secondary, #ecfdf5)" : "var(--bg-secondary, #fef2f2)",
          border: `1px solid ${enabled ? "var(--border, #a7f3d0)" : "var(--border, #fecaca)"}`,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{data.label ?? "Cron"}</div>
        {data.subtitle && (
          <div style={{ color: "var(--text-secondary, #64748b)", fontSize: 10 }}>
            {data.subtitle}
          </div>
        )}
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            opacity: 0.8,
          }}
        >
          {enabled ? "● enabled" : "○ disabled"}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function SessionNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          ...baseStyle,
          background: "var(--bg-secondary, #fefce8)",
          border: "1px solid var(--border, #fef08a)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{data.label ?? "Session"}</div>
        {data.subtitle && (
          <div style={{ color: "var(--text-secondary, #64748b)", fontSize: 10 }}>
            {data.subtitle}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export const flowNodeTypes = {
  gateway: GatewayNode,
  cron: CronNode,
  session: SessionNode,
};
