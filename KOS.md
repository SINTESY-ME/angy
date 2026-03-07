# KOS — Kanban Orchestration System

## What This Is

KOS replaces the flat agent-fleet panel with a **Kanban board** that treats software goals
as cards flowing through columns: **Idea → Backlog → Todo → In Progress → Review → Done**.
An **AI-powered Scheduler** decides execution order. Each card in "In Progress" is a live
orchestrator session with its own git worktree. "Review" is human-in-the-loop approval.
"Done" merges to master.

This is not a wrapper around agents. It is the **missing project-management layer** on top
of the orchestration engine — the layer that answers "what should be built next, and in
what order?" rather than just "how do we build this one thing?"

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────┐
│  IDEA   │→ │ BACKLOG │→ │  TODO   │→ │ IN PROGRESS │→ │  REVIEW  │→ │  DONE   │
│         │  │         │  │         │  │             │  │          │  │         │
│ raw     │  │ refined │  │ priori- │  │ orchestrator│  │ human    │  │ merged  │
│ ideas   │  │ with    │  │ tized,  │  │ session     │  │ approval │  │ into    │
│         │  │ spec    │  │ ready   │  │ running     │  │ gate     │  │ master  │
└─────────┘  └─────────┘  └─────────┘  └─────────────┘  └──────────┘  └─────────┘
                              ↑                               │
                              └───────── REJECTED ────────────┘
```

---

## Why We Are Building This

**The bottleneck has shifted.** With the orchestrator, we can already break down a goal,
delegate to specialists, validate, and merge. But we manage one goal at a time. We manually
decide what to work on next. There is no queue, no priority system, no dependency awareness.

Current tools (Vibe Kanban, KaibanJS, Linear+agents, Jira+agents) offer kanban boards for
agents, but **none have an intelligent scheduler.** They are all manual — the human drags
cards and assigns agents. The scheduler is the human.

KOS fills this gap:

1. **Multi-epic parallelism** — Run N epics simultaneously, each isolated in its own worktree.
2. **AI Scheduler** — Reasons about priority, dependencies, complexity, and cost to decide
   what executes next. Humans set hints; the scheduler makes the call.
3. **Human-in-the-loop review** — No code reaches master without human approval. The review
   column is a mandatory gate, not optional.
4. **Dependency-aware execution** — Epic B depends on Epic A? The scheduler waits for A to
   reach Done before starting B.
5. **Rejection loop** — Reviewer sends an epic back to Todo with notes. The scheduler picks
   it up again with the feedback context.

---

## Data Model

### Epic

The atomic unit of work on the board. Maps 1:1 to an orchestrator session when in progress.

```typescript
export type EpicColumn = 'idea' | 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type PriorityHint = 'critical' | 'high' | 'medium' | 'low';
export type ComplexityEstimate = 'trivial' | 'small' | 'medium' | 'large' | 'epic';
export type ReviewResult = 'approved' | 'changes-requested' | 'rejected';

export interface Epic {
  id: string;                          // UUID
  title: string;                       // Short name (shown on card)
  description: string;                 // Full spec / goal (markdown)
  column: EpicColumn;
  position: number;                    // Sort order within column

  // Priority
  priorityHint: PriorityHint;         // Human hint
  priorityScore: number;              // 0–100, computed by scheduler
  priorityReason: string;             // Scheduler's explanation

  // Metadata
  stack: string[];                     // Tech tags: ['vue', 'rust', 'sqlite']
  acceptanceCriteria: string[];        // Checklist for review
  complexity: ComplexityEstimate;

  // Dependencies
  dependsOn: string[];                 // Epic IDs that must be Done first
  blockedBy: string[];                 // Computed: subset of dependsOn not yet Done

  // Orchestration link (populated when column = 'in-progress')
  sessionId: string | null;            // Linked orchestrator session
  worktreeBranch: string | null;       // Git branch: kos/<epicId>

  // Review
  reviewNotes: string;                 // Human reviewer notes
  reviewResult: ReviewResult | null;
  reviewedAt: number | null;
  rejectionCount: number;              // How many times sent back

  // Lifecycle
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;            // When moved to in-progress
  completedAt: number | null;          // When moved to done
  mergeCommit: string | null;          // Commit hash after merge to master

  // Cost tracking
  totalCostUsd: number;
  totalTokens: number;
  totalDelegations: number;
}
```

### SchedulerConfig

Controls how the scheduler reasons about the backlog.

```typescript
export interface SchedulerConfig {
  maxConcurrentEpics: number;          // How many in-progress at once (default: 3)
  costBudgetUsd: number | null;        // Optional cost ceiling per epic
  autoSchedule: boolean;               // If false, scheduler suggests but doesn't execute
  profiles: string[];                  // Context profile IDs for orchestrator sessions

  // Priority weight tuning (all 0–1, must sum to 1)
  weights: {
    manualHint: number;                // Weight of human priority hint (default: 0.4)
    dependencyDepth: number;           // Prefer epics that unblock others (default: 0.25)
    age: number;                       // Older items get priority boost (default: 0.15)
    complexity: number;                // Prefer smaller items for throughput (default: 0.1)
    rejectionPenalty: number;          // Deprioritize frequently rejected epics (default: 0.1)
  };
}
```

---

## Architecture

### How KOS Integrates With What We Have

KOS does not replace the existing system. It wraps it with a planning layer.

```
                    ┌──────────────────────────────┐
                    │         KOS Layer             │
                    │                               │
                    │  EpicStore ←→ Scheduler        │
                    │       ↓                       │
                    │  KanbanView (new view mode)    │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │     Existing Engine            │
                    │                               │
                    │  Orchestrator ←→ ChatPanel     │
                    │  SessionManager ←→ Database    │
                    │  WorktreeManager (SUP_ORC)     │
                    │  FleetStore ←→ AgentGraph      │
                    └───────────────────────────────┘
```

**Integration points:**

| KOS concept | Maps to existing code |
|---|---|
| Epic in "in-progress" | `Orchestrator.start(epic.description)` — new orchestrator session |
| Epic's worktree branch | `WorktreeManager.create(epicId, 'root')` — isolated branch |
| Epic's agent tree | `FleetStore.hierarchicalAgents` filtered by `epic.sessionId` |
| Epic's chat | `SessionsStore.selectSession(epic.sessionId)` — existing chat view |
| Epic moved to "done" | `WorktreeManager.merge()` to master + cleanup |
| Epic card click | Opens agent fleet + chat for that epic (existing views) |

### New View Mode

Add `'kanban'` to the existing `viewMode: 'manager' | 'editor' | 'mission-control'`:

```typescript
// ui.ts store
viewMode: 'manager' | 'editor' | 'mission-control' | 'kanban'
```

The kanban view replaces the main content area. Clicking an in-progress epic card switches
to manager view filtered to that epic's session tree.

---

## Component Design

### KanbanView.vue

The top-level kanban board component. Renders 6 columns with draggable cards.

```
┌─ KanbanView ──────────────────────────────────────────────────────────┐
│                                                                       │
│  ┌─ KanbanToolbar ─────────────────────────────────────────────────┐  │
│  │ [+ New Epic]  [Schedule Now]  [Scheduler: Auto/Manual]  [⚙]    │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─ KanbanColumn ─┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐    │
│  │ Idea (3)       │ │Backlog(5)│ │ Todo (2) │ │ In Progress(1) │... │
│  │                │ │          │ │          │ │                │    │
│  │ ┌─ EpicCard ─┐ │ │          │ │          │ │ ┌─ EpicCard ─┐│    │
│  │ │ Title      │ │ │          │ │          │ │ │ ████░░ 60% ││    │
│  │ │ [vue][ts]  │ │ │          │ │          │ │ │ 3 agents   ││    │
│  │ │ low        │ │ │          │ │          │ │ │ $0.42      ││    │
│  │ └────────────┘ │ │          │ │          │ │ └────────────┘│    │
│  └────────────────┘ └──────────┘ └──────────┘ └──────────────┘    │
│                                                                       │
│  ┌─ EpicDetailPanel (right drawer, shown when epic selected) ──────┐  │
│  │ Title, description editor                                        │  │
│  │ Stack tags, acceptance criteria                                  │  │
│  │ Priority hint selector                                           │  │
│  │ Dependencies picker                                              │  │
│  │ Agent tree (if in-progress) → link to chat                      │  │
│  │ Review notes (if in review)                                      │  │
│  │ [Approve] [Request Changes] [Reject] (if in review)             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
KanbanView.vue
├── KanbanToolbar.vue
│   ├── NewEpicButton
│   ├── SchedulerToggle (auto/manual)
│   ├── ScheduleNowButton (manual trigger)
│   └── SchedulerConfigButton → SchedulerConfigDialog.vue
│
├── KanbanColumn.vue (×6, one per column)
│   ├── ColumnHeader (title, count, collapse toggle)
│   └── EpicCard.vue (×N, draggable)
│       ├── Title
│       ├── Priority badge
│       ├── Stack tags
│       ├── Dependency indicator (blocked/unblocked)
│       ├── Progress bar (in-progress only)
│       ├── Agent count (in-progress only)
│       ├── Cost display (in-progress only)
│       └── Review result badge (review only)
│
└── EpicDetailPanel.vue (slide-out drawer)
    ├── EpicEditor (title, description, criteria)
    ├── StackTagInput
    ├── PriorityHintSelector
    ├── DependencyPicker (multi-select from other epics)
    ├── AgentTreeMini (compact fleet view for this epic)
    └── ReviewControls (approve / changes-requested / reject)
```

### EpicCard Content by Column

| Column | Card shows |
|---|---|
| Idea | Title, stack tags |
| Backlog | Title, stack tags, complexity badge, dependency count |
| Todo | Title, priority badge (score + hint), stack tags, blocked indicator |
| In Progress | Title, progress bar, active agent count, phase, cost, elapsed time |
| Review | Title, orchestrator summary, diff stats, [Approve/Reject] quick actions |
| Done | Title, merge commit hash, total cost, completion date |

---

## The Scheduler

### What It Does

The Scheduler is an engine-level class (`src/engine/Scheduler.ts`) that periodically
evaluates the board state and decides which epics to move from Todo to In Progress.

It does **not** use an LLM for scheduling decisions. It uses a deterministic scoring
algorithm with tunable weights. LLM reasoning is too slow and expensive for a scheduler
that must react in real-time to board changes.

### Scoring Algorithm

For each epic in the Todo column:

```typescript
function computePriorityScore(epic: Epic, allEpics: Epic[], config: SchedulerConfig): number {
  const w = config.weights;

  // 1. Manual hint score (0–100)
  const hintScores: Record<PriorityHint, number> = {
    critical: 100, high: 75, medium: 50, low: 25,
  };
  const hintScore = hintScores[epic.priorityHint];

  // 2. Dependency depth score (0–100)
  // Epics that unblock the most downstream work get higher scores
  const downstream = countDownstreamEpics(epic.id, allEpics);
  const maxPossible = allEpics.length;
  const depthScore = maxPossible > 0 ? (downstream / maxPossible) * 100 : 0;

  // 3. Age score (0–100)
  // Older epics get a gentle boost to prevent starvation
  const ageHours = (Date.now() - epic.createdAt) / 3_600_000;
  const ageScore = Math.min(ageHours / 168, 1) * 100; // caps at 1 week

  // 4. Complexity score (0–100)
  // Smaller items score higher (faster throughput, quicker feedback)
  const complexityScores: Record<ComplexityEstimate, number> = {
    trivial: 100, small: 80, medium: 60, large: 40, epic: 20,
  };
  const complexityScore = complexityScores[epic.complexity];

  // 5. Rejection penalty (0–100, subtracted)
  // Each rejection reduces priority — human doesn't want this right now
  const rejectionScore = Math.min(epic.rejectionCount * 25, 100);

  return (
    w.manualHint * hintScore +
    w.dependencyDepth * depthScore +
    w.age * ageScore +
    w.complexity * complexityScore -
    w.rejectionPenalty * rejectionScore
  );
}
```

### Scheduler Loop

```typescript
export class Scheduler {
  private interval: ReturnType<typeof setInterval> | null = null;
  private epicStore: EpicStore;
  private config: SchedulerConfig;

  /**
   * Called every 5 seconds when autoSchedule is enabled,
   * or manually via the "Schedule Now" button.
   */
  async tick(): Promise<SchedulerAction[]> {
    const actions: SchedulerAction[] = [];

    // 1. Recompute priority scores for all Todo epics
    const todoEpics = this.epicStore.epicsByColumn('todo');
    const allEpics = this.epicStore.allEpics();

    for (const epic of todoEpics) {
      const score = computePriorityScore(epic, allEpics, this.config);
      this.epicStore.updatePriority(epic.id, score, this.explainScore(epic, score));
    }

    // 2. Sort Todo by score descending
    const sorted = [...todoEpics].sort((a, b) => b.priorityScore - a.priorityScore);

    // 3. Check capacity
    const inProgress = this.epicStore.epicsByColumn('in-progress');
    const slots = this.config.maxConcurrentEpics - inProgress.length;

    // 4. Pick top N unblocked epics that fit in available slots
    for (const epic of sorted) {
      if (actions.length >= slots) break;
      if (epic.blockedBy.length > 0) continue; // dependencies not met
      if (this.config.costBudgetUsd && epic.totalCostUsd >= this.config.costBudgetUsd) continue;

      actions.push({ type: 'start', epicId: epic.id });
    }

    // 5. Check for completed orchestrator sessions → move to review
    for (const epic of inProgress) {
      if (this.isOrchestratorDone(epic.sessionId)) {
        actions.push({ type: 'to-review', epicId: epic.id });
      }
      if (this.isOrchestratorFailed(epic.sessionId)) {
        actions.push({ type: 'to-review', epicId: epic.id, failed: true });
      }
    }

    // 6. Execute actions (if autoSchedule) or return for UI display
    if (this.config.autoSchedule) {
      for (const action of actions) {
        await this.executeAction(action);
      }
    }

    return actions;
  }
}
```

### Scheduler Actions

```typescript
type SchedulerAction =
  | { type: 'start'; epicId: string }        // Todo → In Progress (spawn orchestrator)
  | { type: 'to-review'; epicId: string; failed?: boolean }  // In Progress → Review
  | { type: 'requeue'; epicId: string }       // Review → Todo (after rejection)
  | { type: 'complete'; epicId: string }      // Review → Done (after approval + merge)
  ;
```

### Start Action (Todo → In Progress)

When the scheduler starts an epic:

```typescript
async startEpic(epicId: string): Promise<void> {
  const epic = this.epicStore.get(epicId);

  // 1. Create worktree branch for this epic
  const branch = `kos/${epicId}`;
  const worktree = await this.worktreeManager.create(epicId, 'root');

  // 2. Create orchestrator session
  const sessionId = await this.orchestrator.start(
    this.buildGoalPrompt(epic),
    this.config.profiles,
    true, // autoCommit within worktree
  );

  // 3. Update epic
  this.epicStore.moveToInProgress(epicId, sessionId, branch);

  // 4. Wire orchestrator events to epic tracking
  this.orchestrator.on('completed', () => {
    this.epicStore.moveToReview(epicId);
  });
  this.orchestrator.on('failed', ({ reason }) => {
    this.epicStore.moveToReview(epicId); // failed epics also go to review
  });
}
```

The goal prompt sent to the orchestrator includes the epic's description, acceptance
criteria, and any rejection feedback from previous attempts:

```typescript
buildGoalPrompt(epic: Epic): string {
  let prompt = `# Epic: ${epic.title}\n\n${epic.description}\n`;

  if (epic.acceptanceCriteria.length > 0) {
    prompt += `\n## Acceptance Criteria\n`;
    for (const criterion of epic.acceptanceCriteria) {
      prompt += `- [ ] ${criterion}\n`;
    }
  }

  if (epic.rejectionCount > 0 && epic.reviewNotes) {
    prompt += `\n## Previous Review Feedback\n`;
    prompt += `This epic was previously rejected ${epic.rejectionCount} time(s).\n`;
    prompt += `Reviewer notes:\n${epic.reviewNotes}\n`;
    prompt += `\nAddress ALL feedback points before completing.\n`;
  }

  return prompt;
}
```

---

## Review Flow

The review column is the human-in-the-loop gate. When an orchestrator session completes
(calls `done()` or `fail()`), the epic moves to Review automatically.

### Review Panel (EpicDetailPanel in review mode)

Shows:
1. **Orchestrator summary** — The `done(summary)` or `fail(reason)` output.
2. **Diff view** — All files changed in the epic's worktree branch vs. master.
   Uses the existing `DiffSplitView.vue` component.
3. **Agent conversation tree** — Link to view the full orchestrator chat + children.
4. **Acceptance criteria checklist** — Reviewer checks off each criterion.
5. **Review actions:**

| Action | What happens |
|---|---|
| **Approve** | Epic moves to Done. Scheduler merges worktree branch to master. |
| **Request Changes** | Epic moves back to Todo with reviewer notes. Scheduler will re-run it with feedback context. |
| **Reject** | Epic moves back to Backlog. Not automatically re-scheduled. |

### Rejection → Re-execution

When an epic is sent back to Todo:

```typescript
async rejectEpic(epicId: string, notes: string, action: 'changes-requested' | 'rejected'): Promise<void> {
  const epic = this.epicStore.get(epicId);

  // Clean up the old worktree (keep the branch for reference)
  if (epic.worktreeBranch) {
    await this.worktreeManager.remove(epic.worktreeHandle);
  }

  epic.reviewNotes = notes;
  epic.reviewResult = action;
  epic.reviewedAt = Date.now();
  epic.rejectionCount++;
  epic.sessionId = null;
  epic.worktreeBranch = null;

  if (action === 'changes-requested') {
    // Goes back to Todo — scheduler will pick it up with feedback
    this.epicStore.moveToColumn(epicId, 'todo');
  } else {
    // Rejected — goes to Backlog, needs manual re-triage
    this.epicStore.moveToColumn(epicId, 'backlog');
  }
}
```

### Approval → Merge → Done

```typescript
async approveEpic(epicId: string): Promise<void> {
  const epic = this.epicStore.get(epicId);

  // 1. Merge worktree branch to master
  const result = await this.worktreeManager.merge(epic.worktreeHandle, 'squash');

  if (!result.ok) {
    // Merge conflict — notify reviewer, don't auto-resolve
    this.epicStore.setReviewNotes(epicId,
      `Merge conflict on: ${result.conflicts.join(', ')}. Resolve manually or request changes.`
    );
    return;
  }

  // 2. Clean up worktree
  await this.worktreeManager.remove(epic.worktreeHandle);

  // 3. Get merge commit hash
  const hash = await this.gitShortHead();

  // 4. Move to Done
  this.epicStore.moveToDone(epicId, hash);
}
```

---

## Database Schema

New `epics` table alongside existing tables:

```sql
CREATE TABLE IF NOT EXISTS epics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  column TEXT NOT NULL DEFAULT 'idea',    -- EpicColumn enum
  position INTEGER DEFAULT 0,

  -- Priority
  priority_hint TEXT DEFAULT 'medium',    -- PriorityHint enum
  priority_score REAL DEFAULT 50,
  priority_reason TEXT DEFAULT '',

  -- Metadata
  stack TEXT DEFAULT '[]',                -- JSON array of strings
  acceptance_criteria TEXT DEFAULT '[]',  -- JSON array of strings
  complexity TEXT DEFAULT 'medium',       -- ComplexityEstimate enum

  -- Dependencies
  depends_on TEXT DEFAULT '[]',           -- JSON array of epic IDs

  -- Orchestration
  session_id TEXT,                        -- FK to sessions.session_id
  worktree_branch TEXT,

  -- Review
  review_notes TEXT DEFAULT '',
  review_result TEXT,                     -- ReviewResult enum or null
  reviewed_at INTEGER,
  rejection_count INTEGER DEFAULT 0,

  -- Lifecycle
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  merge_commit TEXT,

  -- Cost
  total_cost_usd REAL DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_delegations INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_epics_column ON epics(column);
CREATE INDEX IF NOT EXISTS idx_epics_session ON epics(session_id);
```

---

## Pinia Store

### EpicStore (`src/stores/epics.ts`)

```typescript
export const useEpicStore = defineStore('epics', () => {
  const epics = ref<Map<string, Epic>>(new Map());
  const selectedEpicId = ref<string | null>(null);

  // Computed
  const columns = computed(() => {
    const cols: Record<EpicColumn, Epic[]> = {
      'idea': [], 'backlog': [], 'todo': [],
      'in-progress': [], 'review': [], 'done': [],
    };
    for (const epic of epics.value.values()) {
      cols[epic.column].push(epic);
    }
    // Sort each column by position
    for (const col of Object.values(cols)) {
      col.sort((a, b) => a.position - b.position);
    }
    // Sort todo by priorityScore descending
    cols.todo.sort((a, b) => b.priorityScore - a.priorityScore);
    return cols;
  });

  const selectedEpic = computed(() =>
    selectedEpicId.value ? epics.value.get(selectedEpicId.value) ?? null : null
  );

  // Dependency resolution
  const unblockedTodo = computed(() =>
    columns.value.todo.filter(e => e.blockedBy.length === 0)
  );

  // Actions
  function createEpic(title: string, column: EpicColumn = 'idea'): string { ... }
  function updateEpic(id: string, updates: Partial<Epic>): void { ... }
  function moveToColumn(id: string, column: EpicColumn): void { ... }
  function moveToInProgress(id: string, sessionId: string, branch: string): void { ... }
  function moveToReview(id: string): void { ... }
  function moveToDone(id: string, mergeCommit: string): void { ... }
  function recomputeBlockedBy(): void { ... }  // recalc all blocked deps
  function deleteEpic(id: string): void { ... }
  async function loadFromDatabase(): Promise<void> { ... }
  async function persistEpic(id: string): Promise<void> { ... }

  return { epics, selectedEpicId, columns, selectedEpic, unblockedTodo, ... };
});
```

---

## Multi-Orchestrator Support & Recursive Depth

The current codebase has a **singleton** Orchestrator in `useOrchestrator.ts`. KOS requires
two changes: (1) **multiple concurrent orchestrators** — one per in-progress epic, and
(2) **recursive orchestration** — a specialist agent can spawn a sub-orchestrator when
the sub-task is too complex for a single agent.

### The Recursion Model

An epic starts with a **root orchestrator** (depth 0). That orchestrator delegates to
specialists (architect, implementer, reviewer, tester). But when a sub-task is complex
enough — say, "implement the entire auth system" requires designing the DB schema,
building the API layer, writing the frontend, and wiring integration tests — the root
orchestrator can spawn a **sub-orchestrator** (depth 1) instead of a single specialist.

That sub-orchestrator gets its own worktree branch, its own specialist children, and
the full orchestrator toolset. It can even spawn its own sub-orchestrators (depth 2),
up to `maxDepth`.

```
Epic "Build User Dashboard" (In Progress)
│
├─ d0-orchestrator (root)           ← branch: kos/<epicId>
│   │
│   ├─ d0/architect-1               ← branch: kos/<epicId>/architect-1
│   │   └─ (designs the full system)
│   │
│   ├─ d1-orchestrator-1            ← branch: kos/<epicId>/d1-orc-1
│   │   │  (sub-orchestrator for "auth subsystem")
│   │   │
│   │   ├─ d1/architect-1           ← branch: kos/<epicId>/d1-orc-1/architect-1
│   │   ├─ d1/implementer-1         ← branch: kos/<epicId>/d1-orc-1/implementer-1
│   │   └─ d1/tester-1              ← branch: kos/<epicId>/d1-orc-1/tester-1
│   │
│   ├─ d1-orchestrator-2            ← branch: kos/<epicId>/d1-orc-2
│   │   │  (sub-orchestrator for "dashboard UI")
│   │   │
│   │   ├─ d1/implementer-1         ← branch: kos/<epicId>/d1-orc-2/implementer-1
│   │   └─ d2-orchestrator-1        ← branch: kos/<epicId>/d1-orc-2/d2-orc-1
│   │       │  (sub-sub-orchestrator for "charting components")
│   │       ├─ d2/implementer-1
│   │       └─ d2/tester-1
│   │
│   └─ d0/reviewer-1                ← final review at root level
│
└─ Merge chain: d2 → d1 → d0 → master
```

### Orchestrator Options (depth-aware)

```typescript
export interface OrchestratorOptions {
  depth: number;          // 0 = root (spawned by scheduler), 1+ = sub-orchestrator
  maxDepth: number;       // Hard cap (default: 3)
  parentSessionId: string | null;
  epicId: string;         // Always inherited — ties the whole tree to one epic
  teamId: string;         // Inherited from root
  workspace: string;      // Worktree path assigned by parent
}
```

The `Orchestrator` class gains a new MCP tool: `spawn_orchestrator(goal, context)`.
This tool is **only available when `depth < maxDepth`**. The system prompt is depth-aware:

```typescript
getSystemPrompt(options: OrchestratorOptions): string {
  let prompt = ORCHESTRATOR_SYSTEM_PROMPT;

  if (options.depth < options.maxDepth) {
    prompt += `\n\n# Sub-Orchestrator Spawning\n\n` +
      `You have an additional tool: spawn_orchestrator(goal, context)\n` +
      `Use this ONLY when a sub-task has multiple sequential phases or parallel ` +
      `independent subsystems. If one or two specialist calls suffice, use delegate directly.\n` +
      `Current depth: ${options.depth}/${options.maxDepth}. ` +
      `Sub-orchestrators inherit your worktree and budget.`;
  }

  return prompt;
}
```

### MCP Tool: spawn_orchestrator

Added to the MCP server alongside delegate, validate, done, fail:

```typescript
// In orchestrator_server.py — new tool
{
  name: 'spawn_orchestrator',
  description: 'Spawn a sub-orchestrator for a complex sub-task that requires ' +
    'multiple phases or parallel independent subsystems.',
  inputSchema: {
    type: 'object',
    properties: {
      goal: { type: 'string', description: 'The sub-goal for the sub-orchestrator' },
      context: { type: 'string', description: 'Context from parent orchestrator' },
    },
    required: ['goal'],
  },
}
```

When intercepted in `Orchestrator.executeCommand()`:

```typescript
case 'spawn_orchestrator':
  if (this.options.depth >= this.options.maxDepth) {
    this.feedResult(
      `ERROR: Maximum orchestration depth (${this.options.maxDepth}) reached. ` +
      `Use delegate() for specialist agents instead.`
    );
    return;
  }
  this.executeSpawnOrchestrator(cmd);
  break;
```

### Worktree Branching at Each Depth

Each sub-orchestrator gets its own worktree branched from its parent's worktree:

```typescript
async executeSpawnOrchestrator(cmd: OrchestratorCommand): Promise<void> {
  const subOrcName = `d${this.options.depth + 1}-orchestrator-${++this.agentCounter}`;

  // Create worktree branched from THIS orchestrator's branch, not from master
  const handle = await this.worktreeManager.create(
    this.options.epicId,
    subOrcName,
    this.options.workspace,  // parent worktree as base
  );

  // Spawn child orchestrator at depth + 1
  const childOrc = new Orchestrator();
  childOrc.setChatPanel(this.chatPanel);
  childOrc.setWorkspace(handle.path);

  const childOptions: OrchestratorOptions = {
    depth: this.options.depth + 1,
    maxDepth: this.options.maxDepth,
    parentSessionId: this._sessionId,
    epicId: this.options.epicId,
    teamId: this.teamId,
    workspace: handle.path,
  };

  const childSessionId = await childOrc.start(
    cmd.task!,
    this.contextProfileIds,
    true,
    childOptions,
  );

  // Track as pending child (same as specialist delegation)
  this.pendingChildren.set(childSessionId, {
    sessionId: childSessionId,
    role: 'sub-orchestrator',
    agentName: subOrcName,
    completed: false,
    output: '',
    worktreeHandle: handle,
    childOrchestrator: childOrc, // keep reference for routing
  });

  // Register in the pool so MCP calls route correctly
  this.pool.registerSubOrchestrator(childSessionId, childOrc);
}
```

### Merge Chain (Bottom-Up)

When a sub-orchestrator completes:
1. Its children's worktrees have already been merged into its branch (by the sub-orchestrator's
   own `checkAllChildrenDone()`).
2. The parent orchestrator merges the sub-orchestrator's branch into the parent's branch.
3. This cascades up: d2 → d1 → d0.
4. When the root orchestrator (d0) completes and the epic is approved, d0's branch merges
   into master.

```typescript
// In checkAllChildrenDone(), extended for sub-orchestrators:
for (const child of completedChildren) {
  if (child.worktreeHandle) {
    const result = await this.worktreeManager.merge(child.worktreeHandle);
    mergeResults.push(result);
    await this.worktreeManager.remove(child.worktreeHandle);
  }
}
```

This is the same merge logic for both specialists and sub-orchestrators. The worktree
handle is the common abstraction — it doesn't matter whether the child was a single
implementer or a full sub-orchestrator tree. The merge is always: child branch → parent branch.

### Budget Inheritance

Each depth level inherits a fraction of the parent's remaining delegation budget:

```typescript
// Root orchestrator starts with MAX_TOTAL_DELEGATIONS (e.g., 100)
// Sub-orchestrator gets: parent's remaining budget / expected children
const childBudget = Math.floor(
  (this.remainingBudget()) / Math.max(expectedChildren, 2)
);
```

This prevents "middle management explosion" where sub-orchestrators spawn sub-orchestrators
that spawn sub-orchestrators and burn the entire budget on coordination overhead.

### Guard Against Middle Management

The system prompt includes a hard rule at every depth:

> "Only spawn a sub-orchestrator when the sub-task has multiple sequential phases
> (architect → implement → validate) or multiple parallel independent subsystems.
> If one or two specialist calls suffice, use delegate() directly. Spawning a
> sub-orchestrator for a task that a single implementer could handle is wasteful
> and will be penalized."

Additionally, the `spawn_orchestrator` tool is **removed entirely** from the system prompt
when `depth === maxDepth`, so the LLM cannot even attempt to call it.

### OrchestratorPool (updated for recursive depth)

```typescript
export class OrchestratorPool {
  // epicId → root orchestrator
  private roots = new Map<string, Orchestrator>();
  // sessionId → orchestrator (flat index for fast routing, includes all depths)
  private bySession = new Map<string, Orchestrator>();
  private chatPanel: OrchestratorChatPanelAPI;

  /** Spawn a root orchestrator (depth 0) for an epic. */
  async spawnRoot(epicId: string, goal: string, profiles: string[],
                  workspace: string, maxDepth = 3): Promise<string> {
    const orc = new Orchestrator();
    orc.setChatPanel(this.chatPanel);
    orc.setWorkspace(workspace);

    const options: OrchestratorOptions = {
      depth: 0,
      maxDepth,
      parentSessionId: null,
      epicId,
      teamId: crypto.randomUUID(),
      workspace,
    };

    const sessionId = await orc.start(goal, profiles, true, options);

    this.roots.set(epicId, orc);
    this.bySession.set(sessionId, orc);
    return sessionId;
  }

  /** Register a sub-orchestrator (called by parent orchestrator). */
  registerSubOrchestrator(sessionId: string, orc: Orchestrator): void {
    this.bySession.set(sessionId, orc);
  }

  /** Route MCP tool calls to the correct orchestrator (any depth). */
  routeToolCall(sessionId: string, toolName: string, args: Record<string, any>): void {
    const orc = this.bySession.get(sessionId);
    if (orc) {
      orc.onMcpToolCalled(sessionId, toolName, args);
    }
  }

  /** Route delegate-finished to the correct orchestrator (any depth). */
  routeDelegateFinished(childSessionId: string, output: string): void {
    // The child's parent orchestrator tracks it in pendingChildren
    for (const orc of this.bySession.values()) {
      orc.onDelegateFinished(childSessionId, output);
    }
  }

  /** Route session-finished to the correct orchestrator (any depth). */
  routeSessionFinished(sessionId: string): void {
    const orc = this.bySession.get(sessionId);
    if (orc) {
      orc.onSessionFinishedProcessing(sessionId);
    }
  }

  /** Remove all orchestrators for an epic (root + all sub-orchestrators). */
  removeEpic(epicId: string): void {
    const root = this.roots.get(epicId);
    if (!root) return;

    // Collect all session IDs for this epic
    const toRemove: string[] = [];
    for (const [sessionId, orc] of this.bySession) {
      if (orc.epicId() === epicId) {
        if (orc.isRunning()) orc.cancel();
        toRemove.push(sessionId);
      }
    }
    for (const id of toRemove) {
      this.bySession.delete(id);
    }
    this.roots.delete(epicId);
  }

  /** All active root orchestrators with their epic IDs. */
  activeRoots(): Array<{ epicId: string; orchestrator: Orchestrator }> {
    return Array.from(this.roots.entries())
      .filter(([_, orc]) => orc.isRunning())
      .map(([epicId, orchestrator]) => ({ epicId, orchestrator }));
  }

  /** Count total active orchestrators across all depths. */
  totalActive(): number {
    let count = 0;
    for (const orc of this.bySession.values()) {
      if (orc.isRunning()) count++;
    }
    return count;
  }
}
```

### Routing Changes in `useEngine.ts`

The MCP tool interceptor and delegate-finished callback currently go to a singleton
orchestrator. With KOS, they route through `OrchestratorPool`:

```typescript
// Before (singleton):
orchestrator.onMcpToolCalled(sessionId, toolName, args);

// After (pool, routes to correct depth):
orchestratorPool.routeToolCall(sessionId, toolName, args);
```

The pool uses a flat `bySession` map for O(1) routing. When a sub-orchestrator registers
itself via `registerSubOrchestrator()`, the pool adds it to the map. When an epic is
removed, all orchestrators at all depths for that epic are cleaned up.

### PendingChild (extended)

```typescript
export interface PendingChild {
  sessionId: string;
  role: string;                        // 'architect' | 'implementer' | ... | 'sub-orchestrator'
  agentName: string;
  completed: boolean;
  output: string;
  worktreeHandle?: WorktreeHandle;     // For branch isolation (from SUP_ORC.md)
  childOrchestrator?: Orchestrator;    // Set when role = 'sub-orchestrator'
}
```

---

## WorktreeManager Integration

Each in-progress epic gets its own worktree branch. The root orchestrator and all its
descendants (specialists and sub-orchestrators at any depth) operate within nested
worktree branches that merge bottom-up.

### Branch Hierarchy

```
master
  │
  ├── kos/epic-abc-123                          ← Epic A root (d0)
  │     │
  │     ├── kos/epic-abc-123/architect-1        ← d0 specialist
  │     │
  │     ├── kos/epic-abc-123/d1-orc-1           ← d1 sub-orchestrator
  │     │     ├── kos/epic-abc-123/d1-orc-1/architect-1     ← d1 specialist
  │     │     ├── kos/epic-abc-123/d1-orc-1/implementer-1   ← d1 specialist
  │     │     └── kos/epic-abc-123/d1-orc-1/d2-orc-1        ← d2 sub-sub-orchestrator
  │     │           ├── kos/epic-abc-123/d1-orc-1/d2-orc-1/implementer-1
  │     │           └── kos/epic-abc-123/d1-orc-1/d2-orc-1/tester-1
  │     │
  │     ├── kos/epic-abc-123/d1-orc-2           ← d1 sub-orchestrator (parallel)
  │     │     └── kos/epic-abc-123/d1-orc-2/implementer-1
  │     │
  │     └── kos/epic-abc-123/reviewer-1         ← d0 specialist (final review)
  │
  ├── kos/epic-def-456                          ← Epic B root (independent)
  │     ├── kos/epic-def-456/implementer-1
  │     └── kos/epic-def-456/tester-1
  │
  └── (working directory)
```

### WorktreeManager.create() — Depth-Aware

The `create()` method accepts an optional `baseBranch` parameter. For root orchestrators,
the base is `master`. For sub-orchestrators and their children, the base is the parent
orchestrator's branch:

```typescript
export class WorktreeManager {
  /**
   * Create a worktree for an agent.
   * @param epicId    - Epic this agent belongs to
   * @param agentName - Unique agent name (e.g., 'implementer-1', 'd1-orc-2')
   * @param basePath  - Parent worktree path to branch FROM (default: repo root = master)
   */
  async create(epicId: string, agentName: string, basePath?: string): Promise<WorktreeHandle> {
    const branch = `kos/${epicId}/${agentName}`;
    const worktreePath = `${this.repoRoot}/.worktrees/${epicId}/${agentName}`;

    // Branch from parent's current HEAD, not from master
    const base = basePath || this.repoRoot;
    await exec(`git -C "${base}" worktree add -b "${branch}" "${worktreePath}"`);

    return { path: worktreePath, branch, epicId, agentName };
  }
}
```

### Merge Chain (Bottom-Up)

When agents and sub-orchestrators complete, merges cascade upward:

```
d2/implementer-1 completes → merge into d2-orc-1 branch
d2/tester-1 completes      → merge into d2-orc-1 branch
d2-orc-1 calls done()      → merge into d1-orc-1 branch
d1/architect-1 completes   → merge into d1-orc-1 branch
d1-orc-1 calls done()      → merge into kos/epic-abc-123 (root)
d1-orc-2 calls done()      → merge into kos/epic-abc-123 (root)
d0/reviewer-1 completes    → merge into kos/epic-abc-123 (root)
d0-orchestrator calls done()→ epic moves to Review
Human approves              → squash-merge kos/epic-abc-123 into master
```

Each merge is a squash-merge by default. The final merge to master is a single commit
that contains all the work from every agent at every depth. Clean history.

### Conflict Resolution at Each Depth

When two children of the same sub-orchestrator touch the same files, the merge may
conflict. The conflict resolution follows the same policy from SUP_ORC.md at every depth:

1. Attempt squash-merge.
2. If conflicts: report to the parent orchestrator with the conflict list.
3. Parent orchestrator delegates conflict resolution to an implementer.
4. Never silently discard work.

### Epic Lifecycle with Worktrees

**Epic approved:**
1. All child worktrees at all depths are already merged into the root branch (cascaded
   during orchestration).
2. Root branch (`kos/<epicId>`) is squash-merged into master.
3. All worktrees under `.worktrees/<epicId>/` are cleaned up.
4. All branches matching `kos/<epicId>/**` are deleted.

**Epic rejected (changes requested):**
1. All worktrees under `.worktrees/<epicId>/` are cleaned up.
2. All branches matching `kos/<epicId>/**` are deleted (work is discarded).
3. Epic returns to Todo with feedback — a fresh branch tree will be created on retry.

**Epic cancelled while in progress:**
1. All running orchestrators at all depths for this epic are cancelled.
2. All worktrees and branches cleaned up.
3. Epic returns to its previous column.

---

## View Navigation

```
┌─────────────────────────────────────────────────────┐
│  FleetHeader toolbar                                 │
│  [Fleet] [Kanban] [Editor] [Mission Control]        │
└─────────────────────────────────────────────────────┘
```

| User action | Navigation |
|---|---|
| Click "Kanban" in toolbar | `viewMode = 'kanban'`, show KanbanView |
| Click in-progress EpicCard | `viewMode = 'manager'`, select epic's root session |
| Click "Back to Board" in manager | `viewMode = 'kanban'` |
| Click review EpicCard | Open EpicDetailPanel with review controls |

The existing manager view (agent fleet + chat + effects) remains unchanged. KOS adds
a new entry point that manages **which goals** are running, while the manager view shows
**how a single goal** is being executed.

---

## Event Flow

```
User creates epic in Idea column
  │
  ▼
User refines: adds description, criteria, stack, dependencies
  │
  ▼
User moves to Backlog (or drags directly)
  │
  ▼
User sets priority hint, moves to Todo
  │
  ▼
Scheduler.tick() runs
  ├── Recomputes priority scores for all Todo epics
  ├── Checks capacity (maxConcurrentEpics - inProgress.length)
  ├── Selects top unblocked epics
  │
  ▼
Scheduler starts epic
  ├── WorktreeManager.create() → new branch kos/<epicId>
  ├── OrchestratorPool.spawn() → new Orchestrator session
  ├── Epic card moves to In Progress, shows live status
  │
  ▼
Orchestrator runs (existing flow: delegate → validate → iterate)
  ├── Child agents work in epic's worktree
  ├── EpicCard shows progress: phase, agent count, cost
  │
  ▼
Orchestrator calls done() or fail()
  ├── Scheduler detects completion
  ├── Epic moves to Review
  │
  ▼
Human reviews in EpicDetailPanel
  ├── Views diff (worktree branch vs. master)
  ├── Reads orchestrator summary
  ├── Checks acceptance criteria
  │
  ├── [Approve] → merge to master → Done
  ├── [Request Changes] → back to Todo with notes → Scheduler re-runs
  └── [Reject] → back to Backlog
```

---

## Development Phases

Each phase is a self-contained deliverable. Build and validate each before moving on.

### Phase 1: Epic Data Model & Storage

**Goal:** Epics exist in the database and can be CRUD'd.

**Files to create:**
- `src/engine/EpicTypes.ts` — Epic, SchedulerConfig, SchedulerAction type definitions
- `src/stores/epics.ts` — EpicStore (Pinia store)

**Files to modify:**
- `src/engine/Database.ts` — Add `epics` table, CRUD methods
- `src/engine/types.ts` — Export epic types

**Validation:**
- Unit test: create, read, update, delete epics via store
- Verify DB persistence: create epic, reload from DB, verify fields match

### Phase 2: Kanban View (Static Board)

**Goal:** Kanban board renders with 6 columns, cards can be dragged between columns.

**Files to create:**
- `src/components/kanban/KanbanView.vue` — Main board layout
- `src/components/kanban/KanbanColumn.vue` — Single column with drop zone
- `src/components/kanban/EpicCard.vue` — Card component
- `src/components/kanban/KanbanToolbar.vue` — Top toolbar
- `src/components/kanban/EpicDetailPanel.vue` — Right drawer for epic editing

**Files to modify:**
- `src/stores/ui.ts` — Add `'kanban'` to viewMode type
- `src/components/layout/FleetHeader.vue` — Add Kanban button
- `src/App.vue` — Render KanbanView when viewMode is kanban

**Drag-and-drop:** Use native HTML5 drag and drop (no library needed). Cards emit
`dragstart` with epicId; columns handle `drop` and call `epicStore.moveToColumn()`.

**Manual column restrictions:**
- Cannot drag to "In Progress" (only scheduler does this).
- Cannot drag to "Done" (only approval does this).
- Can drag between: Idea ↔ Backlog ↔ Todo.
- Can drag from Review → Todo or Review → Backlog (rejection).

**Validation:**
- Visual: 6 columns render, cards display correct info
- Drag: card moves between allowed columns, persists on reload
- Detail panel opens on card click, edits save

### Phase 3: Epic Detail Editor

**Goal:** Full epic editing in the detail panel.

**Additions to EpicDetailPanel.vue:**
- Markdown editor for description (use existing markdown-it)
- Tag input for stack (comma-separated, renders as chips)
- Acceptance criteria list (add/remove/reorder)
- Complexity selector (dropdown)
- Priority hint selector (dropdown)
- Dependency picker (multi-select from other epics, shows dependency graph)

**Validation:**
- All fields persist to DB
- Dependencies create visible "blocked" indicators on cards
- Dependency cycles are prevented (validate on add)

### Phase 4: Scheduler Engine

**Goal:** The scheduler computes priority scores and can start epics.

**Files to create:**
- `src/engine/Scheduler.ts` — Scheduler class with tick(), scoring, actions
- `src/components/kanban/SchedulerConfigDialog.vue` — Config UI

**Files to modify:**
- `src/composables/useOrchestrator.ts` — Export OrchestratorPool instead of singleton
- `src/stores/epics.ts` — Add scheduler-related actions (updatePriority, recomputeBlockedBy)

**Scheduler behavior:**
- `tick()` runs every 5 seconds when autoSchedule is on
- In manual mode, tick() computes scores but doesn't execute — shows suggested actions
- "Schedule Now" button calls tick() once in auto mode

**Validation:**
- Priority scores update correctly when epics change
- Blocked epics are skipped
- Scheduler respects maxConcurrentEpics
- Epics start when slots are available

### Phase 5: OrchestratorPool + Multi-Session

**Goal:** Multiple orchestrators run simultaneously, one per in-progress epic.

**Files to create:**
- `src/engine/OrchestratorPool.ts` — Pool with flat `bySession` routing map

**Files to modify:**
- `src/engine/Orchestrator.ts` — Add `OrchestratorOptions` (depth, maxDepth, epicId),
  store options, expose `epicId()` getter
- `src/composables/useEngine.ts` — Route MCP calls through pool
- `src/composables/useOrchestrator.ts` — Replace singleton with pool
- `src/App.vue` — Wire pool routing

**Key constraint:** The existing ChatPanel already supports multiple sessions. The
OrchestratorPool just manages multiple Orchestrator instances and routes events correctly.

**Validation:**
- Start 2 epics simultaneously from Todo
- Both orchestrators run independently
- MCP tool calls route to correct orchestrator
- Child delegation results return to correct parent

### Phase 6: WorktreeManager Integration

**Goal:** Each epic gets its own git worktree branch. Supports nested branching.

**Files to create:**
- `src/engine/WorktreeManager.ts` — Depth-aware create/merge/remove/cleanup

**Files to modify:**
- `src/engine/Scheduler.ts` — Create/remove worktrees on epic start/complete/reject
- `src/engine/OrchestratorPool.ts` — Pass worktree path to orchestrator workspace
- `src/engine/Orchestrator.ts` — Pass worktree handle to children in `executeDelegation()`

**Validation:**
- Starting an epic creates branch `kos/<epicId>`
- Orchestrator and children work within the worktree
- Approving an epic merges branch to master
- Rejecting an epic deletes the branch and all sub-branches
- Multiple worktrees from different epics coexist without conflicts

### Phase 6b: Recursive Orchestration (Fractal Depth)

**Goal:** Orchestrators can spawn sub-orchestrators for complex sub-tasks.

**Files to modify:**
- `src/engine/Orchestrator.ts` — Add `spawn_orchestrator` command handling,
  `executeSpawnOrchestrator()`, depth-aware system prompt, budget inheritance
- `src/engine/OrchestratorPool.ts` — Add `registerSubOrchestrator()` for routing
- `resources/mcp/orchestrator_server.py` — Add `spawn_orchestrator` tool definition
- `src/engine/WorktreeManager.ts` — Support `basePath` parameter for nested branching

**System prompt changes:**
- When `depth < maxDepth`: include `spawn_orchestrator` tool in prompt
- When `depth === maxDepth`: remove it entirely (LLM cannot call it)
- Anti-middle-management rule injected at every depth

**Budget enforcement:**
- Each sub-orchestrator inherits `parentBudget / max(expectedChildren, 2)`
- Prevents exponential delegation explosion

**Validation:**
- Root orchestrator can call `spawn_orchestrator` for a complex sub-task
- Sub-orchestrator runs with its own worktree branch
- Sub-orchestrator can delegate to specialists
- At maxDepth, `spawn_orchestrator` is unavailable (LLM cannot call it)
- Sub-orchestrator's `done()` merges its branch into parent's branch
- MCP routing works correctly across depths (pool.bySession map)
- Budget limits prevent runaway delegation chains

### Phase 7: Review Flow

**Goal:** Full human-in-the-loop review with approve/reject/changes-requested.

**Files to modify:**
- `src/components/kanban/EpicDetailPanel.vue` — Add review mode UI
- `src/engine/Scheduler.ts` — Handle approval (merge) and rejection (requeue)
- `src/stores/epics.ts` — Review state transitions

**Review mode UI:**
- Orchestrator's done()/fail() summary displayed prominently
- Diff view: `git diff master...kos/<epicId>` rendered in DiffSplitView
- Acceptance criteria checklist (check off as verified)
- Text area for reviewer notes
- Three action buttons: Approve, Request Changes, Reject

**Validation:**
- Orchestrator completes → epic auto-moves to Review
- Approve → squash-merge to master → Done
- Request Changes → back to Todo, scheduler re-runs with feedback
- Reject → back to Backlog, requires manual re-triage
- Merge conflicts are reported, don't silently fail

### Phase 8: Polish & Persistence

**Goal:** Board state survives app restart, scheduler config persists.

**Work:**
- Persist scheduler config to DB or `~/.angy/scheduler.json`
- Load epic board state on app launch
- Show scheduler log (last N actions with timestamps)
- Keyboard shortcuts: `Cmd+K` → kanban view, `N` → new epic
- Epic search/filter in toolbar
- Column collapse (for small screens)
- Cost rollup: total cost across all Done epics

**Validation:**
- Close and reopen app → board state preserved
- In-progress epics show as stale (orchestrator not running) with "Resume" option
- Scheduler config persists across restarts

---

## Critical Traps

### Singleton Orchestrator Assumption
The existing codebase assumes one orchestrator. Search for `orchestrator.` in composables
and App.vue — every callsite must be updated to use the pool or accept an epicId parameter.

### MCP Server Registration
The MCP server is registered globally in `~/.claude.json`. Multiple orchestrators share
the same MCP server process. The MCP tool call routing in `useEngine.ts` must match the
`sessionId` to the correct orchestrator in the pool — this is how we disambiguate.

### Worktree Working Directory
Each orchestrator must set its workspace to the epic's worktree path, not the repo root.
This is set in `Orchestrator.setWorkspace()` before `start()`.

### Board State vs. Session State
Epics are the source of truth for "what is being worked on." Sessions are the execution
record. If a session exists but no epic references it, it's an orphan from pre-KOS usage.
The fleet panel should still show non-epic sessions normally.

### Concurrent Merge to Master
When two epics are approved simultaneously, their merges must be serialized. Use a mutex
or queue in WorktreeManager to prevent race conditions.

### Recursive Depth Explosion
Sub-orchestrators are powerful but dangerous. A root orchestrator that spawns 3
sub-orchestrators, each spawning 3 more, each spawning 3 specialists = 39 concurrent
agents. Budget inheritance (`parentBudget / expectedChildren`) is the primary safeguard.
The `maxDepth` cap (default 3) is the hard stop. Test with maxDepth=1 first, then
increase only when the orchestrator demonstrates good judgment about when to use
`spawn_orchestrator` vs. `delegate`.

### Sub-Orchestrator Cleanup on Parent Failure
If a parent orchestrator fails or is cancelled, all its sub-orchestrators must be
cancelled too. The pool's `removeEpic()` handles this by iterating `bySession` and
matching on `epicId()`. But mid-tree cancellation (a d1 orchestrator fails while d2
children are running) must also propagate downward. Each orchestrator should cancel
its `pendingChildren` that have `childOrchestrator` set.

### Cost Tracking
The orchestrator doesn't currently track cost. The fleet store has `costUsd` per agent
from `agent:costUpdate` events. KOS should aggregate these per epic by summing all
sessions in the epic's tree (including sub-orchestrator sessions at all depths).

---

## File Index

| File | Status | Description |
|---|---|---|
| `src/engine/EpicTypes.ts` | New | Epic, SchedulerConfig, SchedulerAction types |
| `src/engine/Scheduler.ts` | New | Scheduler engine |
| `src/engine/OrchestratorPool.ts` | New | Multi-orchestrator manager |
| `src/engine/WorktreeManager.ts` | New | Git worktree operations (from SUP_ORC.md) |
| `src/stores/epics.ts` | New | Epic Pinia store |
| `src/components/kanban/KanbanView.vue` | New | Board layout |
| `src/components/kanban/KanbanColumn.vue` | New | Column component |
| `src/components/kanban/EpicCard.vue` | New | Card component |
| `src/components/kanban/KanbanToolbar.vue` | New | Toolbar |
| `src/components/kanban/EpicDetailPanel.vue` | New | Detail/editor/review panel |
| `src/components/kanban/SchedulerConfigDialog.vue` | New | Scheduler settings |
| `src/engine/Database.ts` | Modified | Add epics table + CRUD |
| `src/engine/types.ts` | Modified | Export epic types |
| `src/engine/Orchestrator.ts` | Modified | OrchestratorOptions, spawn_orchestrator, depth-aware prompt |
| `src/stores/ui.ts` | Modified | Add kanban viewMode |
| `src/composables/useEngine.ts` | Modified | Route through OrchestratorPool |
| `src/composables/useOrchestrator.ts` | Modified | Pool instead of singleton |
| `src/components/layout/FleetHeader.vue` | Modified | Add Kanban button |
| `src/App.vue` | Modified | Render KanbanView, wire pool |
| `resources/mcp/orchestrator_server.py` | Modified | Add spawn_orchestrator tool |
