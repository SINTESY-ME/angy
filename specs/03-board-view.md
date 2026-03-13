# 03 — Board (Kanban) View

> Pixel reference: [screenshots/05-board-view.png](screenshots/05-board-view.png), [screenshots/06-board-popover.png](screenshots/06-board-popover.png), [screenshots/09-board-header.png](screenshots/09-board-header.png)

---

## Overview

The Board view is a cross-project Kanban board with 6 columns of varying widths and card detail levels. It includes project filter chips in the header, a searchable project picker popover, and per-column card variants.

**Replaces**: Current `KanbanView.vue` + `EpicCard.vue`

---

## Header

> Reference: [screenshots/09-board-header.png](screenshots/09-board-header.png)

### Structure (two rows)

```
┌─────────────────────────────────────────────────────────────────┐
│ Board  14 epics...  |  [Filter input]  [+ Add Epic]  Schedule  │  Row 1: h-12
├─────────────────────────────────────────────────────────────────┤
│ Projects: [PMS●×] [Angy●×] [Smart] [+47 more▾]  Show: Active  │  Row 2: h-9
└─────────────────────────────────────────────────────────────────┘
```

### Row 1 — Title + Actions

| Property | Value |
|---|---|
| Height | `h-12` |
| Layout | `flex items-center px-5 gap-3` |

| Element | Style |
|---|---|
| Title | `text-sm font-semibold text-txt-primary` → "Board" |
| Subtitle | `text-xs text-txt-muted` → "14 epics across 2 active projects" |
| Filter input | `bg-raised rounded-lg px-3 py-1.5 w-48`, search icon + placeholder |
| Add Epic button | `bg-gradient-to-r from-ember-500 to-ember-600`, plus icon + "Add Epic" |
| Schedule Now | `text-xs text-txt-muted hover:text-txt-secondary` text button |

### Row 2 — Project Filter Chips

| Property | Value |
|---|---|
| Height | `h-9` |
| Border | `border-t border-border-subtle` |
| Layout | `flex items-center px-5 gap-2` |

See [07-popovers.md](07-popovers.md) for the shared `ProjectFilterChips` component spec.

**Contents (left to right):**

1. Label: `text-[10px] text-txt-faint uppercase tracking-wider` → "Projects:"
2. Active chips: `proj-chip on` with color dot, name, × dismiss
3. Inactive chips: `proj-chip` with faint dot, name
4. Overflow: `+47 more` button triggers popover
5. Spacer: `flex-1`
6. Preset: `Show: Active projects ▾` dropdown

---

## Board Area

| Property | Value |
|---|---|
| Layout | `flex-1 overflow-x-auto overflow-y-hidden` |
| Inner | `flex gap-3 h-full min-w-max p-4` |

---

## Columns

| Column | Width | Dot Color | Label Color | Opacity | Special |
|---|---|---|---|---|---|
| **Idea** | `220px` | `purple-400/80` | `txt-faint` | 100% | "Add Idea" button |
| **Upcoming** | `250px` | `blue-400/80` | `txt-faint` | 100% | — |
| **Active** | `340px` | `ember-500` | `ember-400` | 100% | Dot has `anim-breathe` |
| **Review** | `270px` | `orange-400` | `orange-400` | 100% | Dot has `anim-breathe` |
| **Done** | `220px` | `emerald-400` | `txt-faint` | 70% | `opacity-70` on container |
| **Discarded** | `180px` | `red-400/60` | `txt-faint` | 50% | Empty state placeholder |

### Column Header

| Property | Value |
|---|---|
| Layout | `flex items-center gap-2 mb-3 px-1` |
| Dot | `w-2 h-2 rounded-full` + column color |
| Label | `text-xs font-semibold uppercase tracking-wider` + column label color |
| Count | `text-[10px] text-txt-faint ml-auto` |

### Column Body

| Property | Value |
|---|---|
| Layout | `flex-1 flex flex-col gap-{2 or 3} overflow-y-auto pr-1` |

---

## Card Variants

### Idea Card

| Property | Value |
|---|---|
| Container | `bg-surface rounded-xl p-3 border border-border-subtle` |
| Accent stripe | `w-[3px] bg-purple-400/50` left edge |
| Content | Epic ID (mono, faint), project dot + name, priority badge, title |
| Hover | `hover:border-purple-500/20` |

### Upcoming Card (mini)

| Property | Value |
|---|---|
| Container | `bg-surface rounded-xl p-3 border border-border-subtle` |
| Accent stripe | `w-[3px] bg-cyan-400/40` left edge |
| Content | Epic ID, project dot + name, optional priority badge, title |
| Hover | `hover:border-ember-500/20` |

### Active Card (expanded)

| Property | Value |
|---|---|
| Container | `bg-surface rounded-xl p-4 border border-teal/25 anim-shimmer` |
| Box shadow | `0 0 24px -6px rgba(16,185,129,0.10)` |
| Accent stripe | `w-[3px] bg-ember-500` (or project color) |
| Header | Epic ID, project dot + name, priority badge, **progress ring** (SVG 28x28) |
| Title | `text-sm font-semibold` |
| Description | `text-[11px] text-txt-muted leading-relaxed mb-3` |
| Footer | Border-top divider, avatar stack, wave bars, agent count (teal), cost (faint) |

#### Progress Ring SVG

```html
<svg width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(245,158,11,0.1)" stroke-width="2.5"/>
  <circle cx="14" cy="14" r="11" fill="none" stroke="#10b981" stroke-width="2.5"
    stroke-dasharray="69" stroke-dashoffset="{computed}" stroke-linecap="round"/>
</svg>
```

`stroke-dashoffset` = `69 * (1 - progress)` where `69 = 2 * π * 11`.

### Review Card (medium)

| Property | Value |
|---|---|
| Container | `bg-surface rounded-xl p-3.5 border border-orange-400/20` |
| Box shadow | `0 0 16px -6px rgba(251,146,60,0.10)` |
| Accent stripe | `w-[3px] bg-orange-400` |
| Content | Epic ID, project, "review" badge (orange bg), title |
| Footer | Eye icon + "needs review" (orange), change count (faint) |

### Done Card (single-line)

| Property | Value |
|---|---|
| Container | `rounded-lg px-3 py-2 bg-white/[0.02] border border-white/[0.03]` |
| Layout | `flex items-center gap-2` |
| Content | Green checkmark SVG (12x12), project dot, title (truncate), turn count |
| Hover | `hover:bg-white/[0.04]` |

### Priority Badge

| Priority | Style |
|---|---|
| `high` | `bg-red-500/10 text-red-400 font-medium` |
| `medium` | `bg-ember-500/10 text-ember-400` |
| `review` | `bg-orange-500/10 text-orange-400` |
| (none) | No badge rendered |

---

## Data Binding

| Data | Source |
|---|---|
| Epics list | `useEpicStore().epics` filtered by `kanbanProjectIds` |
| Column assignment | `epic.status` field mapped to column |
| Agent avatars | `useAgentStore().agentsByEpic(epicId)` |
| Progress | `epic.progress` (0-1 float) |
| Cost | `epic.totalCost` |

---

## Actions

| Action | Trigger | Store method |
|---|---|---|
| Click epic card | Card click | `ui.navigateToEpic(epicId, projectId)` |
| Add Epic | Header button | Opens epic creation dialog |
| Add Idea | Column button | Creates epic with `status: 'idea'` |
| Schedule Now | Header button | `epicStore.scheduleNext()` |
| Filter chips | Chip click/dismiss | `ui.toggleKanbanProject(projectId)` |
| Popover Apply | Button in popover | `ui.kanbanProjectIds = selectedIds` |

---

## Migration Steps

1. Rewrite `KanbanView.vue` header with two-row structure
2. Add `ProjectFilterChips` shared component (see spec 07)
3. Redefine columns array with new widths and styles
4. Create card variant sub-components or use conditional rendering in `EpicCard.vue`
5. Implement progress ring SVG with computed `stroke-dashoffset`
6. Add avatar stack rendering from agent store
7. Wire filter chips to `ui.kanbanProjectIds`
8. Add "Add Idea" button to Idea column
9. Style Done column with `opacity-70` and single-line cards
10. Style Discarded column with `opacity-50` and empty state
