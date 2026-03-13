# 05 — Code View

> Pixel reference: [screenshots/08-code-view.png](screenshots/08-code-view.png)

---

## Overview

The Code view provides a project-scoped code editor with a file tree, tab bar, breadcrumbs, and a collapsed chat sidebar. The header includes project and repository switcher dropdowns.

**Replaces**: Current editor view (Monaco + splitpanes layout)

---

## Layout

```
┌───────────────────────────────────────────────────────────────┐
│ Code · [●Angy▾] / [</>angy-main▾]              main ●        │  Header: h-12
├──────────┬────────────────────────────────────────┬───────────┤
│          │ [Orchestrator.ts ×] [ProcessManager.ts]│           │
│ Files    │ src › engine › Orchestrator.ts          │   Chat    │
│ Git      │                                        │   (col-   │
│ Find     │  1  import { EventEmitter }...         │   lapsed  │
│          │  2  import { ClaudeProcess }...         │   w-10)   │
│ src/     │  3  ...                                │           │
│  engine/ │                                        │           │
│   ...    │                                        │           │
│          │                                        │           │
│  w-56    │  flex-1                                │           │
└──────────┴────────────────────────────────────────┴───────────┘
```

---

## Header

| Property | Value |
|---|---|
| Height | `h-12` (48px) |
| Background | `bg-window/50` |
| Border | `border-b border-border-subtle` |
| Padding | `px-5` |
| Layout | `flex items-center gap-3 relative` |

### Contents (left to right)

1. **Title**: `text-sm font-semibold text-txt-primary` → "Code"
2. **Separator**: `text-txt-faint` → "·"
3. **Project switcher dropdown**: Clickable button → opens `code-proj-picker` popover
4. **Path separator**: `text-txt-faint text-[10px]` → "/"
5. **Repo switcher dropdown**: Clickable button → opens `code-repo-picker` popover
6. **Spacer**: `flex-1`
7. **Branch indicator**: `text-[10px] text-txt-faint font-mono` → "main"
8. **Branch status dot**: `w-1.5 h-1.5 rounded-full bg-emerald-400`

### Project Switcher Button

| Property | Value |
|---|---|
| Style | `text-[11px] px-2.5 py-1 rounded-lg bg-surface border border-border-standard` |
| Hover | `hover:border-cyan-400/30` |
| Contents | Project color dot (`w-1.5 h-1.5 rounded-full`), project name (`font-medium`), chevron |
| Action | `togglePicker('code-proj-picker', event)` |

### Repo Switcher Button

| Property | Value |
|---|---|
| Style | `text-[11px] px-2.5 py-1 rounded-lg bg-surface border border-border-standard` |
| Hover | `hover:border-ember-500/30` |
| Contents | Code brackets icon (`w-3 h-3`), repo name (`font-mono text-[10px]`), chevron |
| Action | `togglePicker('code-repo-picker', event)` |

### Popover: Project Picker

See [07-popovers.md](07-popovers.md). Single-select variant with:
- Grouped by Active / Idle
- Current selection highlighted with `bg-cyan-400/5 border-l-2 border-cyan-400` + checkmark
- Item shows: color dot, project name, repo count
- Width: `w-64`

### Popover: Repo Picker

| Property | Value |
|---|---|
| Width | `w-60` |
| Header | `text-[9px] uppercase tracking-widest text-txt-faint` → "{Project} · Repositories" |
| Item (selected) | `bg-ember-500/5 border-l-2 border-ember-500`, code icon, repo name (mono), branch + file count, checkmark |
| Item (other) | `hover:bg-white/[0.03]` |

---

## Left Panel — File Tree

| Property | Value |
|---|---|
| Width | `w-56` (224px) |
| Background | `bg-base` |
| Border | `border-r border-border-subtle` |

### Tab Bar

| Property | Value |
|---|---|
| Padding | `px-3 py-2` |
| Border | `border-b border-border-subtle` |
| Tabs | `Files` (active), `Git`, `Find` — using `.tab-btn` class |

### Tree View

| Property | Value |
|---|---|
| Padding | `py-1` |
| Font | `text-[11px] text-txt-secondary` |

#### Tree Node Types

| Type | Icon | Indent | Style |
|---|---|---|---|
| Directory (open) | `▾` text | `px-{3 + depth*3}` | `text-txt-muted` |
| Directory (closed) | `▸` text | Same | `text-txt-muted` |
| File (normal) | `⬦` text | Same | Default |
| File (active) | `⬦` text | Same | `bg-ember-500/5 text-ember-400` |
| File (highlighted) | `⬦` text | Same | `text-cyan-400` |
| File (modified) | — | — | `M` badge: `text-amber-400 text-[9px] ml-auto` |

#### Row Behavior

| Property | Value |
|---|---|
| Row height | `py-0.5` |
| Hover | `hover:bg-raised/50` |
| Click | Opens file in editor tab |

---

## Center Panel — Editor

### Tab Bar

| Property | Value |
|---|---|
| Height | `h-9` |
| Border | `border-b border-border-subtle` |
| Padding | `px-1` |

#### Tab (active)

| Property | Value |
|---|---|
| Style | `px-3 py-1.5 text-[11px] bg-surface text-txt-primary` |
| Active indicator | `border-b-2 border-ember-500` |
| Close button | `text-txt-faint hover:text-txt-muted ml-1` → "×" |

#### Tab (inactive)

| Property | Value |
|---|---|
| Style | `px-3 py-1.5 text-[11px] text-txt-muted hover:text-txt-secondary` |
| Modified dot | `w-1.5 h-1.5 rounded-full bg-amber-400` before close |

### Breadcrumb Trail

| Property | Value |
|---|---|
| Padding | `px-4 py-1` |
| Font | `text-[10px] text-txt-faint` |
| Separator | `›` character |
| Segments | Clickable, `hover:text-txt-muted cursor-pointer` |
| Last segment | `text-txt-muted` (not clickable) |

### Code Area

| Property | Value |
|---|---|
| Font | `font-mono text-[12px] leading-5` (20px line height) |
| Padding | `px-4 py-2` |
| Line numbers | `w-10 text-right pr-3 text-txt-faint/40 select-none` |
| Modified line | `bg-emerald-500/5 border-l-2 border-emerald-500` |
| Implementation | Monaco Editor instance (keep existing integration) |

---

## Right Panel — Collapsed Chat

| Property | Value |
|---|---|
| Width | `w-10` (40px) |
| Background | `bg-base` |
| Border | `border-l border-border-subtle` |
| Hover | `hover:bg-surface` |
| Cursor | `cursor-pointer` |
| Contents | Chat icon (`w-4 h-4 text-txt-faint`) + "Chat" label vertical (`text-[9px] writing-mode: vertical-lr`) |
| Action | Opens chat panel (expands to full chat sidebar) |

---

## Data Binding

| Data | Store |
|---|---|
| Active project | `useUiStore().activeProjectId` |
| Active repo/branch | `useCodeStore().activeRepo` (to be added) |
| File tree | `useCodeStore().fileTree` |
| Open tabs | `useCodeStore().openTabs` |
| Active file | `useUiStore().currentFile` |
| Modified files | `useCodeStore().modifiedFiles` |

---

## Actions

| Action | Trigger | Effect |
|---|---|---|
| Select project | Project picker | Updates `activeProjectId`, reloads repos |
| Select repo | Repo picker | Updates `activeRepo`, reloads file tree |
| Click file | Tree node | Opens in editor tab, updates `currentFile` |
| Close tab | × button | Removes from `openTabs` |
| Open chat | Right panel click | `ui.toggleEditorChat()` |

---

## Migration Steps

1. Add `h-12` header with project/repo switcher dropdowns
2. Integrate project picker popover (shared component, single-select mode)
3. Create repo picker popover
4. Reshape file tree panel to `w-56` with Files/Git/Find tabs
5. Add editor tab bar with active indicator and close buttons
6. Add breadcrumb trail
7. Keep Monaco Editor integration unchanged
8. Add collapsed chat sidebar (`w-10`) on the right
9. Create `useCodeStore()` for repo/file state management
10. Wire project/repo selection to file tree reloading
