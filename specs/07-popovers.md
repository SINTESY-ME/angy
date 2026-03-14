# 07 — Popovers & Filter Chips

> Pixel reference: [screenshots/06-board-popover.png](screenshots/06-board-popover.png)

---

## Overview

A shared popover system used across Board, Agents, and Code views for project filtering and selection. Includes the filter chips row (pinned chips + overflow trigger) and the searchable popover panel.

---

## Shared Component: `ProjectFilterChips.vue`

Used in Board header and Agents header.

### Layout

```
Projects:  [●PMS-Test-1 ×]  [●Angy ×]  [Smartpricing]  [+47 more ▾]  ...spacer...  [Show: Active ▾]
```

| Property | Value |
|---|---|
| Container height | `h-9` |
| Border | `border-t border-border-subtle` |
| Padding | `px-5` |
| Layout | `flex items-center gap-2` |

### Label

| Property | Value |
|---|---|
| Text | "Projects:" |
| Style | `text-[10px] text-txt-faint uppercase tracking-wider mr-1` |

### Active Chip (selected project)

| Property | Value |
|---|---|
| Class | `.proj-chip.on` |
| Layout | `flex items-center gap-1.5` |
| Padding | `px-2 py-0.5` |
| Border-radius | `rounded-full` |
| Background | `bg-{projectColor}/15` (e.g., `bg-ember-500/15`) |
| Text color | `text-{projectColor}` (e.g., `text-ember-400`) |
| Border | `border border-{projectColor}/25` |
| Font | `text-[10px] font-medium` |
| Color dot | `w-1.5 h-1.5 rounded-full bg-{projectColor}` |
| Agent count | `text-{projectColor}/50 ml-0.5` (Agents view only) |
| Dismiss × | `ml-0.5 hover:text-{projectColor}/80` |

### Inactive Chip (visible but not selected)

| Property | Value |
|---|---|
| Class | `.proj-chip` (no `.on`) |
| Background | `transparent` |
| Text color | `text-txt-faint` |
| Border | `border border-border-standard` |
| Hover | `hover:border-txt-faint hover:text-txt-muted` |
| Dot | `w-1.5 h-1.5 rounded-full bg-txt-faint/40` |

### Overflow Button (+N more)

| Property | Value |
|---|---|
| Class | `.proj-chip .popover-trigger` |
| Style | `bg-raised hover:bg-raised-hover text-txt-secondary border border-border-standard` |
| Font | `text-[10px]` |
| Padding | `px-2.5 py-0.5` |
| Chevron | `w-2.5 h-2.5 text-txt-faint` SVG |
| Action | `togglePicker(popoverId, event)` |

### Preset Dropdown (right side)

| Property | Value |
|---|---|
| Layout | `flex items-center gap-1 px-2 py-0.5 rounded-md` |
| Style | `bg-raised hover:bg-raised-hover cursor-pointer` |
| Text | `text-[10px] text-txt-secondary` → "Show: Active projects" |
| Chevron | `w-2.5 h-2.5 text-txt-faint` |

### Props

```ts
interface ProjectFilterChipsProps {
  selectedIds: string[]           // Currently selected project IDs
  projects: ProjectSummary[]      // All available projects
  pinnedCount?: number            // Max chips visible before overflow (default: 3)
  showAgentCounts?: boolean       // Show agent count badge on chips (Agents view)
  popoverId: string               // Unique ID for the associated popover element
}
```

### Emits

```ts
emit('toggle', projectId: string)   // Toggle a chip on/off
emit('remove', projectId: string)   // Remove (dismiss) a chip
```

---

## Shared Component: `PopoverPanel.vue`

> Reference: [screenshots/06-board-popover.png](screenshots/06-board-popover.png)

### Container

| Property | Value |
|---|---|
| Position | `position: fixed` (computed from trigger button) |
| Width | `w-72` (288px) for multi-select, `w-64` (256px) for single-select |
| Background | `bg-surface` |
| Border | `border border-border-standard` |
| Border-radius | `rounded-xl` (12px) |
| Shadow | `shadow-2xl shadow-black/40` |
| Backdrop | `backdrop-filter: blur(12px)` |
| Z-index | `z-[100]` |
| Animation | `anim-fade-in` on show |

### Positioning Logic

```ts
function positionPopover(triggerEl: HTMLElement, popoverEl: HTMLElement) {
  const rect = triggerEl.getBoundingClientRect()
  popoverEl.style.position = 'fixed'
  popoverEl.style.top = `${rect.bottom + 4}px`
  popoverEl.style.left = `${Math.max(56, rect.left)}px`  // 56 = nav rail width

  // Clamp to viewport if needed
  const popRect = popoverEl.getBoundingClientRect()
  if (popRect.right > window.innerWidth - 8) {
    popoverEl.style.left = `${window.innerWidth - popRect.width - 8}px`
  }
  if (popRect.bottom > window.innerHeight - 8) {
    popoverEl.style.top = `${rect.top - popRect.height - 4}px`
  }
}
```

### Search Input (optional)

| Property | Value |
|---|---|
| Container | `px-3 pt-3 pb-2` |
| Input wrapper | `h-7 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]` |
| Focus | `focus-within:border-ember-500/30` |
| Icon | Search SVG `w-3 h-3 text-txt-faint` |
| Input | `bg-transparent text-[11px] text-txt-primary outline-none w-full` |
| Placeholder | `placeholder:text-txt-faint` |
| Auto-focus | Focus input 50ms after popover opens |

### Preset Buttons (optional)

| Property | Value |
|---|---|
| Container | `px-3 pb-2 flex gap-1.5` |
| Active preset | `text-[10px] px-2 py-0.5 rounded-full bg-ember-500/15 text-ember-400 font-medium` |
| Inactive preset | `text-[10px] px-2 py-0.5 rounded-full text-txt-faint hover:text-txt-muted hover:bg-raised` |
| Options | "Active", "My projects", "All", "None" |

### Grouped List

Items are grouped under section headers (e.g., "Active · 2", "Idle · 48").

#### Section Header

| Property | Value |
|---|---|
| Container | `border-t border-border-subtle` (between sections) |
| Label | `px-3 py-1.5`, `text-[9px] uppercase tracking-widest text-txt-faint` |

#### List Row (multi-select)

| Property | Value |
|---|---|
| Class | `.pop-row` |
| Layout | `flex items-center gap-2.5 px-3 py-1.5 cursor-pointer` |
| Hover | `hover:bg-white/[0.03]` |
| Checkbox | `.pop-check` — `w-3 h-3 rounded-[3px] cursor-pointer` |
| Checkbox accent | `accent-{projectColor}` (e.g., `accent-ember-500`) |
| Color dot | `w-1.5 h-1.5 rounded-full bg-{projectColor}` |
| Name (active) | `text-[11px] text-txt-primary flex-1` |
| Name (idle) | `text-[11px] text-txt-secondary flex-1` |
| Agent badge | `text-[9px] text-teal` (e.g., "2 agents") — only for active projects |
| Overflow | `px-3 py-1.5 text-[10px] text-txt-faint cursor-pointer hover:text-txt-muted` → "... 43 more" |

#### List Row (single-select, Code view)

| Property | Value |
|---|---|
| Selected | `bg-cyan-400/5 border-l-2 border-cyan-400` |
| Checkmark | `w-3 h-3 text-cyan-400` check SVG (only on selected) |
| Unselected | `hover:bg-white/[0.03]` |
| Sub-text | `text-[9px] text-txt-faint ml-1.5` (e.g., "1 repo") |

### Footer (multi-select only)

| Property | Value |
|---|---|
| Container | `border-t border-border-subtle px-3 py-2 flex items-center justify-between` |
| Count | `text-[10px] text-txt-faint` → "2 of 50 selected" |
| Apply button | `text-[10px] px-2.5 py-1 rounded-md bg-ember-500/15 text-ember-400 hover:bg-ember-500/25 font-medium` |

---

## Close Behavior

| Trigger | Action |
|---|---|
| Click outside | Close popover (if click target is not `.proj-popover` or `.popover-trigger`) |
| Press Escape | Close all popovers |
| View switch | Close all popovers |
| Apply button | Close popover, emit selected IDs |

---

## Props Interface

```ts
interface PopoverPanelProps {
  id: string                      // DOM id for positioning
  mode: 'multi' | 'single'       // Multi-select (Board/Agents) or single-select (Code)
  searchable?: boolean            // Show search input (default: true)
  presets?: string[]              // Preset button labels (default: none)
  groups: PopoverGroup[]          // Grouped items
  selectedIds: string[]           // Currently selected item IDs
  footerText?: string             // Footer count text
}

interface PopoverGroup {
  label: string                   // Section header (e.g., "Active · 2")
  items: PopoverItem[]
}

interface PopoverItem {
  id: string
  name: string
  color?: string                  // CSS color for dot
  badge?: string                  // Optional right-side badge text
  subtext?: string                // Optional sub-line text
}
```

### Emits

```ts
emit('select', itemId: string)    // Single-select: select one item
emit('toggle', itemId: string)    // Multi-select: toggle item on/off
emit('apply', selectedIds: string[])  // Multi-select: apply selection
emit('close')                     // Close popover
emit('preset', presetName: string)    // Preset button clicked
```

---

## Filter State Store: `useFilterStore()`

Shared filter state between Board and Agents views.

```ts
const useFilterStore = defineStore('filter', () => {
  const selectedProjectIds = ref<string[]>([])
  const pinnedProjectIds = ref<string[]>([])   // Always-visible chips
  const activePreset = ref<string>('active')

  function toggleProject(projectId: string) { ... }
  function applySelection(ids: string[]) { ... }
  function applyPreset(preset: string) { ... }

  return { selectedProjectIds, pinnedProjectIds, activePreset, toggleProject, applySelection, applyPreset }
})
```

This replaces the current `kanbanProjectIds` in `useUiStore()`.

---

## Migration Steps

1. Create `PopoverPanel.vue` shared component with multi/single-select modes
2. Create `ProjectFilterChips.vue` shared component
3. Create `useFilterStore()` Pinia store
4. Integrate chips + popover into Board header (replace existing filter UI)
5. Integrate chips + popover into Agents header
6. Integrate single-select project picker into Code header
7. Integrate repo picker into Code header
8. Implement click-outside and Escape close handlers
9. Remove `kanbanProjectIds` from `useUiStore()`, migrate to `useFilterStore()`
10. Add positioning logic with viewport clamping
