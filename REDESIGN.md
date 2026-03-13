# Angy UI Redesign Plan

## Diagnosis

After inspecting every component, page, and CSS rule, these are the root causes of the "not-quite-professional" feel:

1. **No spatial system** — padding/margins/heights are ad-hoc (h-7, h-8, h-10, h-11 across bars; px-3, px-4, px-5, px-8 across panels)
2. **Chaotic type scale** — seven font sizes (9/10/10.5/11/12/13/18px) with no clear hierarchy
3. **Inconsistent component shapes** — ProjectCard is `rounded-xl`, EpicCard is `rounded-lg`, AgentCard is `rounded-md`, ToolCallGroup is `rounded-[12px]`
4. **Too many accent colors competing at once** — mauve, teal, green, blue, peach all appear in the same viewport
5. **No depth/elevation system** — everything is flat; panels, cards, popovers all sit on the same visual plane
6. **Redundant navigation** — breadcrumbs in top bar + tab buttons in bottom bar = two competing wayfinding systems
7. **Cramped touch targets** — 10px labels, h-7 status bar, 9px uppercase card actions
8. **Badge soup** — EpicCard stacks 6+ badges in a tiny space
9. **Emoji icons in tips** — breaks the professional tone
10. **No motion language** — transition durations are random (0.12s, 0.15s, 0.2s, 0.3s)

---

## Phase 1: Design Tokens & Foundations

### 1.1 — Spacing scale in `main.css`

Add a 4px-based spacing scale as CSS custom properties. Every padding, margin, gap, and height in the app must use one of these values.

```css
:root {
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 1.2 — Type scale in `main.css`

Replace the current chaos with exactly 5 named sizes. Remove every raw `text-[Xpx]` class from every component and replace with these:

```css
:root {
  --text-xs: 11px;     /* badges, timestamps, meta */
  --text-sm: 12px;     /* secondary content, labels */
  --text-base: 13px;   /* body text, input fields */
  --text-md: 14px;     /* card titles, section headers */
  --text-lg: 16px;     /* page titles, dialog headers */
}
```

**Files to change:** Every `.vue` file that uses `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`. The minimum readable size is 11px. Kill all 9px and 10px usage.

### 1.3 — Elevation system in `main.css`

Add 3 shadow levels to create depth:

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.35);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.4);
}
```

- **Level 0**: flat surfaces (column backgrounds, base) — no shadow
- **Level 1**: cards (ProjectCard, EpicCard, AgentCard, ToolCallGroup) — `var(--shadow-sm)`
- **Level 2**: popovers, dropdowns, context menus — `var(--shadow-md)`
- **Level 3**: modals, dialogs — `var(--shadow-lg)`

### 1.4 — Border radius tokens in `main.css`

Standardize to exactly 3 values:

```css
:root {
  --radius-sm: 6px;    /* badges, pills, small buttons */
  --radius-md: 10px;   /* cards, inputs, panels */
  --radius-lg: 16px;   /* dialogs, modals, input bar container */
}
```

**Files to change:** ProjectCard, EpicCard, AgentCard, ToolCallGroup, InputBar, ChatMessage (.user-card), all dialogs, context menus. Every component uses `var(--radius-md)` unless it's a badge (sm) or modal (lg).

### 1.5 — Transition timing in `main.css`

One duration, one easing. Replace all `transition-colors`, `transition-all`, `transition-opacity` custom durations:

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
}
```

All hover/focus transitions use `--transition-fast`. Layout/panel transitions use `--transition-normal`. Remove every inline `0.12s`, `0.15s`, `0.2s`, `0.3s`.

---

## Phase 2: Layout Structure

### 2.1 — Unify the chrome bars

**Problem:** Top bar is h-10 (40px), bottom bar is h-7 (28px). Two different navigation paradigms.

**Action in `GlobalTopBar.vue`:**
- Height: `h-9` (36px) — compromise between current values
- Left: Logo + breadcrumbs (keep as-is but bump separator `›` to `text-[var(--text-xs)]`)
- Center: Remove the absolute-positioned actions slot. Move contextual actions to the right side of the top bar, before the settings icon
- Right: Scheduler dot + view toggle + settings gear (keep)

**Action in `StatusBar.vue`:**
- Height: `h-8` (32px) — up from h-7
- Left: Keep navigation tabs (Projects/Kanban/Agents/Code) but increase size from `text-[10px]` to `text-[var(--text-xs)]` (11px) and increase hit target to `px-2.5 py-1`
- Center: Pipeline activity (keep)
- Right: Panel toggles (Effects/Chat) + model name
- Remove the separator `div.w-px.h-3` — use `gap-4` between nav group and contextual info instead

### 2.2 — Standardize panel headers

Every panel header must follow this pattern. Currently they vary wildly:
- FleetHeader: h-8, `text-[10px]` uppercase
- EffectsPanel header: h-11, `text-[10px]` uppercase
- MainSplitter left tabs header: h-11 with back button
- EpicDetailPanel header: py-3

**Unified pattern (apply to all):**
```
height: h-10 (40px)
padding: px-4
background: var(--bg-surface)
border-bottom: 1px solid var(--border-subtle)
title: text-[var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--text-muted)]
```

**Files to change:**
- `FleetHeader.vue` — change h-8 to h-10, add border-b
- `EffectsPanel.vue` — change h-11 to h-10
- `MainSplitter.vue` — change h-11 to h-10 for left tab header
- `MainSplitter.vue` — change h-8 to h-10 for effects/graph tab header
- `EpicDetailPanel.vue` — change py-3 to explicit h-10 with flex items-center

### 2.3 — Splitpane dividers

**In `main.css`:** Increase splitter from 1px to 2px for better grab target. Add a subtle hover transition:

```css
.splitpanes--vertical > .splitpanes__splitter {
  width: 2px !important;
  min-width: 2px !important;
  transition: background-color var(--transition-fast);
}
.splitpanes--horizontal > .splitpanes__splitter {
  height: 2px !important;
  min-height: 2px !important;
  transition: background-color var(--transition-fast);
}
```

---

## Phase 3: Home View (Projects Page)

### 3.1 — ProjectCard redesign

**File: `ProjectCard.vue`**

Current problems: rounded-xl is too bubbly, bottom action bar icons with 9px uppercase labels are unreadable, the 4-way action split feels like a mobile UI.

**Changes:**
- Border radius: `rounded-[var(--radius-md)]` (10px)
- Add `shadow: var(--shadow-sm)` on idle, `var(--shadow-md)` on hover
- Remove the bottom action bar entirely (the `div.border-t` with KANBAN/CODE/FLEET/INSTANCE buttons)
- The entire card is clickable and navigates to Kanban (keep existing `@click`)
- Add a hover overlay effect: on hover, show a single row of 3 icon buttons (Kanban, Code, Fleet) in the bottom-right corner, positioned absolutely, with `opacity-0 group-hover:opacity-100`
- Remove the "Instance" button — the active project indicator (teal border) is sufficient
- Increase description from `text-[11px]` to `text-[var(--text-xs)]` (11px — same value but tokenized)
- Increase stats from `text-[10px]` to `text-[var(--text-xs)]`
- Replace the settings gear with a `...` (three-dot) menu button that appears on hover, top-right

### 3.2 — "New Project" card

**File: `HomeView.vue`**

- Match the new ProjectCard radius and min-height
- Change dashed border from `border-subtle` to `border-standard` for visibility
- Add `text-[var(--text-sm)]` (12px) for the label instead of `text-xs`

### 3.3 — "Open Workspace" button

**File: `HomeView.vue`**

- Move from right-aligned to left-aligned in the header row (it's a secondary action, not the primary CTA)
- Reduce visual weight: remove the border, use ghost style: `text-[var(--text-muted)] hover:text-[var(--text-primary)]`
- Keep the folder icon but remove the two-line text layout. Single line: "Open Workspace"
- Remove the `InfoTip` next to it — it's over-explaining

---

## Phase 4: Kanban Board

### 4.1 — Column headers

**File: `KanbanColumn.vue`**

- Increase minimum column width from `min-w-[160px]` to `min-w-[200px]`
- Column header: replace `border-b-2` colored line with a colored `w-1 h-4 rounded-full` dot before the label. The thick colored bottom borders create visual noise across 7 columns
- Count badge: keep as-is but use `text-[var(--text-xs)]`
- Empty column descriptions: change from `text-[10px]` to `text-[var(--text-xs)]`, remove `italic`

### 4.2 — EpicCard cleanup

**File: `EpicCard.vue`**

Current problem: Each card displays priority badge + complexity badge + status indicator + chain indicator + agent count + repo tags + branch name + move arrows. This is visual overload.

**Changes:**
- Border radius: `rounded-[var(--radius-md)]`
- Add `box-shadow: var(--shadow-sm)`
- **Reduce badge row to max 3 items:** Show only priority + status indicator + agent count. Move complexity, chain, repo tags into the detail panel only
- Remove the `text-[9px]` repo tag badges entirely from the card face
- Branch name: hide from card face. It's visible in the detail panel
- Move arrows (left/right): keep on hover, but increase from `p-0.5` to `p-1` for better click target
- Increase card padding from `px-2 py-2` to `px-3 py-2.5`
- Title: `text-[var(--text-base)]` (13px) instead of `text-sm` (14px — too large for a card)

### 4.3 — EpicDetailPanel polish

**File: `EpicDetailPanel.vue`**

- Width: keep 480px
- Add `box-shadow: var(--shadow-lg)` to the panel (it slides over content, should feel elevated)
- Section headers ("Definition", "Configuration", "Scheduling"): keep uppercase tracking-wider style but use `text-[var(--text-xs)]`
- Form labels: change from `text-[11px]` to `text-[var(--text-xs)]`
- Pipeline type buttons: increase from `text-[10px]` to `text-[var(--text-xs)]` and `py-1.5` to `py-2`
- Complexity description: change from `text-[10px]` to `text-[var(--text-xs)]`
- Footer Save/Delete buttons: increase from `text-xs py-1.5` to `text-[var(--text-sm)] py-2`

### 4.4 — KanbanToolbar

**File: `KanbanToolbar.vue`**

- Remove the "Back" button with chevron — navigation already exists in the bottom StatusBar and top breadcrumbs
- Keep: project name, filter input, Add Epic button, Schedule Now, git tree icon, settings icon
- Add Epic button: keep mauve filled style but increase to `py-1.5` for better click target
- Schedule Now: rephrase to just "Schedule" — shorter label

---

## Phase 5: Agent Fleet & Chat

### 5.1 — AgentCard visual rhythm

**File: `AgentCard.vue`**

- Border radius: `rounded-[var(--radius-md)]`
- Selected state: replace the teal border + box-shadow combo with a simpler `bg-[var(--bg-raised)] border-l-2 border-[var(--accent-teal)]` (left accent bar, like Slack/Discord active channel)
- Remove the `intensity wash` background effect (the `intensityWashColor` computed). It creates subtle visual noise that doesn't communicate clearly. Replace with: working agents get a static `bg-[color-mix(in srgb, var(--accent-green) 6%, transparent)]`
- Status dot: increase from 6px idle / 8px active to 7px idle / 9px active
- Title: `text-[var(--text-base)]` (13px) — already correct, but tokenize it
- Subtitle (activity/timestamp): `text-[var(--text-xs)]` (11px) — up from current 11px but tokenized
- Cost badge: `text-[var(--text-xs)]` — up from `text-[11px]` but tokenized
- Pipeline badge: change from `text-[10px]` to `text-[var(--text-xs)]`
- The connector lines for child agents: keep but increase from `w-px` to `w-[1.5px]` and use `border-standard` color

### 5.2 — FleetHeader

**File: `FleetHeader.vue`**

- Apply unified panel header pattern from 2.2
- Add a `+` (new agent) button next to the `...` menu. Currently there's no visible new-agent button in the fleet header — users must know `Cmd+N`
- The `+` button: `w-7 h-7 rounded-md bg-[var(--accent-mauve)] text-white flex items-center justify-center`

### 5.3 — ChatMessage refinement

**File: `ChatMessage.vue`**

- **User card:** Change `border-left: 3px` to `border-left: 2px` — 3px is heavy. Change `border-radius: 10px` to `var(--radius-md)`. Change padding from `12px 16px 10px` to `var(--space-3) var(--space-4)`
- **Claude avatar:** Increase from 18px to 22px circle. Change background from `var(--accent-mauve)` to `var(--bg-raised)` with a subtle `border: 1px solid var(--border-standard)`. Letter "C" in `var(--accent-mauve)` color instead of dark background. This is less heavy visually
- **"CLAUDE" label:** Remove the `tracking-widest uppercase` — it's too loud. Replace with just `Claude` in `text-[var(--text-xs)] font-medium text-[var(--text-secondary)]` (normal case)
- **Markdown tables:** Change `font-size: 12px` to `font-size: var(--text-sm)` (same 12px, tokenized)
- **Code blocks:** Keep styling, it's good

### 5.4 — ToolCallGroup

**File: `ToolCallGroup.vue`**

- Remove the inline `style=""` attributes and convert to Tailwind classes using CSS variables
- Border radius: `var(--radius-md)` (was hardcoded 12px)
- Change the Unicode tool icons (✎, ✐, ◧, ⌘, ⊛, ⊚, ⊕, ☐, ◎) to a consistent SVG icon set or remove them entirely and rely on the tool name bold text. The Unicode symbols render inconsistently across platforms
- Expand/collapse arrow: change from `▼`/`▶` Unicode to a proper SVG chevron for consistency with the rest of the app
- Summary text: change from `text-[11px]` to `text-[var(--text-xs)]`
- Diff view lines: change from `text-[11px]` to `text-[var(--text-xs)]`

### 5.5 — InputBar

**File: `InputBar.vue`**

- Container border: change from `border-2 transparent` to `border border-[var(--border-subtle)]`. The 2px transparent border that becomes teal on drag feels hacky
- On focus: `border-[var(--border-standard)]` (subtle brightening, not a color change)
- Send button: keep mauve filled style. Increase from `px-4 py-1.5` to `px-5 py-2` for a more confident CTA
- Stop button: keep red style but match the Send button sizing
- Character count: move from `text-[10px]` to `text-[var(--text-xs)]`
- Footer selectors (Agent/Model/Profile): these render at `text-[10px]` inside ModeSelector/ModelSelector/ProfileSelector. All need to become `text-[var(--text-xs)]` with `py-1` minimum hit target

### 5.6 — WelcomeScreen

**File: `WelcomeScreen.vue`**

- "Start a conversation" heading: change to "What would you like to build?" — more action-oriented
- Increase heading from `text-lg` (18px) to `text-[20px]` with `font-bold`
- Quick-start suggestions: make them clickable buttons that pre-fill the input bar, not static spans. On hover: `border-[var(--accent-mauve)] text-[var(--text-primary)]`
- Keyboard hints: keep, but increase from `text-[11px]` to `text-[var(--text-xs)]` (same but tokenized)
- Remove the SectionTip about orchestrate — it adds noise to the welcome screen

---

## Phase 6: Effects & Sidebar Panels

### 6.1 — EffectsPanel empty state

**File: `EffectsPanel.vue`**

- Increase the file icon from `w-6 h-6` to `w-10 h-10`
- "No changes yet" text: `text-[var(--text-sm)]` (12px) instead of `text-[11px]`
- "File edits will appear..." text: `text-[var(--text-xs)]` instead of `text-[10px]`
- Remove the `SectionTip` from empty state — it's redundant when the empty state text already explains the panel

### 6.2 — Scope toggle button

**File: `EffectsPanel.vue`**

- Change from a text button ("Session" / "All") to a segmented control: two side-by-side buttons with active state, matching the Effects/Graph tab switcher style

### 6.3 — WorkspaceTree / TreeNode

**Files: `WorkspaceTree.vue`, `TreeNode.vue`**

- Ensure all file names use `text-[var(--text-xs)]` (11px minimum)
- Tree node indent: ensure consistent 16px per level (verify `TreeNode.vue` uses `--space-4` multiples)

---

## Phase 7: Dialogs & Modals

### 7.1 — Unified modal backdrop and container

Apply to: `NewProjectDialog.vue`, `ProjectSettingsDialog.vue`, `SettingsDialog.vue`, `OrchestratorDialog.vue`, `SchedulerConfigDialog.vue`, `GitTreeDialog.vue`, `MergeEpicsDialog.vue`, `ProfileEditor.vue`

**Backdrop:** `bg-black/60 backdrop-blur-sm` (add blur to all, currently missing on some)

**Container:**
- `rounded-[var(--radius-lg)]` (16px)
- `box-shadow: var(--shadow-lg)`
- `border: 1px solid var(--border-subtle)`
- Max width: 480px for forms, 640px for settings
- Consistent padding: `p-6` for body, `px-6 py-4` for header, `px-6 py-4` for footer

### 7.2 — Context menus

**Files: `AgentCard.vue` context menu, `FleetHeader.vue` dropdown**

- `rounded-[var(--radius-md)]` (10px) — up from rounded-md (6px)
- `box-shadow: var(--shadow-md)`
- Menu items: `py-2 px-4` (up from `py-1.5 px-3`) for better click targets
- Menu item text: `text-[var(--text-sm)]` (12px) instead of `text-xs`
- Add 2px rounded-md hover background on items

---

## Phase 8: Color Discipline

### 8.1 — Reduce simultaneous accent colors

**Rule:** Any single view should use a maximum of 3 accent colors:
- **Primary action:** mauve (buttons, active states, primary CTA)
- **Success/active:** green (running, done, branch names, diffs)
- **Contextual:** one more per-view (teal for selection, blue for info, red for errors)

**Specific changes:**
- Scrollbar thumb: change from `--accent-teal` to `--accent-mauve` to match the primary accent
- Selected agent card: change teal accent to mauve (matches the app's primary color)
- "Back to Chat" link in MainSplitter: change from `--accent-teal` to `--accent-mauve`
- Editor "AGM" back link: change from `--accent-teal` to `--accent-mauve`
- The input bar drag-over state: change teal to mauve

### 8.2 — Kanban column colors

Keep the per-column color coding (it's functional), but reduce saturation by using `color-mix` at 60% instead of raw accent colors for the header dots. This prevents the rainbow effect.

---

## Phase 9: SectionTip De-emoji

### 9.1 — Replace emoji icons

**File: `SectionTip.vue`**

- Remove the `icon` prop's emoji rendering
- Replace with a single consistent SVG info icon (a circle with "i") in `var(--accent-blue)`
- Remove the icon prop from all call sites:
  - `HomeView.vue`: remove `icon="🚀"`
  - `KanbanView.vue`: remove `icon="📋"`
  - `ChatPanel.vue`: remove `icon="⚡"`
  - `EffectsPanel.vue`: remove `icon="📝"`
  - `AgentFleetPanel.vue`: remove `icon="🤖"`
  - `WelcomeScreen.vue`: remove `icon="💡"`

---

## Phase 10: Micro-interactions & Polish

### 10.1 — Card hover states

All cards (ProjectCard, EpicCard, AgentCard) on hover:
- Translate up 1px: `hover:-translate-y-px`
- Shadow increase: `var(--shadow-sm)` to `var(--shadow-md)`
- Transition: `var(--transition-fast)`

### 10.2 — Button press feedback

All buttons: add `active:scale-[0.98]` for a subtle press effect.

### 10.3 — Loading spinner consistency

The current spinner in `ChatPanel.vue` uses `border-2 border-[var(--accent-teal)] border-t-transparent`. Standardize all spinners to use `--accent-mauve` (primary color).

### 10.4 — Focus ring consistency

**File: `main.css`**

Change focus-visible from `outline: 1px solid var(--accent-mauve)` to `outline: 2px solid var(--accent-mauve)` with `outline-offset: 2px`. The current 1px ring is hard to see.

---

## Execution Order

The phases above are ordered by dependency. Execute them in order:

1. **Phase 1** first — tokens must exist before components can reference them
2. **Phase 2** next — layout structure sets the frame
3. **Phases 3-7** can be done in parallel per-view
4. **Phases 8-10** are sweeping changes applied last

Each phase is independently shippable. The app will improve incrementally with each phase.
