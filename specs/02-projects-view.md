# 02 — Projects View

> Pixel reference: [screenshots/01-projects-view.png](screenshots/01-projects-view.png), [screenshots/03-project-card.png](screenshots/03-project-card.png), [screenshots/12-projects-header.png](screenshots/12-projects-header.png)

---

## Overview

The Projects view is the home/landing screen. It shows a greeting, summary stats, and a grid of project cards. Each card displays project metadata, live agent activity, and hover-reveal quick actions.

**Replaces**: Current `HomeView.vue` + `ProjectCard.vue`

---

## Header Bar

> Reference: [screenshots/12-projects-header.png](screenshots/12-projects-header.png)

| Property | Value |
|---|---|
| Height | `h-12` (48px) |
| Background | `bg-window/50` (semi-transparent) |
| Border | `border-b border-border-subtle` |
| Padding | `px-5` |
| Layout | `flex items-center gap-4` |

### Contents (left to right)

1. **Title**: `text-sm font-semibold text-txt-primary` → "Projects"
2. **Count**: `text-xs text-txt-muted` → "5 projects"
3. **Spacer**: `flex-1`
4. **Search trigger**: Clickable div that opens Command Palette

### Search Bar (Command Palette Trigger)

| Property | Value |
|---|---|
| Size | `w-64 h-7` |
| Background | `bg-white/[0.03]` |
| Border | `border border-white/[0.06]` |
| Border-radius | `rounded-lg` |
| Hover | `hover:border-ember-500/30` |
| Contents | Search icon (14px) + placeholder text (11px) + `⌘K` badges |
| Action | `useUiStore().openCommandPalette()` (to be added) |

---

## Greeting Section

| Property | Value |
|---|---|
| Outer padding | `p-8` (32px all sides) |
| Margin below greeting | `mb-8` |
| Animation | `anim-fade-in` |

### Heading

| Property | Value |
|---|---|
| Tag | `<h1>` |
| Font | `text-2xl font-bold text-txt-primary` |
| Margin | `mb-1` |
| Text | Time-based: "Good morning/afternoon/evening" |

### Subtitle

| Property | Value |
|---|---|
| Tag | `<p>` |
| Font | `text-sm text-txt-secondary` |
| Text | `"{n} projects · {n} active agents · {n} epics in progress"` |
| Data | Computed from `useProjectStore()` and `useAgentStore()` |

---

## Card Grid

| Property | Value |
|---|---|
| Layout | `grid grid-cols-3 gap-4` |
| Max width | `max-w-5xl` |
| Contains | Project cards + New Project ghost card |

---

## Project Card

> Reference: [screenshots/03-project-card.png](screenshots/03-project-card.png)

### Outer Container

| Property | Active project | Idle project |
|---|---|---|
| Background | `bg-surface` | `bg-surface` |
| Border-radius | `rounded-2xl` (16px) | `rounded-2xl` |
| Border | `border border-teal/20 anim-shimmer` | `border border-border-subtle` |
| Padding | `p-5` (20px) | `p-5` |
| Cursor | `cursor-pointer` | `cursor-pointer` |
| Hover border | — | `hover:border-ember-500/20` |
| Animation | `anim-fade-in` with staggered delay | Same |
| Overflow | `overflow-hidden relative` | Same |

### Accent Stripe (left edge)

| Property | Value |
|---|---|
| Position | `absolute left-0 top-12px bottom-12px` |
| Width | `3px` |
| Border-radius | `0 2px 2px 0` |
| Color (active) | Project accent color (e.g., `bg-ember-500`, `bg-cyan-400`) |
| Color (idle) | `bg-txt-faint` |

### Content (inside `pl-3` wrapper)

#### Row 1: Icon + Status Badge

| Element | Property | Value |
|---|---|---|
| Icon container | Size | `w-10 h-10` (40x40) |
| | Border-radius | `rounded-xl` (12px) |
| | Background | `{accentColor}/10` (e.g., `bg-ember-500/10`) |
| | Inner SVG | `width="20" height="20"`, project-specific icon |
| Status (active) | Layout | `flex items-center gap-1.5` |
| | Dot | `w-2 h-2 rounded-full bg-teal anim-breathe` |
| | Label | `text-[10px] text-teal font-medium uppercase tracking-wider` → "active" |
| Status (idle) | Label only | `text-[10px] text-txt-faint font-medium uppercase tracking-wider` → "idle" |

#### Row 2: Title

| Property | Value |
|---|---|
| Tag | `<h3>` |
| Font | `text-base font-semibold text-txt-primary` |
| Margin | `mb-1` |
| Hover | `group-hover:text-{accentColor}` (e.g., `group-hover:text-ember-400`) |
| Transition | `transition-colors` |

#### Row 3: Description

| Property | Value |
|---|---|
| Tag | `<p>` |
| Font | `text-xs text-txt-muted` |
| Margin | `mb-4` |
| Truncation | `line-clamp-2` |

#### Row 4: Stats

| Property | Value |
|---|---|
| Layout | `flex items-center gap-4 text-xs text-txt-muted` |
| Repo stat | Layers SVG icon (12x12) + `"{n} repo(s)"` |
| Epic stat | Grid SVG icon (12x12) + `"{n} epic(s)"` |
| Active (if any) | `text-teal` with `w-1.5 h-1.5 rounded-full bg-teal` dot + `"{n} active"` |

#### Row 5: Agent Activity Strip (border-t section)

| Property | Value |
|---|---|
| Margin | `mt-4 pt-3` |
| Border | `border-t border-white/[0.04]` |
| Layout | `flex items-center gap-2` |

**If agents active:**

| Element | Value |
|---|---|
| Avatar stack | `flex -space-x-1.5`, each avatar `w-5 h-5 rounded-md` with gradient bg and initial letter |
| Wave bars | `flex items-end gap-[2px] h-3.5`, 3 bars with `.wave-bar` class |
| Activity text | `text-[10px] text-txt-muted truncate` → e.g., "Builder working on auth middleware..." |

**If idle:**

| Element | Value |
|---|---|
| Text | `text-[10px] text-txt-faint` → "No active agents" |

#### Row 6: Quick Actions (hover only)

| Property | Value |
|---|---|
| Margin | `mt-3` |
| Layout | `flex gap-1.5` |
| Visibility | `opacity-0 group-hover:opacity-100 transition-opacity` |
| Button style | `text-[10px] px-2.5 py-1 rounded-md bg-raised hover:bg-raised-hover text-txt-secondary` |
| Buttons | Board, Agents, Code |
| Run button | `bg-ember/10 hover:bg-ember/20 text-ember ml-auto` (only for active projects) |

### Actions

| Button | Store action |
|---|---|
| Card click | `ui.navigateToProject(projectId)` → opens Kanban for that project |
| Board | `ui.navigateToKanban(projectId)` |
| Agents | `ui.switchToMode('agents')` + set filter |
| Code | `ui.switchToMode('code')` + set active project |
| Run | `epicStore.scheduleNextEpic(projectId)` |

---

## New Project Card

| Property | Value |
|---|---|
| Border | `border-2 border-dashed border-border-standard` |
| Border-radius | `rounded-2xl` |
| Padding | `p-5` |
| Min height | `min-h-[200px]` |
| Layout | `flex flex-col items-center justify-center gap-3` |
| Hover | `hover:border-ember-500/30` |
| Icon | Plus SVG in `w-10 h-10 rounded-xl bg-white/[0.04]` |
| Label | `text-sm text-txt-faint` → "New Project" |
| Action | Opens project creation dialog |

---

## Data Sources

| Data | Store |
|---|---|
| Project list | `useProjectStore().projects` |
| Agent count per project | `useAgentStore().agentsByProject` |
| Active epic count | `useEpicStore().activeEpicsByProject` |
| Greeting time | Computed from `new Date().getHours()` |

---

## Migration Steps

1. Redesign `HomeView.vue` layout: remove old grid, add greeting section with `p-8`
2. Rewrite `ProjectCard.vue` with new prop interface: `project`, `agents`, `activeEpicCount`
3. Add accent stripe, icon container, status badge, stats row with SVG icons
4. Add agent activity strip with avatar stack and wave bars
5. Add hover quick-action overlay with opacity transition
6. Create `NewProjectCard.vue`
7. Add greeting text computation (time-of-day)
8. Wire search bar to command palette action
9. Add staggered `animation-delay` via `:style` binding based on card index
