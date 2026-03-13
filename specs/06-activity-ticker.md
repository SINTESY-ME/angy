# 06 — Activity Ticker (Status Bar)

> Pixel reference: [screenshots/01-projects-view.png](screenshots/01-projects-view.png) (bottom bar), [screenshots/05-board-view.png](screenshots/05-board-view.png) (bottom bar)

---

## Overview

A fixed bottom bar that shows project build progress badges and a continuously scrolling agent activity ticker. It persists across all views and sits at the bottom of the viewport.

**Replaces**: Bottom portion of current `StatusBar.vue`

---

## Dimensions

| Property | Value |
|---|---|
| Position | `fixed bottom-0` |
| Left offset | `left-14` (56px, clears nav rail) |
| Right | `right-0` |
| Height | `h-7` (28px) |
| Background | `bg-base/90 backdrop-blur-sm` |
| Border | `border-t border-border-subtle` |
| Z-index | `40` |
| Layout | `flex items-center overflow-hidden` |

---

## Left Zone — Build Progress Badges

| Property | Value |
|---|---|
| Layout | `flex items-center gap-3 shrink-0 px-4 mr-3` |
| Border | `border-r border-border-standard pr-4` |

### Badge Structure

One badge per project that has active agents:

```
● PMS-Test-1 building 6/6
● Angy 1/5
```

| Element | Style |
|---|---|
| Container | `flex items-center gap-1.5` |
| Dot | `w-1.5 h-1.5 rounded-full anim-breathe` + project color |
| Text | `text-[10px] text-txt-muted` |

**Text format**: `{project_name} {status}` where status is:
- `building {done}/{total}` (active pipeline)
- `{done}/{total}` (progress fraction)
- `idle` (no active work)

---

## Right Zone — Scrolling Ticker

| Property | Value |
|---|---|
| Container | `flex-1 overflow-hidden` |
| Track | `flex items-center gap-4 whitespace-nowrap` with class `.ticker-track` |

### Ticker Animation

```css
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.ticker-track {
  animation: ticker-scroll 30s linear infinite;
}
```

The track content is **duplicated** (rendered twice) to create a seamless infinite loop. When the first half scrolls out of view, the identical second half takes its place, resetting visually.

### Ticker Item Structure

```
● AgentName  activity text  ·  ● AgentName  activity text  ·  ...
```

| Element | Style |
|---|---|
| Container | `flex items-center gap-1.5 text-[10px]` |
| Status dot | `w-1.5 h-1.5 rounded-full` — `bg-teal anim-breathe` (running), `bg-emerald-400` (done) |
| Agent name | `text-teal` (running) or `text-emerald-400` (done) |
| Activity text | `text-txt-faint` |
| Separator | `text-border-standard` → "·" |
| Summary | `text-[10px] text-txt-faint` → "6 agents active" (appears at end of sequence) |

---

## Data Binding

| Data | Store |
|---|---|
| Project progress | `useEpicStore().projectProgress` — `{ projectId, name, done, total }[]` |
| Agent activities | `useAgentStore().recentActivities` — `{ name, status, activity }[]` |
| Total active count | `useAgentStore().activeCount` |

---

## Component: `StatusTicker.vue`

**Location**: `src/components/layout/StatusTicker.vue`

**Rendered in**: `AppShell.vue`, outside/below the main content area.

### Template Structure

```vue
<div class="fixed bottom-0 left-14 right-0 h-7 bg-base/90 backdrop-blur-sm
            border-t border-border-subtle flex items-center overflow-hidden z-40">
  <!-- Build progress badges -->
  <div class="flex items-center gap-3 shrink-0 px-4 mr-3 border-r border-border-standard pr-4">
    <div v-for="proj in activeProjects" class="flex items-center gap-1.5">
      <div class="w-1.5 h-1.5 rounded-full anim-breathe" :style="{ background: proj.color }"></div>
      <span class="text-[10px] text-txt-muted">{{ proj.name }} {{ proj.progressText }}</span>
    </div>
  </div>
  <!-- Scrolling ticker -->
  <div class="flex-1 overflow-hidden">
    <div class="flex items-center gap-4 whitespace-nowrap ticker-track">
      <!-- First copy -->
      <template v-for="item in tickerItems">
        <span class="flex items-center gap-1.5 text-[10px]">
          <span class="w-1.5 h-1.5 rounded-full" :class="dotClass(item)"></span>
          <span :class="nameClass(item)">{{ item.name }}</span>
          <span class="text-txt-faint">{{ item.activity }}</span>
        </span>
        <span class="text-border-standard">·</span>
      </template>
      <span class="text-[10px] text-txt-faint">{{ activeCount }} agents active</span>
      <span class="text-border-standard">·</span>
      <!-- Second copy (identical, for seamless loop) -->
      <template v-for="item in tickerItems">
        <!-- ... same as above ... -->
      </template>
      <span class="text-[10px] text-txt-faint">{{ activeCount }} agents active</span>
    </div>
  </div>
</div>
```

---

## Interaction

The ticker is purely informational. No click actions. Hovering pauses the animation (optional enhancement):

```css
.ticker-track:hover {
  animation-play-state: paused;
}
```

---

## Migration Steps

1. Create `StatusTicker.vue` component
2. Add to `AppShell.vue` as a fixed-position element
3. Ensure main content area has `pb-7` (28px) to avoid content hidden behind ticker
4. Implement build progress badge rendering from project/epic stores
5. Implement ticker item rendering from agent activity feed
6. Duplicate ticker content for seamless loop animation
7. Add `ticker-scroll` keyframes to `main.css` (see [08-animations.md](08-animations.md))
8. Remove old `StatusBar.vue` bottom section
