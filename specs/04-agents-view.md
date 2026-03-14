# 04 — Agents View

> Pixel reference: [screenshots/07-agents-view.png](screenshots/07-agents-view.png), [screenshots/10-agents-fleet-panel.png](screenshots/10-agents-fleet-panel.png), [screenshots/11-agents-effects-panel.png](screenshots/11-agents-effects-panel.png)

---

## Overview

The Agents view is a 3-panel layout: fleet sidebar (left), orchestrator conversation (center), and effects panel (right). The center panel uses a **hierarchical tree structure** to represent orchestrators spawning sub-agents, with collapsible branches.

**Replaces**: Current `AgentFleetPanel.vue` + manager/chat panels

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Agents  8 running across 2 projects   ●Scheduler  +New  MissionCtrl │  Header row 1
├──────────────────────────────────────────────────────────────────────┤
│ Projects: [PMS●2×] [Angy●6×] [Smart] [+47 more▾]   Show: Active   │  Header row 2
├────────────┬─────────────────────────────────┬───────────────────────┤
│            │                                 │                       │
│  Fleet     │  Orchestrator Chat              │  Effects              │
│  w-72      │  flex-1                         │  w-64                 │
│  (288px)   │                                 │  (256px)              │
│            │                                 │                       │
└────────────┴─────────────────────────────────┴───────────────────────┘
```

---

## Header

Same two-row structure as Board view (see [03-board-view.md](03-board-view.md)).

### Row 1 — Title + Actions

| Element | Style |
|---|---|
| Title | `text-sm font-semibold text-txt-primary` → "Agents" |
| Subtitle | `text-xs text-txt-muted` → "8 running across 2 projects" |
| Scheduler | `text-[10px] text-teal` with breathing dot → "Scheduler On" |
| + New Agent | `text-xs text-txt-muted hover:text-txt-primary px-2 py-1 rounded-md hover:bg-raised` |
| Mission Control | Same style as + New Agent |

### Row 2 — Project Filter Chips

Same shared `ProjectFilterChips` component as Board. Agent count badges appear on active chips (e.g., "PMS-Test-1 **2** ×").

---

## Left Panel — Fleet Sidebar

> Reference: [screenshots/10-agents-fleet-panel.png](screenshots/10-agents-fleet-panel.png)

| Property | Value |
|---|---|
| Width | `w-72` (288px) |
| Background | `bg-base` |
| Border | `border-r border-border-subtle` |

### Fleet Header

| Property | Value |
|---|---|
| Padding | `px-3 py-2.5` |
| Border | `border-b border-border-subtle` |
| Contents | "FLEET" label (`text-[11px] font-semibold uppercase tracking-wider`), running count (teal), cost (faint) |

### Filter Tabs

| Property | Value |
|---|---|
| Padding | `px-3 py-2` |
| Border | `border-b border-border-subtle` |
| Tabs | `All` (active: `bg-ember-500/15 text-ember-400`), `Running`, `Done`, `Failed` |
| Tab style | `text-[10px] px-2 py-0.5 rounded-full` |

### Agent List (scrollable)

Grouped by project, then an Orchestrators section.

#### Project Group Header

| Property | Value |
|---|---|
| Layout | `px-3 py-2 flex items-center gap-2 cursor-pointer` |
| Chevron | `w-2.5 h-2.5 text-txt-faint` collapse/expand arrow |
| Color dot | `w-1.5 h-1.5 rounded-full` project color |
| Name | `text-[11px] font-semibold text-txt-primary` |
| Running count | `text-[10px] text-teal ml-auto` |
| Cost | `text-[9px] text-txt-faint` |

#### Agent Row

| Property | Value |
|---|---|
| Class | `.agent-row` |
| Layout | `flex items-start gap-2 px-3 py-2 cursor-pointer` |
| Status dot | `mt-1 w-2 h-2 rounded-full` — `bg-teal anim-breathe` (running), `bg-emerald-500/50` (done) |
| Name | `text-xs font-medium text-txt-primary truncate` |
| Role badge | `text-[9px] px-1 py-0 rounded bg-cyan-500/15 text-cyan-400` (e.g., "Pipeline") |
| Task | `text-[10px] text-teal truncate` |
| Duration | `text-[9px] text-txt-faint font-mono` |
| Cost | `text-[9px] text-txt-faint` |
| Selected | `bg-ember-500/[0.06] border-left: 2px solid ember-500` |
| Done state | Name becomes `text-txt-secondary`, status badge `text-emerald-400` |

#### Orchestrators Section

| Property | Value |
|---|---|
| Header | Same as project group but with `bg-purple-400` dot, "Orchestrators" label |
| Orch rows | `border-l-2 border-purple-500/40`, name truncated, project tag, agent count, task |

---

## Center Panel — Orchestrator Conversation

> Reference: [screenshots/07-agents-view.png](screenshots/07-agents-view.png) (center portion)

### Orchestrator Header

| Property | Value |
|---|---|
| Padding | `px-5 py-3` |
| Border | `border-b border-border-subtle` |
| Layout | `flex items-center gap-3` |

| Element | Style |
|---|---|
| Icon | `w-7 h-7 rounded-lg bg-purple-500/30` with exchange arrows SVG |
| Title | `text-sm font-semibold text-txt-primary` |
| Badges | `orchestrator` (purple bg), `running` (teal bg) — each `text-[10px] px-1.5 py-0.5 rounded` |
| Breadcrumb | `text-[10px] text-txt-muted` → "Angy › Epic Name · 4 sub-agents" |
| Cost | `text-[10px] text-txt-faint` |
| Duration | `text-[10px] text-txt-faint` |
| Stop All | `text-[10px] text-txt-faint hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10` |

### Conversation Area

| Property | Value |
|---|---|
| Layout | `flex-1 overflow-y-auto px-5 py-4 space-y-3` |

#### Message Types

**1. Orchestrator Message**

| Property | Value |
|---|---|
| Class | `.tree-node anim-fade-in` |
| Avatar | `w-5 h-5 rounded-lg bg-purple-500/20` with exchange SVG |
| Label | `text-xs font-medium text-purple-400` → "Orchestrator" |
| Timestamp | `text-[10px] text-txt-faint` |
| Body | `ml-7 text-[13px] text-txt-primary leading-relaxed` |

**2. Sub-Agent Branch (collapsible `<details>`)**

| Property | Value |
|---|---|
| Element | `<details>` with class `tree-node tree-branch` |
| Open by default | Running agents open, done agents collapsed |

**Summary row (collapsed/expanded header):**

| Element | Style |
|---|---|
| Container | `tree-summary flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface border` |
| Border (running) | `border-teal/20 anim-shimmer` |
| Border (done) | `border-border-subtle` |
| Border (done opacity) | `opacity-70 hover:opacity-100` |
| Chevron | `tree-chevron w-3 h-3` — rotates 90deg when open |
| Avatar | `w-5 h-5 rounded-md bg-{color}/20` with 2-char initial |
| Name | `text-xs font-medium text-txt-primary` |
| Status badge | `text-[9px] px-1.5 py-0.5 rounded` — `bg-teal/10 text-teal` (running) or `bg-emerald-500/10 text-emerald-400` (done) |
| Running dot | `w-1.5 h-1.5 rounded-full bg-teal anim-breathe` (only if running) |
| Duration | `text-[9px] text-txt-faint font-mono` |
| Cost | `text-[9px] text-txt-faint` |
| Turn info | `text-[9px] text-txt-faint ml-auto` → "Turn 3 · 5 tool calls" |

**Children (expanded content):**

| Property | Value |
|---|---|
| Container | `tree-children ml-4 pl-4 border-l-2 border-{color}/15 mt-2 space-y-3 pb-1` |
| Border color | `purple-500/15` (done), `teal/20` (running), `emerald-500/15` (done+green) |

**Child content types:**

| Type | Rendering |
|---|---|
| Thinking block | Collapsible `<details>`, summary: "Thinking · 4.2s", body: `bg-white/[0.02] border border-white/[0.04] text-[11px] font-mono` |
| Message | `text-[12px] text-txt-primary leading-relaxed`, inline `<code>` with `bg-raised px-1 py-0.5 rounded text-cyan-400` |
| Tool calls | Collapsible `<details>`, summary: pill with count + breakdown, expanded: list of `bg-white/[0.02]` rows with tool name (ember mono) + arg |
| Streaming indicator | `bg-teal/5 border border-teal/10 px-2.5 py-1.5 rounded-md`, wave bars + status text |

**3. Orchestrator Decision**

| Property | Value |
|---|---|
| Container | `px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-500/10` |
| Layout | `flex items-center gap-2` |
| Icon | Exchange arrows SVG, purple |
| Text | `text-[11px] text-purple-300` with `<strong class="text-purple-200">` for agent names |
| Timestamp | `text-[9px] text-txt-faint ml-auto` |

### Chat Input Bar

| Property | Value |
|---|---|
| Container | `shrink-0 border-t border-border-subtle p-3` |
| Input | `bg-surface rounded-xl px-4 py-2.5 min-h-[44px] border border-border-standard focus-within:border-ember-500/30` |
| Placeholder | `text-xs text-txt-faint` → "Send a message..." |
| Agent picker | `text-[10px] text-txt-secondary` dropdown with chevron |
| Model picker | `text-[10px] text-txt-secondary` dropdown with chevron |
| Send button | `w-8 h-8 rounded-lg bg-gradient-to-r from-ember-500 to-ember-600` with send arrow icon |

---

## Right Panel — Effects

> Reference: [screenshots/11-agents-effects-panel.png](screenshots/11-agents-effects-panel.png)

| Property | Value |
|---|---|
| Width | `w-64` (256px) |
| Background | `bg-base` |
| Border | `border-l border-border-subtle` |

### Tab Bar

| Property | Value |
|---|---|
| Padding | `px-3 py-2.5` |
| Border | `border-b border-border-subtle` |
| Left tabs | "Effects" (active: `.tab-btn.active`), "Graph" |
| Right scope | "Session" (active: `bg-ember-500/15 text-ember-400`), "All" |

### Summary Bar

| Property | Value |
|---|---|
| Padding | `px-3 py-2` |
| Border | `border-b border-border-subtle` |
| Contents | File count (`text-txt-muted`), additions (`text-emerald-400`), deletions (`text-red-400`) |

### File List (scrollable)

Grouped by turn with headers.

#### Turn Header

`text-[9px] uppercase tracking-widest text-txt-faint px-1` → "Turn 5 · 2m ago"

#### File Row

| Property | Value |
|---|---|
| Class | `.effect-file` |
| Layout | `flex items-center gap-2 px-3 py-1.5 cursor-pointer` |
| Icon | Document SVG `w-3.5 h-3.5` — emerald (added), cyan (existing) |
| Name | `text-[11px] text-txt-primary truncate font-mono` |
| Status badge | `A` (emerald) or `M` (amber) — `text-[10px] px-1 rounded bg-{color}/10` |
| Line changes | `text-[10px]` — additions in emerald, deletions in red |

### Action Buttons

| Property | Value |
|---|---|
| Container | `shrink-0 p-3 border-t border-border-subtle` |
| Approve | `flex-1 h-8 rounded-lg bg-gradient-to-r from-ember-500 to-ember-600 text-xs font-medium text-base` |
| Reject | `h-8 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-txt-secondary` |
| More | `h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06]` with dots icon |

---

## Data Binding

| Data | Store |
|---|---|
| Agent list | `useAgentStore().agents` grouped by `projectId` |
| Orchestrator sessions | `useSessionStore().sessions` with tree structure |
| Selected orchestrator | `useAgentStore().selectedSessionId` |
| File effects | `useEffectsStore().fileChanges` grouped by turn |
| Approval state | `useEffectsStore().pendingApproval` |

---

## New Components

| Component | Description |
|---|---|
| `FleetSidebar.vue` | Left panel with project-grouped agent list |
| `OrchestratorChat.vue` | Center panel with header + scrollable tree |
| `TreeBranch.vue` | Collapsible sub-agent `<details>` element |
| `TreeNode.vue` | Individual message/thinking/tool-call node |
| `ChatInputBar.vue` | Bottom input with agent/model pickers |
| `EffectsPanel.vue` | Right panel with file changes and actions |

---

## Migration Steps

1. Create 3-panel layout in the agents view with `flex` row
2. Build `FleetSidebar.vue` with project grouping and filter tabs
3. Build `OrchestratorChat.vue` with header bar
4. Implement `TreeBranch.vue` using native `<details>/<summary>` for collapsible sub-agents
5. Implement message types (orchestrator, sub-agent thinking, tool calls, streaming)
6. Build `EffectsPanel.vue` with tabs, file list, approve/reject
7. Build `ChatInputBar.vue` with agent/model selectors
8. Wire agent selection in fleet sidebar to orchestrator display in center
9. Add project filter chips (shared component)
10. Connect approve/reject actions to store
