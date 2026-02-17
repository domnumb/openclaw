# React Flow Integration

React Flow (@xyflow/react) has been integrated into the OpenClaw Control UI.

## Installation

Dependencies are already added to `package.json`. Install them:

```bash
cd openclaw/ui
pnpm install
```

## Usage

The Flow view is accessible via the "Flow" tab in the Control UI navigation (under the "Control" group).

## Components

### `ReactFlowWrapper` (`src/ui/components/react-flow-wrapper.tsx`)
A reusable React Flow component wrapper with:
- Background grid
- Controls (zoom, pan)
- MiniMap
- Configurable nodes/edges

### `FlowView` (`src/ui/views/flow.tsx`)
The main React component that renders the flow diagram with default example nodes.

### `FlowViewLit` (`src/ui/views/flow-lit.ts`)
A Lit web component that bridges React Flow into the Lit-based UI. It:
- Mounts React Flow in a shadow DOM container
- Handles lifecycle (mount/unmount)
- Re-renders when nodes/edges change

## Customization

To customize the flow:

1. **Modify default nodes/edges** in `flow.tsx`
2. **Add custom node types** by extending `ReactFlowWrapper`
3. **Connect to data sources** (e.g., cron jobs, agent workflows) by passing nodes/edges as props

## Example: Visualizing Cron Jobs

```tsx
// In flow.tsx, you could map cron jobs to nodes:
const cronNodes: Node[] = cronJobs.map((job, idx) => ({
  id: job.id,
  data: { label: job.name },
  position: { x: 100, y: idx * 100 },
}));
```

## Styling

React Flow styles are imported via `@xyflow/react/dist/style.css` in the wrapper component. The flow respects CSS variables from the UI theme (e.g., `--bg-primary`, `--border`).

## Next Steps

- Connect to real data (cron jobs, agent workflows, session flows)
- Add custom node types for different entity types
- Implement save/load functionality for flow layouts
- Add drag-and-drop for creating new connections
