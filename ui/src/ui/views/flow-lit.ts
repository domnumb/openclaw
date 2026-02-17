import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRoot } from "react-dom/client";
import React from "react";
import { FlowView } from "./flow.tsx";
import type { Node, Edge, Connection } from "@xyflow/react";
import type { CronJob } from "../types.ts";
import type { GatewaySessionRow } from "../types.ts";

@customElement("flow-view-lit")
export class FlowViewLit extends LitElement {
  @property({ type: Array }) cronJobs: CronJob[] = [];
  @property({ type: Array }) sessions: GatewaySessionRow[] = [];
  @property({ type: Object }) onRefresh: (() => void) | undefined;
  @state() private nodes: Node[] = [];
  @state() private edges: Edge[] = [];
  private reactRoot: ReturnType<typeof createRoot> | null = null;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    #react-container {
      width: 100%;
      height: 100%;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.mountReact();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unmountReact();
  }

  private mountReact() {
    const container = this.shadowRoot?.getElementById("react-container");
    if (container && !this.reactRoot) {
      this.reactRoot = createRoot(container);
      this.renderReact();
    }
  }

  private renderReact() {
    if (!this.reactRoot) return;
    this.reactRoot.render(
      React.createElement(FlowView, {
        cronJobs: this.cronJobs ?? [],
        sessions: this.sessions ?? [],
        onRefresh: this.onRefresh,
        nodes: this.nodes,
        edges: this.edges,
        onNodesChange: (changes: any) => {},
        onEdgesChange: (changes: any) => {},
        onConnect: (connection: Connection) => {},
      }),
    );
  }

  private unmountReact() {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }

  updated() {
    // Re-render React when nodes/edges change
    this.renderReact();
  }

  render() {
    return html`<div id="react-container"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "flow-view-lit": FlowViewLit;
  }
}
