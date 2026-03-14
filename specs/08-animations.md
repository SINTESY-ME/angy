# 08 — Animations & Transitions

> Pixel reference: [screenshots/05-board-view.png](screenshots/05-board-view.png) (shimmer border, progress ring), [screenshots/07-agents-view.png](screenshots/07-agents-view.png) (wave bars, breathing dots), [screenshots/03-project-card.png](screenshots/03-project-card.png) (card lift, wave bars)

---

## Overview

All keyframe animations, utility classes, and Vue transition specs needed for the prototype's visual effects. These should be added to `src/assets/main.css`.

---

## Keyframe Definitions

### `breathe` — Pulsing opacity for status dots

```css
@keyframes breathe {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
```

| Property | Value |
|---|---|
| Duration | `2.5s` |
| Easing | `ease-in-out` |
| Iteration | `infinite` |
| Used on | Active status dots (teal, ember), scheduler indicator |

---

### `pulse-ring` — Scale/opacity pulse for rings

```css
@keyframes pulse-ring {
  0%   { transform: scale(0.95); opacity: 0.7; }
  50%  { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}
```

| Property | Value |
|---|---|
| Duration | `2s` |
| Easing | `ease-in-out` |
| Iteration | `infinite` |
| Used on | Optional ring effects around active elements |

---

### `wave` — Agent activity wave bars

```css
@keyframes wave {
  0%, 100% { height: 4px; }
  50%      { height: 14px; }
}
```

| Property | Value |
|---|---|
| Duration | `1s` |
| Easing | `ease-in-out` |
| Iteration | `infinite` |
| Stagger | Each bar offset by `0.15s` |

#### Wave Bar Element

```css
.wave-bar {
  width: 3px;
  border-radius: 2px;
  background: #f59e0b;            /* ember (default) */
  animation: wave 1s ease-in-out infinite;
}
.wave-bar:nth-child(2) { animation-delay: 0.15s; }
.wave-bar:nth-child(3) { animation-delay: 0.30s; }
.wave-bar:nth-child(4) { animation-delay: 0.45s; }
.wave-bar:nth-child(5) { animation-delay: 0.60s; }

.wave-bar-teal { background: #10b981; }
```

| Property | Value |
|---|---|
| Bar width | `3px` (default), `2px` in tight spaces |
| Container | `flex items-end gap-[2px] h-3.5` or `h-4` |
| Colors | `.wave-bar` = ember (#f59e0b), `.wave-bar-teal` = teal (#10b981) |

---

### `shimmer-border` — Glowing border on active cards

```css
@keyframes shimmer-border {
  0%   { border-color: rgba(16, 185, 129, 0.25); }
  50%  { border-color: rgba(16, 185, 129, 0.55); }
  100% { border-color: rgba(16, 185, 129, 0.25); }
}
```

| Property | Value |
|---|---|
| Duration | `2s` |
| Easing | `ease-in-out` |
| Iteration | `infinite` |
| Used on | Active epic cards, running sub-agent branches |

---

### `slide-in` — Horizontal slide entrance

```css
@keyframes slide-in {
  from { transform: translateX(-8px); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
```

| Property | Value |
|---|---|
| Duration | `0.3s` |
| Easing | `ease-out` |
| Used on | Agent rows appearing in fleet sidebar |

---

### `fade-in` — Vertical fade entrance

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
```

| Property | Value |
|---|---|
| Duration | `0.35s` |
| Easing | `ease-out` |
| Fill mode | `both` (stays at final state) |
| Used on | Cards, tree nodes, popovers |
| Staggering | Via `animation-delay` in `style` attribute (0.03s increments) |

---

### `ticker-scroll` — Infinite horizontal scroll

```css
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
```

| Property | Value |
|---|---|
| Duration | `30s` |
| Easing | `linear` |
| Iteration | `infinite` |
| Used on | `.ticker-track` in status bar |

The track contains duplicated content. At -50%, the second copy aligns exactly with where the first copy started, creating a seamless loop.

---

## Utility Classes

Add these to `main.css`:

```css
.anim-breathe    { animation: breathe 2.5s ease-in-out infinite; }
.anim-pulse-ring { animation: pulse-ring 2s ease-in-out infinite; }
.anim-shimmer    { animation: shimmer-border 2s ease-in-out infinite; }
.anim-slide-in   { animation: slide-in 0.3s ease-out; }
.anim-fade-in    { animation: fade-in 0.35s ease-out both; }
.ticker-track    { animation: ticker-scroll 30s linear infinite; }
```

---

## Static Transition Classes

### Card Lift (hover elevation)

```css
.card-lift {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
```

Used on: Project cards, New Project card.

### Accent Stripe

```css
.accent-stripe {
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 2px 2px 0;
}
```

Used on: Project cards (left edge color indicator).

### Agent Row

```css
.agent-row {
  transition: all 0.12s ease;
}
.agent-row:hover {
  background: rgba(255, 255, 255, 0.03);
}
.agent-row.selected {
  background: rgba(245, 158, 11, 0.06);
  border-left: 2px solid #f59e0b;
}
```

### Tab Button

```css
.tab-btn {
  transition: color 0.12s, border-color 0.12s;
  border-bottom: 2px solid transparent;
}
.tab-btn.active {
  color: #f59e0b;
  border-bottom-color: #f59e0b;
}
.tab-btn:hover:not(.active) {
  color: #e2e8f0;
}
```

### Effect File Row

```css
.effect-file {
  transition: background 0.1s;
}
.effect-file:hover {
  background: rgba(255, 255, 255, 0.03);
}
```

### Popover Chip

```css
.proj-chip {
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}
.proj-chip:hover {
  filter: brightness(1.15);
}
```

### Tree Branch (collapsible hierarchy)

```css
.tree-branch > .tree-summary {
  list-style: none;
}
.tree-branch > .tree-summary::-webkit-details-marker {
  display: none;
}
.tree-branch[open] > .tree-summary .tree-chevron {
  transform: rotate(90deg);
}
.tree-children {
  transition: opacity 0.15s ease;
}
.tree-branch:not([open]) .tree-children {
  display: none;
}
.tree-node {
  position: relative;
}
```

### Progress Ring

```css
.progress-ring {
  transform: rotate(-90deg);
}
```

Rotates the SVG so the stroke starts from the top (12 o'clock position).

---

## Vue Transition Components

For components that mount/unmount dynamically, use Vue's `<Transition>` wrapper:

### `fade`

```css
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
```

Used on: Popover panels, modals.

### `slide-fade`

```css
.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
```

Used on: View transitions, panel show/hide.

### `list` (staggered)

```css
.list-enter-active {
  transition: all 0.3s ease-out;
}
.list-leave-active {
  transition: all 0.2s ease-in;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
```

Used on: `<TransitionGroup>` for agent lists, file lists.

---

## General Transition Spec

All interactive elements should use `transition: all 0.15s ease` unless a more specific transition is defined. This covers:

- Hover color changes
- Border color changes
- Background color changes
- Opacity changes

---

## Migration Steps

1. Add all `@keyframes` definitions to `main.css` (after the existing rules)
2. Add all utility classes (`.anim-*`, `.card-lift`, `.accent-stripe`, etc.)
3. Add Vue transition CSS classes (`.fade-*`, `.slide-fade-*`, `.list-*`)
4. Wrap dynamic components in `<Transition>` / `<TransitionGroup>` elements
5. Apply `anim-fade-in` with staggered `animation-delay` to lists (cards, tree nodes)
6. Apply `anim-shimmer` to active elements (epic cards, running branches)
7. Apply `anim-breathe` to all active status dots
8. Create `WaveBar.vue` utility component for agent activity indicators
9. Test animations across all views for smoothness and performance
