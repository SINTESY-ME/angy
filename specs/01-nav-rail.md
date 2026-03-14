# 01 — Nav Rail

> Pixel reference: [screenshots/02-nav-rail.png](screenshots/02-nav-rail.png)

---

## Overview

Replace the current `GlobalTopBar.vue` (horizontal top bar) and `StatusBar.vue` bottom nav with a **vertical left nav rail**. This is the primary navigation element, always visible on all views.

---

## Dimensions

| Property | Value |
|---|---|
| Width | `56px` (`w-14`) |
| Background | `bg-base` |
| Border | `border-r border-border-standard` |
| Padding | `py-3` (12px top/bottom) |
| Item gap | `gap-1` (4px) |
| Z-index | `50` |

---

## Layout (top to bottom)

```
┌──────┐
│ Logo │  ← 32x32, rounded-lg, ember gradient
├──────┤
│ Proj │  ← 40x40 rail-btn, data-view="projects"
│ Board│  ← 40x40 rail-btn, data-view="kanban"
│ Agent│  ← 40x40 rail-btn, data-view="agents"
│ Code │  ← 40x40 rail-btn, data-view="code"
│      │
│ flex │  ← flex-1 spacer
│      │
│Search│  ← 40x40, opens command palette
│ Gear │  ← 40x40, opens settings
└──────┘
```

---

## Logo Button

| Property | Value |
|---|---|
| Size | `w-8 h-8` (32x32) |
| Border-radius | `rounded-lg` (8px) |
| Background | `bg-gradient-to-br from-ember-500 to-ember-600` |
| Icon | Lightning bolt SVG, `w-4 h-4`, `fill="currentColor"`, `text-base` |
| Margin | `mb-4` below logo |
| Action | `navigateHome()` — switch to Projects view |

---

## Rail Buttons

| Property | Value |
|---|---|
| Size | `w-10 h-10` (40x40) |
| Border-radius | `rounded-lg` |
| Icon size | `w-5 h-5` (20x20) |
| Icon color (default) | `text-txt-muted` |
| Icon color (hover) | `text-txt-secondary` (`#94a3b8`) |
| Icon color (active) | `text-ember-500` (`#f59e0b`) |
| Transition | `all 0.15s ease` |

### Active Indicator

A `::before` pseudo-element on the button:

| Property | Value |
|---|---|
| Position | `absolute left-0` |
| Vertical extent | `top: 25%; bottom: 25%` |
| Width | `3px` |
| Border-radius | `0 3px 3px 0` |
| Background (inactive) | `transparent` |
| Background (active) | `linear-gradient(to bottom, #f59e0b, #ea580c)` |

---

## Icons (Heroicons, outline, stroke-width 1.5)

| Button | Icon | Stroke path |
|---|---|---|
| Projects | 4-square grid | `M3.75 6A2.25...` (ViewColumns) |
| Board | 3-column kanban | `M9 4.5v15m6-15v15m-10.875...` |
| Agents | Sparkles | `M9.813 15.904...` |
| Code | Code brackets | `M17.25 6.75L22.5 12l-5.25 5.25...` |
| Search | Magnifying glass | `M21 21l-5.197-5.197...` |
| Settings | Gear/cog | `M9.594 3.94...` |

---

## Store Integration

### Current state (to change)

- `useUiStore().viewMode` drives which view is shown
- Current `ViewMode = 'home' | 'kanban' | 'manager' | 'editor' | 'mission-control'`

### Target state

Rename/remap view modes:

| Rail button | `data-view` | Store `viewMode` |
|---|---|---|
| Projects | `projects` | `'home'` |
| Board | `kanban` | `'kanban'` |
| Agents | `agents` | `'manager'` (rename to `'agents'`) |
| Code | `code` | `'editor'` (rename to `'code'`) |

### Actions

```ts
// NavRail.vue
function onRailClick(view: string) {
  const modeMap: Record<string, ViewMode> = {
    projects: 'home',
    kanban: 'kanban',
    agents: 'agents',  // was 'manager'
    code: 'code',       // was 'editor'
  }
  ui.switchToMode(modeMap[view])
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+1` | Switch to Projects |
| `Cmd+2` | Switch to Board |
| `Cmd+3` | Switch to Agents |
| `Cmd+4` | Switch to Code |
| `Cmd+K` | Open Command Palette |

Register via `onMounted` with `document.addEventListener('keydown', ...)`.

---

## Component: `NavRail.vue`

**Replaces**: `GlobalTopBar.vue` navigation portion, `StatusBar.vue` bottom nav buttons

**Location**: `src/components/layout/NavRail.vue`

**Slot in AppShell**: Renders as first child in the root flex row, before the main content area.

### Props

None (reads directly from `useUiStore()`).

### Template Structure

```vue
<nav class="w-14 flex-shrink-0 bg-base border-r border-border-standard flex flex-col items-center py-3 gap-1 z-50">
  <!-- Logo -->
  <!-- 4 view buttons -->
  <!-- flex-1 spacer -->
  <!-- Search button -->
  <!-- Settings button -->
</nav>
```

---

## Migration Steps

1. Create `NavRail.vue` component
2. Update `AppShell.vue` to render `<NavRail />` as first child in root flex row
3. Remove nav buttons from `GlobalTopBar.vue` (keep breadcrumbs/search if needed elsewhere)
4. Remove bottom nav from `StatusBar.vue`
5. Update `ViewMode` type to include `'agents'` and `'code'` (or remap)
6. Register keyboard shortcuts
7. Update `App.vue` `v-if` routing to use new mode names
