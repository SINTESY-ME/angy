# KOS Improved — Project-Centric Kanban Orchestration

## What Changed From KOS.md

KOS.md designed everything around a single workspace with git worktrees for isolation.
This document replaces that with a **project-centric** model:

- **No worktrees.** Isolation via branches. One branch per epic per repo.
- **No workspace requirement.** Angy opens without selecting a folder.
- **Projects are first-class.** A project groups repos, epics, and chats.
- **Multi-repo projects.** A project can span backend, frontend, infra — each its own repo/folder.
- **One global scheduler.** Lives in Angy itself, manages all projects.
- **Repo-level concurrency control.** The scheduler treats each repo as a resource slot.
  Two epics touching different repos run in parallel. Same repo → sequential or scheduler-analyzed parallel.

```
┌─────────────────────────────────────────────────────────────┐
│                        ANGY                                  │
│                                                              │
│  ┌─ Project A ──────────┐  ┌─ Project B ──────────┐        │
│  │ repos: [api, web]    │  │ repos: [monorepo]     │        │
│  │                      │  │                       │        │
│  │ Epic 1 (in-progress) │  │ Epic 3 (todo)         │        │
│  │  → branch: kos/e1    │  │ Epic 4 (in-progress)  │        │
│  │  → touches: [api]    │  │  → branch: kos/e4     │        │
│  │                      │  │  → touches: [monorepo]│        │
│  │ Epic 2 (in-progress) │  │                       │        │
│  │  → branch: kos/e2    │  └───────────────────────┘        │
│  │  → touches: [web]    │                                    │
│  │                      │                                    │
│  │ (parallel: different │                                    │
│  │  repos, no conflict) │                                    │
│  └──────────────────────┘                                    │
│                                                              │
│  ┌─ Scheduler (global) ─────────────────────────────────┐   │
│  │ Manages all projects. Repo = resource lock.           │   │
│  │ Epic 1 holds [api]. Epic 2 holds [web]. No conflict.  │   │
│  │ Epic 4 holds [monorepo]. Independent project.         │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. UI Restructuring

### Current UI (what we have)

```
WorkspaceSelector (gate) → MainSplitter
                            ├── Manager view:  FleetPanel | Chat | Effects/Graph
                            ├── Editor view:   FileTree | CodeViewer | Chat
                            └── Mission Control: full-screen graph
```

Everything is scoped to a single workspace folder. No concept of projects or multi-repo.

### New UI (3-level navigation)

```
Level 1: HOME (no workspace needed)
├── Project list (cards or table)
├── Scheduler status bar (global)
├── [+ New Project] button
├── [Quick Chat] button → opens standalone fleet view (no project/epic)
├── Recent standalone sessions
└── Quick stats per project (active epics, cost)

Level 2: PROJECT DASHBOARD (selected a project)
├── Kanban board (6 columns: Idea → Done)
├── Project settings (repos, scheduler config)
├── Active orchestrator status per epic
└── [Back to Home] nav

Level 3: EPIC WORKSPACE (clicked into an active/review epic)
├── Manager view (existing: fleet + chat + effects)
├── Editor view (existing: file tree + code + chat)
├── Mission Control (existing: graph)
└── [Back to Board] nav
```

### Standalone Mode (No Project)

The existing agent fleet view remains available for tasks that don't need project
management. From HomeView, the user can:

1. **Quick Chat** — Opens the existing manager view with no project/epic context.
   The user picks a working directory (like the old WorkspaceSelector) and gets
   the full agent fleet + chat + orchestrator experience. This is the current
   Angy workflow, unchanged.

2. **Recent Sessions** — HomeView shows recent standalone sessions (not tied to
   any project) below the project list. Clicking one resumes it in manager view.

3. **Sidebar sessions** — The left sidebar (visible in the screenshot) continues to
   list all sessions — both standalone and epic-linked. Standalone sessions show
   without a project badge. Epic-linked sessions show their project + epic name.

This means the existing workflow is preserved as a first-class path. Projects/epics
are an optional layer on top. Users can use Angy exactly as before if they want.

```
HomeView
├── [Projects section]
│   ├── ProjectCard (MyApp)
│   ├── ProjectCard (Internal Tools)
│   └── [+ New Project]
│
├── [Quick Actions]
│   ├── [Quick Chat] → picks folder → manager view (standalone)
│   └── [Quick Orchestrate] → picks folder → orchestrator (standalone)
│
└── [Recent Standalone Sessions]
    ├── "Fix bug in parser" — ~/Work/parser — 2h ago
    └── "Explore API docs" — ~/Work/api — yesterday
```

### View Mode Changes

Current `viewMode`:
```typescript
viewMode: 'manager' | 'editor' | 'mission-control'
```

New `viewMode`:
```typescript
viewMode: 'home' | 'kanban' | 'manager' | 'editor' | 'mission-control'
```

The `manager | editor | mission-control` modes work in two contexts:
- **Standalone** — `activeEpicId = null`, `activeProjectId = null`. Behaves exactly
  like current Angy. User selected a workspace folder directly.
- **Epic-scoped** — `activeEpicId` set. Fleet, chat, and editor are filtered to
  the epic's session tree and repos.

### Navigation Rules

| From | To | Trigger |
|---|---|---|
| Home | Kanban | Click project card |
| Home | Manager (standalone) | Click "Quick Chat" or a recent session |
| Kanban | Home | Click "← Home" in header |
| Kanban | Manager (epic) | Click in-progress or review epic card |
| Manager (epic) | Kanban | Click "← Board" in header |
| Manager (standalone) | Home | Click "← Home" in header |
| Manager | Editor | Toggle (existing) |
| Manager | Mission Control | MC button (existing) |
| Mission Control | Manager | Exit button (existing) |

### What Changes in Existing Components

**WorkspaceSelector.vue** → **Replaced by HomeView.vue**

The workspace selector currently gates the entire app. In the new model, Angy opens
directly to HomeView. No workspace needed at the top level. Each project carries its
own repo paths.

**FleetHeader.vue** → **Gains context awareness**

The header adapts based on viewMode:
- `home`: "Angy" + scheduler status + settings
- `kanban`: "← Home" + project name + scheduler toggle + [+ Epic]
- `manager/editor/mc`: "← Board" + epic title + existing buttons

**MainSplitter.vue** → **Wrapped in view router**

MainSplitter only renders for `manager | editor | mission-control` (Level 3).
HomeView and KanbanView are separate full-page components.

**App.vue** → **Top-level view switch**

```vue
<template>
  <HomeView v-if="viewMode === 'home'" />
  <KanbanView v-else-if="viewMode === 'kanban'" />
  <MainSplitter v-else />  <!-- manager | editor | mission-control -->
</template>
```

### Multi-Repo File Tree in Editor

When viewing an epic that touches multiple repos, the editor file tree shows
a merged view:

```
Epic: "Add user auth"
├── 📁 api (~/Work/myapp-api)
│   ├── src/
│   │   ├── routes/auth.ts
│   │   └── models/user.ts
│   └── package.json
│
└── 📁 web (~/Work/myapp-web)
    ├── src/
    │   ├── pages/login.vue
    │   └── stores/auth.ts
    └── package.json
```

Each repo root is shown as a top-level folder labeled with its project-repo name.
File operations (open, edit, git) are routed to the correct repo path.

### New Components

| Component | Level | Purpose |
|---|---|---|
| `HomeView.vue` | 1 | Project list, global scheduler |
| `ProjectCard.vue` | 1 | Project summary card |
| `NewProjectDialog.vue` | 1 | Create project + add repos |
| `KanbanView.vue` | 2 | Epic board for a project |
| `KanbanColumn.vue` | 2 | Single column |
| `EpicCard.vue` | 2 | Epic card |
| `KanbanToolbar.vue` | 2 | Board toolbar |
| `EpicDetailPanel.vue` | 2 | Epic editor / review panel |
| `SchedulerStatusBar.vue` | 1,2 | Global scheduler status |
| `RepoScopeSelector.vue` | 2 | Pick which repos an epic touches |
| `ProjectSettingsDialog.vue` | 2 | Edit project repos, config |

### HomeView Layout

```
┌─ HomeView ────────────────────────────────────────────────────┐
│                                                                │
│  ┌─ Header ──────────────────────────────────────────────────┐ │
│  │  ANGY           [Scheduler: ● Running]         [⚙ Settings]│ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ SchedulerStatusBar ─────────────────────────────────────┐  │
│  │  3 epics in progress │ 2 projects active │ $4.20 today    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ ProjectCard ───────┐  ┌─ ProjectCard ───────┐  ┌─ + ──┐  │
│  │  MyApp               │  │  Internal Tools      │  │ New  │  │
│  │  3 repos • 5 epics   │  │  1 repo • 2 epics    │  │Proj. │  │
│  │  2 in-progress       │  │  1 in-progress       │  │      │  │
│  │  $12.40 total        │  │  $3.10 total         │  │      │  │
│  └──────────────────────┘  └──────────────────────┘  └──────┘  │
│                                                                │
│  ┌─ Recent Activity ────────────────────────────────────────┐  │
│  │  • Epic "Add auth" completed (MyApp) — 2 min ago         │  │
│  │  • Epic "Fix nav" started (MyApp) — 5 min ago            │  │
│  │  • Epic "CI pipeline" failed (Internal Tools) — 12 min   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### KanbanView Layout

Same as KOS.md design but scoped to a single project. See KOS.md section
"Component Design" — the layout is unchanged. The only addition is the
**RepoScopeSelector** in the EpicDetailPanel.

---

## 2. Database Schema

### Overview

```
projects ──< project_repos
    │
    └──< epics ──< epic_branches (join: epic × repo)
            │
            └── sessions (existing, linked via session_id)
                   │
                   └──< messages, checkpoints, file_changes (existing)

scheduler_config (singleton)
scheduler_log (append-only)
```

### Tables

#### projects

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,                -- UUID
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### project_repos

```sql
CREATE TABLE IF NOT EXISTS project_repos (
  id TEXT PRIMARY KEY,                -- UUID
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- Display name: "Backend API", "Frontend"
  path TEXT NOT NULL,                 -- Absolute path: /Users/alice/Work/myapp-api
  default_branch TEXT DEFAULT 'main', -- Branch to base epic branches from
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_repos_project ON project_repos(project_id);
```

#### epics

```sql
CREATE TABLE IF NOT EXISTS epics (
  id TEXT PRIMARY KEY,                -- UUID
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',        -- Markdown
  column TEXT NOT NULL DEFAULT 'idea',-- EpicColumn enum
  position INTEGER DEFAULT 0,        -- Sort within column

  -- Priority
  priority_hint TEXT DEFAULT 'medium',     -- PriorityHint: critical|high|medium|low
  priority_score REAL DEFAULT 50,          -- 0-100, computed by scheduler
  priority_reason TEXT DEFAULT '',         -- Scheduler's explanation

  -- Metadata
  stack TEXT DEFAULT '[]',                 -- JSON: ['vue', 'rust', 'sqlite']
  acceptance_criteria TEXT DEFAULT '[]',   -- JSON: ['criterion 1', ...]
  complexity TEXT DEFAULT 'medium',        -- ComplexityEstimate

  -- Repo targeting
  target_repos TEXT DEFAULT '[]',          -- JSON: [repo_id, ...] which repos this epic touches
  -- If empty → all project repos (conservative default)

  -- Dependencies
  depends_on TEXT DEFAULT '[]',            -- JSON: [epic_id, ...]

  -- Orchestration
  session_id TEXT,                         -- Root orchestrator session ID
  orchestrator_depth INTEGER DEFAULT 0,    -- Max depth used (for tracking)

  -- Review
  review_notes TEXT DEFAULT '',
  review_result TEXT,                      -- 'approved' | 'changes-requested' | 'rejected' | null
  reviewed_at INTEGER,
  rejection_count INTEGER DEFAULT 0,

  -- Lifecycle
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,

  -- Cost
  total_cost_usd REAL DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_delegations INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_epics_project ON epics(project_id);
CREATE INDEX IF NOT EXISTS idx_epics_column ON epics(column);
CREATE INDEX IF NOT EXISTS idx_epics_session ON epics(session_id);
```

#### epic_branches

Tracks the branch created in each repo for an epic. One row per repo the epic touches.

```sql
CREATE TABLE IF NOT EXISTS epic_branches (
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES project_repos(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,          -- e.g., 'kos/<epic-id>'
  status TEXT DEFAULT 'active',       -- 'active' | 'merged' | 'deleted'
  merge_commit TEXT,                  -- Set after merge to default branch
  PRIMARY KEY (epic_id, repo_id)
);
```

#### scheduler_config

Singleton — one row, always id=1.

```sql
CREATE TABLE IF NOT EXISTS scheduler_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_concurrent_epics INTEGER DEFAULT 3,
  cost_budget_usd REAL,               -- Per-epic cost ceiling (null = unlimited)
  auto_schedule INTEGER DEFAULT 0,     -- 0 = manual, 1 = auto
  tick_interval_ms INTEGER DEFAULT 5000,

  -- Priority weight tuning (should sum to ~1.0)
  weight_manual_hint REAL DEFAULT 0.4,
  weight_dependency_depth REAL DEFAULT 0.25,
  weight_age REAL DEFAULT 0.15,
  weight_complexity REAL DEFAULT 0.1,
  weight_rejection_penalty REAL DEFAULT 0.1
);

-- Ensure singleton exists
INSERT OR IGNORE INTO scheduler_config (id) VALUES (1);
```

#### scheduler_log

Append-only log of scheduler decisions for debugging and display.

```sql
CREATE TABLE IF NOT EXISTS scheduler_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,                -- 'start' | 'to-review' | 'requeue' | 'complete' | 'skip'
  epic_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  reason TEXT DEFAULT '',              -- Why this action was taken
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduler_log_time ON scheduler_log(timestamp DESC);
```

#### Existing tables (unchanged)

`sessions`, `messages`, `checkpoints`, `file_changes` — kept as-is. The `sessions`
table already has `workspace` and `parent_session_id` fields that KOS uses.

The only addition to sessions: when an orchestrator session is created for an epic,
the `workspace` field is set to the primary repo path (or a synthetic project path),
and the epic's `session_id` points to it.

---

## 3. How the Scheduler Knows Which Repos an Epic Touches

This is the critical question. Three mechanisms, applied in order:

### 3a. Manual tagging (user)

When creating or editing an epic, the EpicDetailPanel includes a **RepoScopeSelector**.
The user picks which repos from the project this epic will modify.

```
Target Repos:
☑ api   (/Users/alice/Work/myapp-api)
☐ web   (/Users/alice/Work/myapp-web)
☑ infra (/Users/alice/Work/myapp-infra)
```

This is stored in `epics.target_repos` as a JSON array of repo IDs.

### 3b. Scope analysis (automatic, pre-scheduling)

When an epic moves to the **Todo** column (either manually or after backlog refinement),
the scheduler can optionally run a **scope analysis** step. This is a lightweight,
read-only agent call:

```typescript
async analyzeEpicScope(epic: Epic, projectRepos: ProjectRepo[]): Promise<string[]> {
  // Send epic description + repo list to Claude in 'ask' mode (read-only)
  // Returns: array of repo IDs this epic likely touches
  const prompt = `Given this epic and these repositories, which repos will need changes?

    Epic: ${epic.title}
    Description: ${epic.description}

    Repositories:
    ${projectRepos.map(r => `- ${r.name} (${r.path}): ${describeRepo(r)}`).join('\n')}

    Return ONLY the repo names that need modification, one per line.`;

  // Quick analysis, no file edits
  const result = await this.runReadOnlyAgent(prompt);
  return parseRepoNames(result, projectRepos);
}
```

This runs once when the epic enters Todo (or when description changes significantly).
Cost: ~$0.01 per analysis. The result updates `target_repos`.

### 3c. Conservative default

If neither manual tagging nor scope analysis has run, `target_repos` is empty.
The scheduler treats empty as **"all repos in the project"** — the most conservative
assumption. This prevents accidental parallel execution when scope is unknown.

### Priority of mechanisms

```
User-set target_repos  >  Scope analysis result  >  Default (all repos)
```

If the user explicitly sets repos, that's final. Scope analysis only fills in
when the user hasn't specified. Default only applies when nothing else has.

---

## 4. Orchestrator — Multi-Depth Without Worktrees

### Branch-Based Isolation (No Worktrees)

Each in-progress epic gets a branch in each target repo:

```
Repo: /Users/alice/Work/myapp-api
  main
  └── kos/<epic-id>      ← created when epic starts

Repo: /Users/alice/Work/myapp-web
  main
  └── kos/<epic-id>      ← created when epic starts
```

When the epic starts, the scheduler:
1. Creates branch `kos/<epic-id>` from `default_branch` in each target repo
2. Checks out that branch in each repo
3. Starts the root orchestrator

When the epic completes:
1. Branches are ready for review (diff vs default_branch)
2. On approval: merge `kos/<epic-id>` → `default_branch` in each repo
3. On rejection: delete branches, epic goes back to Todo/Backlog

### Constraint: One Epic Per Repo at a Time

Without worktrees, only one branch can be checked out per repo directory at a time.
The scheduler enforces this:

```typescript
// repoLocks: Map<repoPath, epicId>
// A repo is "locked" while an epic has it checked out

canStartEpic(epic: Epic): boolean {
  const targetRepos = this.resolveTargetRepos(epic);
  for (const repo of targetRepos) {
    if (this.repoLocks.has(repo.path)) {
      return false; // Another epic holds this repo
    }
  }
  return true;
}
```

This means:
- Epic A touches `[api]`, Epic B touches `[web]` → **parallel OK**
- Epic A touches `[api]`, Epic C touches `[api]` → **sequential** (C waits for A)
- Epic A touches `[api, web]`, Epic B touches `[web]` → **sequential** (overlap on web)

The scheduler logs when it skips an epic due to repo contention:
```
"Skipped epic 'Fix auth' — repo 'api' locked by epic 'Add users'"
```

### Orchestrator Options (depth-aware)

```typescript
interface OrchestratorOptions {
  epicId: string;
  projectId: string;
  depth: number;              // 0 = root, 1+ = sub-orchestrator
  maxDepth: number;           // Hard cap (default: 3)
  parentSessionId: string | null;
  repoPaths: string[];        // Repo directories this orchestrator works in
  teamId: string;
}
```

### Agent Execution Model

Without worktrees, all agents within an epic share the same branch checkout.
This requires **sequential execution within a repo**.

```
Root Orchestrator (d0)
  │
  ├─ delegate(architect, "design auth system")
  │   → architect reads files across [api, web]
  │   → returns design doc
  │   → orchestrator commits: "checkpoint: architect phase"
  │
  ├─ delegate(implementer, "implement API routes")
  │   → implementer works in api/ repo
  │   → orchestrator commits: "checkpoint: implementer-1 phase"
  │
  ├─ delegate(implementer, "implement login page")
  │   → implementer works in web/ repo
  │   → orchestrator commits: "checkpoint: implementer-2 phase"
  │
  │   NOTE: implementer-1 and implementer-2 CAN run in parallel
  │   if they target different repos. The orchestrator system prompt
  │   instructs it to specify which repo each agent should work in.
  │
  ├─ delegate(tester, "write integration tests")
  │   → tester works across repos
  │   → orchestrator commits: "checkpoint: tester phase"
  │
  └─ done("Auth system implemented")
```

### Multi-Repo Agent Targeting

Each delegation includes a `workingDir` that tells the agent which repo to operate in.
For cross-repo tasks, the orchestrator delegates separate agents per repo or uses a
single agent with explicit instructions about which paths to modify.

```typescript
// Orchestrator system prompt addition for multi-repo projects:
`This epic spans multiple repositories:
${repoPaths.map(r => `- ${r.name}: ${r.path}`).join('\n')}

When delegating, specify which repository the agent should work in using the
working directory. For cross-repo tasks, delegate separate agents per repo
or instruct a single agent to work across paths.`
```

The `delegate` MCP tool gains an optional `working_dir` parameter:

```typescript
{
  name: 'delegate',
  inputSchema: {
    properties: {
      role: { type: 'string', enum: ['architect', 'implementer', 'reviewer', 'tester'] },
      task: { type: 'string' },
      working_dir: { type: 'string', description: 'Repo directory for this agent. Defaults to primary repo.' },
    },
    required: ['role', 'task'],
  },
}
```

### Sub-Orchestrator Spawning (Depth > 0)

When a task is too complex for a single orchestrator, it can spawn a sub-orchestrator.
Sub-orchestrators work on the **same branches** (no new branches per depth).

```
Root Orchestrator (d0) — works on kos/<epic-id> branches
  │
  ├─ spawn_orchestrator("implement auth subsystem")
  │   │
  │   Sub-Orchestrator (d1) — SAME branches, same repos
  │   ├─ delegate(architect, ...)
  │   ├─ delegate(implementer, ...)  → works in api/
  │   ├─ delegate(implementer, ...)  → works in web/
  │   ├─ delegate(tester, ...)
  │   └─ done("auth subsystem complete")
  │
  ├─ spawn_orchestrator("implement dashboard")
  │   │
  │   Sub-Orchestrator (d1) — SAME branches, same repos
  │   ├─ delegate(implementer, ...) → works in web/
  │   └─ done("dashboard complete")
  │
  └─ done("epic complete")
```

**Critical constraint:** Sub-orchestrators at the same depth that touch the same repo
must execute **sequentially**. The parent orchestrator is responsible for this — it
should not spawn two sub-orchestrators that both modify the same repo in parallel.

The system prompt enforces this:

```
When spawning sub-orchestrators:
- Sub-orchestrators that target DIFFERENT repos can run in parallel.
- Sub-orchestrators that target the SAME repo MUST run sequentially.
- If unsure, run them sequentially. Correctness > speed.
```

### spawn_orchestrator MCP Tool

```typescript
{
  name: 'spawn_orchestrator',
  inputSchema: {
    properties: {
      goal: { type: 'string', description: 'Sub-goal for the sub-orchestrator' },
      context: { type: 'string', description: 'Context from parent' },
      target_repos: {
        type: 'array',
        items: { type: 'string' },
        description: 'Repo paths this sub-orchestrator will work in. Subset of parent repos.',
      },
    },
    required: ['goal'],
  },
}
```

Only available when `depth < maxDepth`. Removed from system prompt at maxDepth.

### Depth-Aware System Prompt

```typescript
function getSystemPrompt(options: OrchestratorOptions): string {
  let prompt = ORCHESTRATOR_SYSTEM_PROMPT;

  // Multi-repo context
  if (options.repoPaths.length > 1) {
    prompt += `\n\nThis epic spans ${options.repoPaths.length} repositories:\n`;
    for (const repo of options.repoPaths) {
      prompt += `- ${repo}\n`;
    }
    prompt += `Specify working_dir when delegating to target a specific repo.\n`;
  }

  // Sub-orchestrator capability
  if (options.depth < options.maxDepth) {
    prompt += `\n\n## Sub-Orchestrator Spawning\n`;
    prompt += `You can call spawn_orchestrator(goal, context, target_repos) for complex sub-tasks.\n`;
    prompt += `Current depth: ${options.depth}/${options.maxDepth}.\n`;
    prompt += `Only use this when a sub-task has multiple phases or parallel independent subsystems.\n`;
    prompt += `If one or two specialist calls suffice, use delegate() directly.\n`;
  }

  // Anti-middle-management
  prompt += `\nDo NOT spawn a sub-orchestrator for a task that a single specialist could handle.\n`;

  return prompt;
}
```

### Budget Inheritance

```typescript
// Root orchestrator: MAX_TOTAL_DELEGATIONS (e.g., 100)
// Sub-orchestrator: parent's remaining / max(expectedChildren, 2)
const childBudget = Math.floor(this.remainingBudget() / Math.max(expectedChildren, 2));
```

### OrchestratorPool

Manages multiple orchestrators across projects and depths.

```typescript
class OrchestratorPool {
  // epicId → root orchestrator
  private roots = new Map<string, Orchestrator>();
  // sessionId → orchestrator (flat index, all depths)
  private bySession = new Map<string, Orchestrator>();

  async spawnRoot(epicId: string, goal: string, options: OrchestratorOptions): Promise<string>;
  registerSubOrchestrator(sessionId: string, orc: Orchestrator): void;
  routeToolCall(sessionId: string, toolName: string, args: any): void;
  routeDelegateFinished(childSessionId: string, output: string): void;
  removeEpic(epicId: string): void;  // Cancel + cleanup entire tree
  activeByProject(projectId: string): Orchestrator[];
  totalActive(): number;
}
```

### Commit Strategy

Without worktrees, all agents commit directly to the epic's branch in each repo.
The orchestrator auto-commits after each delegation phase completes:

```
kos/<epic-id> branch history:
  abc1234  checkpoint: architect phase completed
  def5678  checkpoint: implementer-1 phase completed
  ghi9012  checkpoint: implementer-2 phase completed
  jkl3456  checkpoint: tester phase completed
```

On approval, the entire branch is squash-merged to the default branch:

```
main:
  xyz7890  Epic: Add user authentication (#e1)
```

Clean single-commit history on main, full detail preserved on the epic branch.

---

## 5. Scheduler Design

### What It Does

The Scheduler is an engine-level singleton that:
1. Periodically evaluates all projects' Todo epics
2. Computes priority scores
3. Checks repo availability (locks)
4. Starts the highest-priority unblocked epics that fit
5. Detects completed orchestrators → moves to Review
6. Logs all decisions

### Data Structures

```typescript
type EpicColumn = 'idea' | 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type PriorityHint = 'critical' | 'high' | 'medium' | 'low';
type ComplexityEstimate = 'trivial' | 'small' | 'medium' | 'large' | 'epic';

interface SchedulerAction {
  type: 'start' | 'to-review' | 'requeue' | 'complete' | 'skip';
  epicId: string;
  projectId: string;
  reason: string;
}

// Runtime state (not persisted)
interface RepoLock {
  repoPath: string;
  epicId: string;
  lockedAt: number;
}
```

### Scoring Algorithm

Same as KOS.md — deterministic, no LLM. Runs across ALL projects' Todo epics:

```typescript
function computePriorityScore(epic: Epic, allEpics: Epic[], config: SchedulerConfig): number {
  const w = config.weights;

  // 1. Manual hint (0-100)
  const hintScore = { critical: 100, high: 75, medium: 50, low: 25 }[epic.priorityHint];

  // 2. Dependency depth — epics that unblock others score higher (0-100)
  const downstream = countDownstreamEpics(epic.id, allEpics);
  const depthScore = allEpics.length > 0 ? (downstream / allEpics.length) * 100 : 0;

  // 3. Age — older epics get gentle boost, caps at 1 week (0-100)
  const ageHours = (Date.now() - epic.createdAt) / 3_600_000;
  const ageScore = Math.min(ageHours / 168, 1) * 100;

  // 4. Complexity — smaller items score higher (0-100)
  const complexityScore = { trivial: 100, small: 80, medium: 60, large: 40, epic: 20 }[epic.complexity];

  // 5. Rejection penalty (subtracted)
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

### Repo Conflict Detection

The scheduler's key addition over KOS.md: repo-level concurrency control.

```typescript
class Scheduler {
  private repoLocks = new Map<string, RepoLock>(); // repoPath → lock

  /**
   * Check if an epic can start without repo conflicts.
   */
  canAcquireRepos(epic: Epic, projectRepos: ProjectRepo[]): { ok: boolean; blockedBy?: string } {
    const targetRepos = this.resolveTargetRepos(epic, projectRepos);

    for (const repo of targetRepos) {
      const lock = this.repoLocks.get(repo.path);
      if (lock) {
        return { ok: false, blockedBy: lock.epicId };
      }
    }
    return { ok: true };
  }

  /**
   * Lock repos for an epic. Called when starting an epic.
   */
  acquireRepos(epicId: string, repos: ProjectRepo[]): void {
    for (const repo of repos) {
      this.repoLocks.set(repo.path, { repoPath: repo.path, epicId, lockedAt: Date.now() });
    }
  }

  /**
   * Release repos when an epic leaves in-progress. Called on completion/failure/cancel.
   */
  releaseRepos(epicId: string): void {
    for (const [path, lock] of this.repoLocks) {
      if (lock.epicId === epicId) {
        this.repoLocks.delete(path);
      }
    }
  }
}
```

### Same-Project Parallel Execution

The scheduler CAN run two epics from the same project in parallel IF they touch
different repos:

```
Project: MyApp
  repos: [api, web, docs]

  Epic A: "Add auth API"     → target_repos: [api]
  Epic B: "Improve README"   → target_repos: [docs]
  Epic C: "Login page"       → target_repos: [web, api]

Scheduler decision:
  - Start Epic A → locks [api] ✓
  - Start Epic B → locks [docs] ✓ (no overlap with A)
  - Skip Epic C → needs [api] which is locked by A ✗
  - When A completes → release [api] → C can start
```

### Tick Loop

```typescript
class Scheduler {
  async tick(): Promise<SchedulerAction[]> {
    const actions: SchedulerAction[] = [];
    const config = await this.loadConfig();

    // 1. Recompute priority scores for ALL Todo epics across ALL projects
    const allEpics = await this.epicStore.allEpics();
    const todoEpics = allEpics.filter(e => e.column === 'todo');

    for (const epic of todoEpics) {
      const score = computePriorityScore(epic, allEpics, config);
      this.epicStore.updatePriority(epic.id, score, this.explainScore(epic, score));
    }

    // 2. Sort ALL Todo epics by score (cross-project)
    const sorted = [...todoEpics].sort((a, b) => b.priorityScore - a.priorityScore);

    // 3. Check global capacity
    const inProgress = allEpics.filter(e => e.column === 'in-progress');
    const slots = config.maxConcurrentEpics - inProgress.length;

    // 4. Pick top N that are unblocked AND have repos available
    for (const epic of sorted) {
      if (actions.filter(a => a.type === 'start').length >= slots) break;

      // Check dependency blocking
      const blocked = this.isBlocked(epic, allEpics);
      if (blocked) {
        actions.push({ type: 'skip', epicId: epic.id, projectId: epic.projectId,
          reason: `Blocked by dependency: ${blocked}` });
        continue;
      }

      // Check repo availability
      const projectRepos = await this.getProjectRepos(epic.projectId);
      const repoCheck = this.canAcquireRepos(epic, projectRepos);
      if (!repoCheck.ok) {
        actions.push({ type: 'skip', epicId: epic.id, projectId: epic.projectId,
          reason: `Repo locked by epic ${repoCheck.blockedBy}` });
        continue;
      }

      // Check cost budget
      if (config.costBudgetUsd && epic.totalCostUsd >= config.costBudgetUsd) {
        actions.push({ type: 'skip', epicId: epic.id, projectId: epic.projectId,
          reason: 'Cost budget exceeded' });
        continue;
      }

      actions.push({ type: 'start', epicId: epic.id, projectId: epic.projectId,
        reason: `Score: ${epic.priorityScore.toFixed(1)}` });
    }

    // 5. Detect completed orchestrators → to-review
    for (const epic of inProgress) {
      if (this.orchestratorPool.isCompleted(epic.sessionId)) {
        actions.push({ type: 'to-review', epicId: epic.id, projectId: epic.projectId,
          reason: 'Orchestrator completed' });
      }
      if (this.orchestratorPool.isFailed(epic.sessionId)) {
        actions.push({ type: 'to-review', epicId: epic.id, projectId: epic.projectId,
          reason: 'Orchestrator failed' });
      }
    }

    // 6. Execute (if auto) or return for UI
    if (config.autoSchedule) {
      for (const action of actions) {
        if (action.type === 'start') await this.executeStart(action.epicId);
        if (action.type === 'to-review') await this.executeToReview(action.epicId);
      }
    }

    // 7. Log all actions
    for (const action of actions) {
      await this.logAction(action);
    }

    return actions;
  }
}
```

### Start Epic Flow

```typescript
async executeStart(epicId: string): Promise<void> {
  const epic = this.epicStore.get(epicId);
  const project = this.projectStore.get(epic.projectId);
  const projectRepos = await this.getProjectRepos(epic.projectId);
  const targetRepos = this.resolveTargetRepos(epic, projectRepos);

  // 1. Acquire repo locks
  this.acquireRepos(epicId, targetRepos);

  // 2. Create branches in each target repo
  for (const repo of targetRepos) {
    const branchName = `kos/${epicId}`;
    await exec(`git -C "${repo.path}" checkout -b "${branchName}" "${repo.defaultBranch}"`);
    await this.db.saveEpicBranch(epicId, repo.id, branchName);
  }

  // 3. Checkout epic branches (so agents work on them)
  for (const repo of targetRepos) {
    await exec(`git -C "${repo.path}" checkout "kos/${epicId}"`);
  }

  // 4. Build goal prompt
  const goal = this.buildGoalPrompt(epic, targetRepos);

  // 5. Spawn root orchestrator
  const options: OrchestratorOptions = {
    epicId,
    projectId: epic.projectId,
    depth: 0,
    maxDepth: 3,
    parentSessionId: null,
    repoPaths: targetRepos.map(r => r.path),
    teamId: crypto.randomUUID(),
  };

  const sessionId = await this.orchestratorPool.spawnRoot(epicId, goal, options);

  // 6. Update epic state
  this.epicStore.moveToInProgress(epicId, sessionId);
}
```

### Approval Flow

```typescript
async approveEpic(epicId: string): Promise<void> {
  const epic = this.epicStore.get(epicId);
  const branches = await this.db.getEpicBranches(epicId);

  // 1. Merge each branch into its repo's default branch
  for (const branch of branches) {
    const repo = await this.db.getProjectRepo(branch.repoId);

    // Switch to default branch
    await exec(`git -C "${repo.path}" checkout "${repo.defaultBranch}"`);

    // Squash merge
    const result = await exec(
      `git -C "${repo.path}" merge --squash "kos/${epicId}"`,
      { throwOnError: false }
    );

    if (result.exitCode !== 0) {
      this.epicStore.setReviewNotes(epicId,
        `Merge conflict in ${repo.name}: ${result.stderr}`);
      // Switch back to epic branch to preserve state
      await exec(`git -C "${repo.path}" checkout "kos/${epicId}"`);
      return; // Don't complete — reviewer must resolve
    }

    // Commit the squash
    const commitMsg = `${epic.title} (#${epicId.slice(0, 8)})`;
    await exec(`git -C "${repo.path}" commit -m "${commitMsg}"`);
    const hash = await exec(`git -C "${repo.path}" rev-parse --short HEAD`);

    await this.db.updateEpicBranch(epicId, branch.repoId, 'merged', hash.stdout.trim());
  }

  // 2. Delete epic branches
  for (const branch of branches) {
    const repo = await this.db.getProjectRepo(branch.repoId);
    await exec(`git -C "${repo.path}" branch -D "kos/${epicId}"`, { throwOnError: false });
  }

  // 3. Release repo locks
  this.releaseRepos(epicId);

  // 4. Move to done
  this.epicStore.moveToDone(epicId);
}
```

### Rejection Flow

```typescript
async rejectEpic(epicId: string, notes: string, action: 'changes-requested' | 'rejected'): Promise<void> {
  const epic = this.epicStore.get(epicId);
  const branches = await this.db.getEpicBranches(epicId);

  // 1. Delete epic branches in each repo, restore default branch
  for (const branch of branches) {
    const repo = await this.db.getProjectRepo(branch.repoId);
    await exec(`git -C "${repo.path}" checkout "${repo.defaultBranch}"`);
    await exec(`git -C "${repo.path}" branch -D "kos/${epicId}"`, { throwOnError: false });
    await this.db.updateEpicBranch(epicId, branch.repoId, 'deleted');
  }

  // 2. Release repo locks
  this.releaseRepos(epicId);

  // 3. Update epic
  this.epicStore.updateEpic(epicId, {
    reviewNotes: notes,
    reviewResult: action,
    reviewedAt: Date.now(),
    rejectionCount: epic.rejectionCount + 1,
    sessionId: null,
  });

  // 4. Move to appropriate column
  if (action === 'changes-requested') {
    this.epicStore.moveToColumn(epicId, 'todo');    // Scheduler will re-run with feedback
  } else {
    this.epicStore.moveToColumn(epicId, 'backlog'); // Needs manual re-triage
  }
}
```

---

## 6. Pinia Stores

### ProjectStore (`src/stores/projects.ts`)

```typescript
const useProjectStore = defineStore('projects', () => {
  const projects = ref<Map<string, Project>>(new Map());
  const selectedProjectId = ref<string | null>(null);

  const selectedProject = computed(() => ...);
  const projectList = computed(() => Array.from(projects.value.values()));

  function createProject(name: string, description?: string): string;
  function updateProject(id: string, updates: Partial<Project>): void;
  function deleteProject(id: string): void;
  function addRepo(projectId: string, name: string, path: string, defaultBranch?: string): string;
  function removeRepo(repoId: string): void;
  function getProjectRepos(projectId: string): ProjectRepo[];
  async function loadFromDatabase(): Promise<void>;

  return { projects, selectedProjectId, selectedProject, projectList, ... };
});
```

### EpicStore (`src/stores/epics.ts`)

```typescript
const useEpicStore = defineStore('epics', () => {
  const epics = ref<Map<string, Epic>>(new Map());
  const selectedEpicId = ref<string | null>(null);

  // Filtered by current project
  const projectEpics = computed(() => ...);
  const columns = computed(() => /* group by column, sort */);
  const selectedEpic = computed(() => ...);

  function createEpic(projectId: string, title: string, column?: EpicColumn): string;
  function updateEpic(id: string, updates: Partial<Epic>): void;
  function moveToColumn(id: string, column: EpicColumn): void;
  function moveToInProgress(id: string, sessionId: string): void;
  function moveToReview(id: string): void;
  function moveToDone(id: string): void;
  function updatePriority(id: string, score: number, reason: string): void;
  function deleteEpic(id: string): void;
  async function loadFromDatabase(): Promise<void>;
  async function persistEpic(id: string): Promise<void>;

  return { epics, selectedEpicId, columns, selectedEpic, ... };
});
```

### UIStore changes

```typescript
// Add to existing ui.ts
const viewMode = ref<'home' | 'kanban' | 'manager' | 'editor' | 'mission-control'>('home');
const activeProjectId = ref<string | null>(null);
const activeEpicId = ref<string | null>(null);
```

---

## 7. Development Phases

### Phase 1: Data Model & Storage

**Goal:** Projects, repos, and epics exist in the database with CRUD.

**New files:**
- `src/engine/KosTypes.ts` — Project, ProjectRepo, Epic, SchedulerConfig types
- `src/stores/projects.ts` — ProjectStore
- `src/stores/epics.ts` — EpicStore

**Modified files:**
- `src/engine/Database.ts` — Add tables, CRUD methods

**Validation:**
- Create project with 2 repos, create 3 epics, persist, reload, verify.

### Phase 2: Home View & Project Management

**Goal:** Angy opens to HomeView. User can create/edit projects and repos.

**New files:**
- `src/components/home/HomeView.vue`
- `src/components/home/ProjectCard.vue`
- `src/components/home/NewProjectDialog.vue`
- `src/components/home/ProjectSettingsDialog.vue`

**Modified files:**
- `src/App.vue` — Replace WorkspaceSelector with HomeView, add view routing
- `src/stores/ui.ts` — Add `'home'` and `'kanban'` to viewMode

**Validation:**
- App opens to project list. Create project, add repos. Click project → see empty kanban.

### Phase 3: Kanban Board (Static)

**Goal:** Kanban board renders epics in 6 columns. Drag between allowed columns.

**New files:**
- `src/components/kanban/KanbanView.vue`
- `src/components/kanban/KanbanColumn.vue`
- `src/components/kanban/EpicCard.vue`
- `src/components/kanban/KanbanToolbar.vue`
- `src/components/kanban/EpicDetailPanel.vue`
- `src/components/kanban/RepoScopeSelector.vue`

**Validation:**
- 6 columns render. Cards drag between Idea/Backlog/Todo. Detail panel edits persist.
- RepoScopeSelector shows project repos, selection persists.

### Phase 4: Scheduler Engine

**Goal:** Scheduler computes scores, checks repo locks, starts epics.

**New files:**
- `src/engine/Scheduler.ts`
- `src/components/kanban/SchedulerConfigDialog.vue`
- `src/components/home/SchedulerStatusBar.vue`

**Modified files:**
- `src/stores/epics.ts` — Scheduler-related actions

**Validation:**
- Priority scores compute correctly.
- Repo locking prevents conflicting parallel starts.
- Manual "Schedule Now" starts top epic.

### Phase 5: OrchestratorPool + Branch Management

**Goal:** Starting an epic creates branches, spawns orchestrator, agents work on branches.

**New files:**
- `src/engine/OrchestratorPool.ts`
- `src/engine/BranchManager.ts` — create/merge/delete branches per repo

**Modified files:**
- `src/engine/Orchestrator.ts` — Add OrchestratorOptions, depth awareness
- `src/composables/useEngine.ts` — Route through pool
- `src/composables/useOrchestrator.ts` — Pool instead of singleton
- `src/engine/ClaudeProcess.ts` — Support working_dir per agent

**Validation:**
- Start epic → branches created in target repos.
- Orchestrator delegates → agents work on correct branches.
- Second epic on same repo waits (repo lock).
- Two epics on different repos run in parallel.

### Phase 6: Multi-Depth Orchestration

**Goal:** Orchestrators can spawn sub-orchestrators.

**Modified files:**
- `src/engine/Orchestrator.ts` — spawn_orchestrator command, budget inheritance
- `src/engine/OrchestratorPool.ts` — registerSubOrchestrator, depth routing
- `resources/mcp/orchestrator_server.py` — spawn_orchestrator tool

**Validation:**
- Root can spawn sub-orchestrator. Sub-orchestrator delegates to specialists.
- At maxDepth, spawn_orchestrator is unavailable.
- Budget limits prevent runaway delegation.

### Phase 7: Review Flow

**Goal:** Human reviews epics with diff, approve/reject/request-changes.

**Modified files:**
- `src/components/kanban/EpicDetailPanel.vue` — Review mode UI
- `src/engine/Scheduler.ts` — Approval merge, rejection cleanup

**Validation:**
- Completed epic → auto-moves to Review.
- Approve → squash-merge to default branch in each repo → Done.
- Request Changes → back to Todo with feedback context.
- Reject → back to Backlog.

### Phase 8: Epic Workspace Navigation

**Goal:** Clicking an in-progress epic opens the existing manager/editor views scoped to it.

**Modified files:**
- `src/App.vue` — Wire epic selection → manager view
- `src/components/fleet/FleetHeader.vue` — Context-aware header
- `src/components/sidebar/WorkspaceTree.vue` — Multi-repo file tree
- `src/stores/ui.ts` — activeEpicId tracking

**Validation:**
- Click epic card → manager view with correct session tree.
- Editor shows multi-repo file tree.
- "← Board" returns to kanban.

### Phase 9: Polish & Persistence

**Goal:** State survives restart, scheduler config persists, UX polish.

**Work:**
- Persist scheduler config.
- Load board state on launch.
- Restore repo locks for in-progress epics on restart.
- Scheduler log display in UI.
- Keyboard shortcuts: `Cmd+H` → home, `Cmd+K` → kanban.
- Epic search/filter.

---

## 8. Critical Traps

### Stale Repo Checkout on Crash

If Angy crashes while an epic is in-progress, repos may be left on epic branches.
On restart, the scheduler must:
1. Scan all in-progress epics.
2. Verify branches still exist in repos.
3. Restore repo locks.
4. Offer "Resume" or "Abandon" per stale epic.

### Concurrent Merge to Default Branch

When two epics targeting different repos in the same project both approve at the same
time, their merges are independent (different repos) — no issue. But if manual review
timing causes two epics that touched the same repo to both be in Review simultaneously
(shouldn't happen due to repo locks, but could if locks are released early), serialize
the merges with a mutex.

### User Edits Repo Manually While Epic Running

If the user opens a terminal and makes changes in a repo that has an active epic branch,
those changes will be committed by the orchestrator's auto-checkpoint. The system should
warn if unexpected changes are detected (uncommitted changes not from agents).

### Branch Naming Collisions

Epic IDs are UUIDs, so `kos/<uuid>` branches won't collide. But if a user manually
creates a branch named `kos/...`, it could conflict. The branch creation step should
check for existing branches and fail clearly.

### Scope Analysis Cost

The optional scope analysis agent adds ~$0.01 per epic. For high-throughput usage
(dozens of epics), this could add up. Make it configurable: off, on-demand, or automatic.

### Agent Working Directory

Each delegated agent's `ClaudeProcess` must be configured with the correct `workingDir`
pointing to the specific repo. The `delegate` MCP tool's `working_dir` parameter maps
to the `--cwd` or equivalent in the ClaudeProcess spawn. If omitted, defaults to the
first repo in the epic's target list.

---

## 9. File Index

| File | Status | Description |
|---|---|---|
| `src/engine/KosTypes.ts` | New | Project, ProjectRepo, Epic, Scheduler types |
| `src/engine/Scheduler.ts` | New | Scheduler engine with repo locking |
| `src/engine/OrchestratorPool.ts` | New | Multi-orchestrator manager |
| `src/engine/BranchManager.ts` | New | Branch create/merge/delete per repo |
| `src/stores/projects.ts` | New | Project + repo Pinia store |
| `src/stores/epics.ts` | New | Epic Pinia store |
| `src/components/home/HomeView.vue` | New | Project list (Level 1) |
| `src/components/home/ProjectCard.vue` | New | Project summary card |
| `src/components/home/NewProjectDialog.vue` | New | Create project dialog |
| `src/components/home/ProjectSettingsDialog.vue` | New | Edit project settings |
| `src/components/home/SchedulerStatusBar.vue` | New | Global scheduler status |
| `src/components/kanban/KanbanView.vue` | New | Kanban board (Level 2) |
| `src/components/kanban/KanbanColumn.vue` | New | Column component |
| `src/components/kanban/EpicCard.vue` | New | Card component |
| `src/components/kanban/KanbanToolbar.vue` | New | Board toolbar |
| `src/components/kanban/EpicDetailPanel.vue` | New | Detail/editor/review panel |
| `src/components/kanban/RepoScopeSelector.vue` | New | Repo picker for epics |
| `src/components/kanban/SchedulerConfigDialog.vue` | New | Scheduler settings |
| `src/engine/Database.ts` | Modified | Add 6 new tables |
| `src/engine/types.ts` | Modified | Export KOS types |
| `src/engine/Orchestrator.ts` | Modified | OrchestratorOptions, spawn_orchestrator, depth, working_dir |
| `src/engine/ClaudeProcess.ts` | Modified | Support per-agent working_dir |
| `src/stores/ui.ts` | Modified | Add home/kanban viewMode, activeProjectId, activeEpicId |
| `src/composables/useEngine.ts` | Modified | Route through OrchestratorPool |
| `src/composables/useOrchestrator.ts` | Modified | Pool instead of singleton |
| `src/components/fleet/FleetHeader.vue` | Modified | Context-aware header per viewMode |
| `src/components/sidebar/WorkspaceTree.vue` | Modified | Multi-repo file tree |
| `src/App.vue` | Modified | 3-level view routing, remove WorkspaceSelector gate |
| `resources/mcp/orchestrator_server.py` | Modified | Add spawn_orchestrator, working_dir on delegate |
