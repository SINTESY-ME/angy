# Analytics View — Implementation Plan

## Overview

A new **Analytics** view that provides global and per-project statistics about agent usage, token costs, model distribution, timing, and code impact. It must match the exact design system of every other page (dark theme, ember accent, Inter font, same header/card/panel patterns).

---

## 1. Data Sources

All data is already in `~/.local/share/angy/history.db`. No new tracking is needed.

| Metric | Table(s) | Key Columns |
|--------|----------|-------------|
| Total cost | `cost_log` | `cost_usd`, `timestamp` |
| Token usage | `cost_log` | `input_tokens`, `output_tokens` |
| Model distribution | `epics` | `model` |
| Sessions by mode | `sessions` | `mode`, `created_at` |
| Epic throughput | `epics` | `column`, `started_at`, `completed_at` |
| Rejection rate | `epics` | `rejection_count`, `complexity` |
| Code churn | `file_changes` | `lines_added`, `lines_removed` |
| Time to completion | `epics` | `started_at`, `completed_at`, `complexity` |
| Cost per project | `cost_log` + `epics` + `projects` | join on `epic_id` → `project_id` |
| Scheduler events | `scheduler_log` | `action`, `timestamp` |

---

## 2. Backend — Analytics Methods in `Database.ts`

**No Rust commands needed.** The entire app uses `tauri-plugin-sql` accessed from TypeScript via the `Database` class at `src/engine/Database.ts`. All analytics queries are added there as new methods, exactly like every existing query in the file (`this.db.select<any[]>(sql, params)`).

The singleton is obtained via `getDatabase()` exported from `src/stores/sessions.ts` — the same pattern used by `src/stores/epics.ts` and all other stores.

### TypeScript types to add (top of `Database.ts` or a new `src/engine/AnalyticsTypes.ts`)

```typescript
export interface GlobalSummary {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_sessions: number;
  total_epics: number;
  total_projects: number;
  completed_epics: number;
  active_epics: number;
}

export interface CostByDay {
  day: string;           // "YYYY-MM-DD"
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
}

export interface ModelUsage {
  model: string;
  epic_count: number;
  cost_usd: number;
}

export interface SessionsByMode {
  mode: string;
  session_count: number;
}

export interface EpicThroughput {
  week: string;          // "YYYY-WW"
  started: number;
  completed: number;
}

export interface ComplexityStats {
  complexity: string;
  count: number;
  avg_hours: number;
  avg_cost_usd: number;
  avg_rejection_count: number;
}

export interface ProjectCostSummary {
  project_id: string;
  project_name: string;
  project_color: string;
  total_cost_usd: number;
  epic_count: number;
  completed_epics: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface EpicAnalyticsDetail {
  epic_id: string;
  epic_title: string;
  status: string;
  model: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  lines_added: number;
  lines_removed: number;
  duration_hours: number | null;
  rejection_count: number;
  session_count: number;
}
```

### Methods to add to the `Database` class

```typescript
async getAnalyticsGlobalSummary(): Promise<GlobalSummary> {
  const rows = await this.db.select<any[]>(`
    SELECT
      (SELECT COALESCE(SUM(cost_usd), 0) FROM cost_log) AS total_cost_usd,
      (SELECT COALESCE(SUM(input_tokens), 0) FROM cost_log) AS total_input_tokens,
      (SELECT COALESCE(SUM(output_tokens), 0) FROM cost_log) AS total_output_tokens,
      (SELECT COUNT(*) FROM sessions) AS total_sessions,
      (SELECT COUNT(*) FROM epics) AS total_epics,
      (SELECT COUNT(*) FROM projects) AS total_projects,
      (SELECT COUNT(*) FROM epics WHERE "column" = 'done') AS completed_epics,
      (SELECT COUNT(*) FROM epics WHERE "column" = 'in-progress') AS active_epics
  `);
  return rows[0];
}

async getAnalyticsCostByDay(days: number): Promise<CostByDay[]> {
  return this.db.select<any[]>(`
    SELECT
      DATE(timestamp) AS day,
      SUM(cost_usd) AS cost_usd,
      SUM(input_tokens) AS input_tokens,
      SUM(output_tokens) AS output_tokens
    FROM cost_log
    WHERE timestamp >= DATE('now', $1)
    GROUP BY DATE(timestamp)
    ORDER BY day ASC
  `, [`-${days} days`]);
}

async getAnalyticsModelUsage(): Promise<ModelUsage[]> {
  return this.db.select<any[]>(`
    SELECT
      COALESCE(e.model, 'unknown') AS model,
      COUNT(DISTINCT e.id) AS epic_count,
      COALESCE(SUM(c.cost_usd), 0) AS cost_usd
    FROM epics e
    LEFT JOIN cost_log c ON c.epic_id = e.id
    GROUP BY e.model
    ORDER BY cost_usd DESC
  `);
}

async getAnalyticsSessionsByMode(): Promise<SessionsByMode[]> {
  return this.db.select<any[]>(`
    SELECT mode, COUNT(*) AS session_count
    FROM sessions
    GROUP BY mode
    ORDER BY session_count DESC
  `);
}

async getAnalyticsEpicThroughput(weeks: number): Promise<EpicThroughput[]> {
  return this.db.select<any[]>(`
    SELECT week, SUM(started) AS started, SUM(completed) AS completed FROM (
      SELECT strftime('%Y-W%W', started_at) AS week, 1 AS started, 0 AS completed
      FROM epics WHERE started_at IS NOT NULL AND started_at >= DATE('now', $1)
      UNION ALL
      SELECT strftime('%Y-W%W', completed_at) AS week, 0 AS started, 1 AS completed
      FROM epics WHERE completed_at IS NOT NULL AND completed_at >= DATE('now', $1)
    )
    GROUP BY week ORDER BY week ASC
  `, [`-${weeks * 7} days`]);
}

async getAnalyticsComplexityStats(): Promise<ComplexityStats[]> {
  return this.db.select<any[]>(`
    SELECT
      complexity,
      COUNT(*) AS count,
      AVG(CASE WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
        THEN (julianday(completed_at) - julianday(started_at)) * 24
        ELSE NULL END) AS avg_hours,
      AVG(cost_total) AS avg_cost_usd,
      AVG(rejection_count) AS avg_rejection_count
    FROM epics
    WHERE complexity IS NOT NULL
    GROUP BY complexity
    ORDER BY CASE complexity
      WHEN 'trivial' THEN 1 WHEN 'small' THEN 2 WHEN 'medium' THEN 3
      WHEN 'large' THEN 4 WHEN 'epic' THEN 5 ELSE 6 END
  `);
}

async getAnalyticsProjectSummaries(): Promise<ProjectCostSummary[]> {
  return this.db.select<any[]>(`
    SELECT
      p.id AS project_id, p.name AS project_name, p.color AS project_color,
      COALESCE(SUM(c.cost_usd), 0) AS total_cost_usd,
      COUNT(DISTINCT e.id) AS epic_count,
      COUNT(DISTINCT CASE WHEN e."column" = 'done' THEN e.id END) AS completed_epics,
      COALESCE(SUM(c.input_tokens), 0) AS total_input_tokens,
      COALESCE(SUM(c.output_tokens), 0) AS total_output_tokens
    FROM projects p
    LEFT JOIN epics e ON e.project_id = p.id
    LEFT JOIN cost_log c ON c.epic_id = e.id
    GROUP BY p.id
    ORDER BY total_cost_usd DESC
  `);
}

async getAnalyticsEpicsDetail(projectId: string | null, limit: number, offset: number): Promise<EpicAnalyticsDetail[]> {
  const params: any[] = [limit, offset];
  const projectFilter = projectId ? `AND e.project_id = $3` : '';
  if (projectId) params.push(projectId);
  return this.db.select<any[]>(`
    SELECT
      e.id AS epic_id, e.title AS epic_title, e."column" AS status,
      COALESCE(e.model, 'unknown') AS model,
      COALESCE(SUM(c.cost_usd), 0) AS cost_usd,
      COALESCE(SUM(c.input_tokens), 0) AS input_tokens,
      COALESCE(SUM(c.output_tokens), 0) AS output_tokens,
      COALESCE(SUM(f.lines_added), 0) AS lines_added,
      COALESCE(SUM(f.lines_removed), 0) AS lines_removed,
      CASE WHEN e.started_at IS NOT NULL AND e.completed_at IS NOT NULL
        THEN (julianday(e.completed_at) - julianday(e.started_at)) * 24
        ELSE NULL END AS duration_hours,
      e.rejection_count,
      COUNT(DISTINCT s.session_id) AS session_count
    FROM epics e
    LEFT JOIN cost_log c ON c.epic_id = e.id
    LEFT JOIN sessions s ON s.epic_id = e.id
    LEFT JOIN file_changes f ON f.session_id = s.session_id
    WHERE 1=1 ${projectFilter}
    GROUP BY e.id
    ORDER BY cost_usd DESC
    LIMIT $1 OFFSET $2
  `, params);
}
```

---

## 3. Frontend — File Structure

```
src/components/analytics/
├── AnalyticsView.vue          ← main view (registered in App.vue)
├── AnalyticsHeader.vue        ← header bar with time-range picker + project filter
├── GlobalSummaryCards.vue     ← top row of KPI stat cards
├── CostOverTimeChart.vue      ← line chart: daily cost + tokens
├── ModelUsageChart.vue        ← donut/pie chart: model distribution
├── EpicThroughputChart.vue    ← bar chart: started vs completed per week
├── ComplexityStatsTable.vue   ← table: complexity → avg time, cost, rejections
├── ProjectBreakdownPanel.vue  ← per-project cost bars + epic counts
└── EpicsDetailTable.vue       ← sortable table of individual epics with all metrics

src/stores/analytics.ts        ← Pinia store for all analytics data + loading state
```

---

## 4. Chart Library

Install `chart.js` + `vue-chartjs`:

```bash
npm install chart.js vue-chartjs
```

**Why:** Lightweight (~60KB), works with Vue 3 Composition API, supports line, bar, doughnut charts. No React dependency. Styled via JS options (no CSS conflicts with Tailwind).

Use `vue-chartjs` wrappers (`Line`, `Bar`, `Doughnut` components) with custom chart options that match the dark theme color palette.

**Chart theme config (shared):**
```typescript
// src/components/analytics/chartTheme.ts
export const chartDefaults = {
  backgroundColor: 'transparent',
  color: '#94a3b8',           // --text-secondary
  borderColor: 'rgba(255,255,255,0.08)',  // --border-standard
  gridColor: 'rgba(255,255,255,0.04)',    // --border-subtle
  fontFamily: 'Inter',
  accentColors: [
    '#f59e0b',  // ember
    '#10b981',  // teal
    '#22d3ee',  // cyan
    '#cba6f7',  // mauve
    '#89b4fa',  // blue
    '#FF6B8A',  // rose
  ],
}
```

---

## 5. Navigation Integration

### `src/stores/ui.ts`
- Add `'analytics'` to the `ViewMode` type union
- Add `navigateToAnalytics()` method (same pattern as existing `switchToMode`)

### `src/components/layout/NavRail.vue`
Add a new nav button between the Code icon and the spacer. Pattern identical to existing buttons:

```vue
<button
  class="w-10 h-10 rounded-lg flex items-center justify-center relative transition-all duration-150 ease-in-out"
  :class="ui.viewMode === 'analytics'
    ? 'text-ember-500'
    : 'text-txt-muted hover:text-txt-secondary'"
  title="Analytics"
  @click="ui.switchToMode('analytics')"
>
  <!-- Active indicator stripe -->
  <div
    v-if="ui.viewMode === 'analytics'"
    class="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-[3px] bg-gradient-to-b from-[#f59e0b] to-[#ea580c]"
  />
  <!-- Bar chart icon (SVG) -->
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
</button>
```

### `src/App.vue`
Add render condition (no workspace required — analytics is global):

```vue
<AnalyticsView v-else-if="ui.viewMode === 'analytics'" />
```

Import:
```typescript
import AnalyticsView from './components/analytics/AnalyticsView.vue'
```

---

## 6. Pinia Store — `src/stores/analytics.ts`

Uses `getDatabase()` from `src/stores/sessions.ts` — identical pattern to `src/stores/epics.ts`.
No `invoke` needed; all queries run directly through the `Database` TypeScript class.

```typescript
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getDatabase } from './sessions'
import type {
  GlobalSummary, CostByDay, ModelUsage, SessionsByMode,
  EpicThroughput, ComplexityStats, ProjectCostSummary, EpicAnalyticsDetail
} from '@/engine/AnalyticsTypes'

export const useAnalyticsStore = defineStore('analytics', () => {
  const loading = ref(false)
  const timeRange = ref<'7d' | '30d' | '90d' | 'all'>('30d')
  const selectedProjectId = ref<string | null>(null)

  const globalSummary = ref<GlobalSummary | null>(null)
  const costByDay = ref<CostByDay[]>([])
  const modelUsage = ref<ModelUsage[]>([])
  const sessionsByMode = ref<SessionsByMode[]>([])
  const epicThroughput = ref<EpicThroughput[]>([])
  const complexityStats = ref<ComplexityStats[]>([])
  const projectSummaries = ref<ProjectCostSummary[]>([])
  const epicsDetail = ref<EpicAnalyticsDetail[]>([])

  async function loadAll() {
    loading.value = true
    const db = getDatabase()
    const days = timeRange.value === '7d' ? 7 : timeRange.value === '30d' ? 30 : timeRange.value === '90d' ? 90 : 3650
    await Promise.all([
      db.getAnalyticsGlobalSummary().then(r => globalSummary.value = r),
      db.getAnalyticsCostByDay(days).then(r => costByDay.value = r),
      db.getAnalyticsModelUsage().then(r => modelUsage.value = r),
      db.getAnalyticsSessionsByMode().then(r => sessionsByMode.value = r),
      db.getAnalyticsEpicThroughput(Math.ceil(days / 7)).then(r => epicThroughput.value = r),
      db.getAnalyticsComplexityStats().then(r => complexityStats.value = r),
      db.getAnalyticsProjectSummaries().then(r => projectSummaries.value = r),
      db.getAnalyticsEpicsDetail(selectedProjectId.value, 50, 0).then(r => epicsDetail.value = r),
    ])
    loading.value = false
  }

  watch([timeRange, selectedProjectId], loadAll)

  return {
    loading, timeRange, selectedProjectId,
    globalSummary, costByDay, modelUsage, sessionsByMode,
    epicThroughput, complexityStats, projectSummaries, epicsDetail,
    loadAll,
  }
})
```

---

## 7. View Layout — `AnalyticsView.vue`

```
┌──────────────────────────────────────────────────────┐
│ HEADER  Analytics  ·  30d  [7d][30d][90d][All]       │
│         [All Projects ▼]              [↻ Refresh]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │ $12.40   │ │ 4.2M tok │ │ 142 epics│ │ 3 proj │  │
│  │ Total    │ │ Tokens   │ │ Completed│ │Projects│  │
│  │ Cost     │ │ Used     │ │          │ │        │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘  │
│                                                      │
│  ┌──────────────────────────┐ ┌────────────────────┐ │
│  │ Cost Over Time (line)    │ │ Model Usage (donut)│ │
│  │                          │ │                    │ │
│  └──────────────────────────┘ └────────────────────┘ │
│                                                      │
│  ┌──────────────────────────┐ ┌────────────────────┐ │
│  │ Epic Throughput (bar)    │ │ By Complexity      │ │
│  │ started vs completed/wk  │ │ (table)            │ │
│  └──────────────────────────┘ └────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Project Breakdown (horizontal bars)              ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Epics Detail Table  [sort: cost ▼]               ││
│  │  Title · Model · Cost · Tokens · Lines · Time    ││
│  │  ────────────────────────────────────────────    ││
│  │  rows...                                         ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## 8. Component Details

### `AnalyticsHeader.vue`
- Height: `h-12`, same `bg-window/50 border-b border-border-subtle` as all other headers
- Left: icon + "Analytics" label (`text-sm font-semibold text-txt-primary`) + count summary (`text-xs text-txt-muted`)
- Center: Time range pills `[7d] [30d] [90d] [All]` — active pill uses `bg-raised text-txt-primary`, inactive uses `text-txt-muted hover:text-txt-secondary`
- Right: Project filter dropdown (reuse `ProjectFilterChips` pattern) + refresh button

### `GlobalSummaryCards.vue`
4-column grid of stat cards:
- Background: `bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]`
- Accent colored icon top-left (ember for cost, teal for tokens, cyan for epics, mauve for projects)
- Large value: `text-2xl font-bold text-txt-primary font-mono`
- Label: `text-xs text-txt-muted mt-1`
- Trend indicator: small `+12%` badge in teal/rose

Cards: **Total Cost ($)**, **Tokens Used**, **Epics Completed**, **Avg Time to Complete**, **Sessions Run**, **Rejection Rate**

### `CostOverTimeChart.vue`
- `vue-chartjs` `Line` component
- Two datasets: `cost_usd` (ember line, left Y-axis) + `input_tokens + output_tokens` (cyan dashed, right Y-axis)
- X-axis: dates, Y-axis: $ / tokens
- Grid: `rgba(255,255,255,0.04)`, no border, dark background
- Tooltip: dark bg (`#1c1f2a`), white text, Inter font

### `ModelUsageChart.vue`
- `vue-chartjs` `Doughnut`
- Colors from `accentColors` array (ember, teal, cyan, mauve, blue, rose)
- Center label: "N models"
- Legend: right side, model name + % of epics + total cost

### `EpicThroughputChart.vue`
- `vue-chartjs` `Bar` with grouped bars
- "Started" bars: ember (`#f59e0b` at 60% opacity)
- "Completed" bars: teal (`#10b981`)
- X-axis: week labels, rounded bar corners

### `ComplexityStatsTable.vue`
- Styled HTML table: `bg-surface rounded-xl overflow-hidden border border-border-subtle`
- Columns: Complexity | Count | Avg Duration | Avg Cost | Avg Rejections
- Header row: `text-[10px] text-txt-muted uppercase tracking-wider`
- Rows: `text-xs text-txt-primary`, alternating `bg-base/30`
- Complexity badge: pill with color (trivial=muted, small=cyan, medium=ember, large=orange, epic=rose)

### `ProjectBreakdownPanel.vue`
- One row per project, full-width
- Left: project color dot + name
- Center: horizontal bar (width = % of total cost) in project color with `opacity-70`
- Right: cost value + epic count
- Sort by cost descending

### `EpicsDetailTable.vue`
- Full-width sortable table
- Columns: Epic title | Project | Model | Status | Cost | Input tok | Output tok | Lines +/- | Duration | Rejections
- Sortable headers (click to sort asc/desc, show sort arrow)
- Status as colored pill matching kanban column colors
- Model as monospace badge
- Pagination: "Show 50 / 100 / All" at bottom
- Row click: opens epic in Kanban view (emit navigate event)

---

## 9. Design Rules (must match existing pages)

| Property | Value |
|----------|-------|
| Page background | `bg-[var(--bg-base)]` = `#0f1117` |
| Card/panel bg | `bg-[var(--bg-surface)]` = `#1c1f2a` |
| Card border | `border border-[var(--border-subtle)]` = `rgba(255,255,255,0.04)` |
| Primary text | `text-[var(--text-primary)]` = `#e2e8f0` |
| Secondary text | `text-[var(--text-secondary)]` = `#94a3b8` |
| Muted text | `text-[var(--text-muted)]` = `#64748b` |
| Accent / CTA | `text-[var(--accent-ember)]` = `#f59e0b` |
| Success | `text-[var(--accent-teal)]` = `#10b981` |
| Font | Inter (body), JetBrains Mono (numbers/code) |
| Border radius cards | `rounded-xl` or `rounded-2xl` |
| Section padding | `p-6` or `p-8` content area, `px-5` header |
| Header height | `h-12` |
| Chart bg | transparent (page bg shows through) |
| Scrollbar | thin, dark (already styled in `main.css`) |
| Transitions | `transition-all duration-150` for interactive elements |
| Hover effects | `hover:border-[var(--accent-ember)]/20` on cards |
| Active nav | ember left-border stripe (3px, gradient) |

---

## 10. Implementation Order

1. **`src/engine/AnalyticsTypes.ts`** — define all TypeScript interfaces for query results
2. **`src/engine/Database.ts`** — add 8 analytics query methods using `this.db.select()`
3. **Pinia store** — `src/stores/analytics.ts` using `getDatabase()` pattern
4. **Navigation** — update `ViewMode` type, add NavRail button, add render in `App.vue`
5. **AnalyticsView.vue** — shell layout, header, loading state
6. **GlobalSummaryCards.vue** — first visible content
7. **Install chart.js + vue-chartjs** — `npm install chart.js vue-chartjs`
8. **chartTheme.ts** — shared chart defaults
9. **CostOverTimeChart.vue** — line chart
10. **ModelUsageChart.vue** — doughnut chart
11. **EpicThroughputChart.vue** — bar chart
12. **ComplexityStatsTable.vue** — table
13. **ProjectBreakdownPanel.vue** — horizontal bars
14. **EpicsDetailTable.vue** — full detail table with sorting/pagination
15. **AnalyticsHeader.vue** — time-range picker + project filter wired to store

---

## 11. What Is NOT Tracked (Known Gaps)

These cannot be shown without schema changes (future work, not in scope):

- **Per-model token cost** — `cost_log` doesn't store which model was used for that specific call; model is on the epic. Mixed-model epics would need a JOIN that approximates.
- **Human review time** — time spent in the "review" kanban column is not captured; only `completed_at` is stored.
- **Pass/fail test history** — stored as a JSON blob in `pipeline_state.last_validation_results`, not queryable per-run.
