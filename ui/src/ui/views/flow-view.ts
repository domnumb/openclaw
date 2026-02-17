import { html } from "lit";
import "./flow-lit.ts";
import type { CronJob } from "../types.ts";
import type { GatewaySessionRow } from "../types.ts";

export type FlowViewProps = {
  cronJobs?: CronJob[];
  sessions?: GatewaySessionRow[];
  onRefresh?: () => void;
};

export function renderFlow(props: FlowViewProps) {
  const cronJobs = props.cronJobs ?? [];
  const sessions = props.sessions ?? [];
  const onRefresh = props.onRefresh;
  return html`<flow-view-lit
    .cronJobs=${cronJobs}
    .sessions=${sessions}
    .onRefresh=${onRefresh}
  ></flow-view-lit>`;
}
