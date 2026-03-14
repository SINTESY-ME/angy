# GITMNG — Flexible Git Management for Epics

## Overview

This document is the implementation spec for three interconnected features:

1. **Git worktrees** — isolate each epic in its own filesystem copy so multiple epics on the same project run in parallel
2. **Per-epic base branch** — choose which branch to fork from (not always `defaultBranch`)
3. **RunAfter chain branch inheritance** — successor epics reuse the predecessor's exact branch + worktree
4. **Scheduler blocking visibility** — show the user exactly why an epic is stuck in Upcoming
5. **Branch picker component** — proper UX for selecting/creating branches

---

## Part 1: Data Model Changes

### 1A. `Epic` interface — `src/engine/KosTypes.ts` line 80–109

Add two fields after `useGitBranch` (line 92):

```typescript
export interface Epic {
  // ... existing fields ...
  useGitBranch: boolean;
  useWorktree: boolean;       // NEW — opt-in worktree isolation (only when useGitBranch is true)
  baseBranch: string | null;  // NEW — per-epic base branch override; null = repo.defaultBranch
  dependsOn: string[];
  // ... rest unchanged ...
}
```

### 1B. `EpicBranch` interface — `src/engine/KosTypes.ts` line 113–120

Add `worktreePath`:

```typescript
export interface EpicBranch {
  id: string;
  epicId: string;
  repoId: string;
  branchName: string;
  baseBranch: string;
  worktreePath: string | null;  // NEW — filesystem path of worktree, null if checkout-based
  status: 'active' | 'merged' | 'deleted' | 'tracking';
}
```

### 1C. `BlockingReason` type — `src/engine/KosTypes.ts` (add after `RepoLock`, line 127)

```typescript
export type BlockingReasonType =
  | 'runAfter'
  | 'dependency'
  | 'repoLock'
  | 'concurrency'
  | 'projectConcurrency'
  | 'budget';

export interface BlockingReason {
  type: BlockingReasonType;
  label: string;
  relatedEpicId?: string;
  relatedRepoId?: string;
}
```

---

## Part 2: Database Migration

### 2A. `src/engine/Database.ts` — add migrations in the `open()` method

After the existing `run_after` migration (around line 204), add:

```typescript
try {
  await this.db.execute(`ALTER TABLE epics ADD COLUMN use_worktree INTEGER DEFAULT 0`);
} catch { /* column already exists */ }
try {
  await this.db.execute(`ALTER TABLE epics ADD COLUMN base_branch TEXT DEFAULT NULL`);
} catch { /* column already exists */ }
try {
  await this.db.execute(`ALTER TABLE epic_branches ADD COLUMN worktree_path TEXT DEFAULT NULL`);
} catch { /* column already exists */ }
```

### 2B. `saveEpic` — `src/engine/Database.ts` line 699–738

Add `use_worktree` and `base_branch` to the INSERT column list and values.

Current column list (line 703–707):
```sql
(id, project_id, title, description, acceptance_criteria, "column", priority_hint,
 complexity, model, depends_on, target_repos, pipeline_type, use_git_branch,
 rejection_count, rejection_feedback, last_attempt_files, last_validation_results,
 last_architect_plan, computed_score, root_session_id, cost_total,
 created_at, updated_at, started_at, completed_at, suspended_at, run_after)
```

Becomes:
```sql
(id, project_id, title, description, acceptance_criteria, "column", priority_hint,
 complexity, model, depends_on, target_repos, pipeline_type, use_git_branch,
 use_worktree, base_branch,
 rejection_count, rejection_feedback, last_attempt_files, last_validation_results,
 last_architect_plan, computed_score, root_session_id, cost_total,
 created_at, updated_at, started_at, completed_at, suspended_at, run_after)
```

Add to the values array (after `epic.useGitBranch ? 1 : 0` at line 722):
```typescript
epic.useWorktree ? 1 : 0,
epic.baseBranch ?? null,
```

Bump all `$N` placeholders accordingly (from `$14` onward, shift by +2, so total goes from `$27` to `$29`).

### 2C. `rowToEpic` — `src/engine/Database.ts` line 1303–1333

After `useGitBranch` (line 1317), add:
```typescript
useWorktree: Boolean(r.use_worktree ?? 0),
baseBranch: r.base_branch || null,
```

### 2D. `saveEpicBranch` — `src/engine/Database.ts` line 785–793

Change the INSERT to include `worktree_path`:

```sql
INSERT OR REPLACE INTO epic_branches (id, epic_id, repo_id, branch_name, base_branch, status, worktree_path, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
```

Values array becomes:
```typescript
[branch.id, branch.epicId, branch.repoId, branch.branchName, branch.baseBranch, branch.status, branch.worktreePath ?? null, new Date().toISOString()]
```

### 2E. `loadEpicBranches` — `src/engine/Database.ts` line 795–810

Add `worktree_path` to the SELECT and the mapping:

```typescript
const rows = await this.db.select<any[]>(
  'SELECT id, epic_id, repo_id, branch_name, base_branch, status, worktree_path FROM epic_branches WHERE epic_id = $1',
  [epicId],
);
return rows.map((r) => ({
  id: r.id,
  epicId: r.epic_id,
  repoId: r.repo_id,
  branchName: r.branch_name,
  baseBranch: r.base_branch,
  worktreePath: r.worktree_path || null,
  status: r.status,
}));
```

Same for `loadAllEpicBranches` (line 811–828).

---

## Part 3: BranchManager Worktree Methods

### 3A. File: `src/engine/BranchManager.ts`

Add a new section between "Branch ON operations" (line 131) and "Branch restoration" (line 165). Also add two static helpers and update `deleteEpicBranches`.

#### New static helper (after `epicTitleToSlug`, line 95–104):

```typescript
static computeWorktreePath(repoPath: string, slug: string): string {
  return `${repoPath}/.angy-worktrees/${slug}`
}
```

#### New method: `listBranches` (after `pushBranch`, line 64–77):

```typescript
async listBranches(repoPath: string): Promise<string[]> {
  try {
    const result = await this.runGit(repoPath, ['branch', '--list', '--format=%(refname:short)'])
    if (result.code !== 0) return []
    return result.stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

async createBranch(repoPath: string, branchName: string, baseBranch?: string): Promise<boolean> {
  const args = ['branch', branchName]
  if (baseBranch) args.push(baseBranch)
  const result = await this.runGit(repoPath, args)
  return result.code === 0
}
```

#### New section: "Worktree operations" (insert after line 163, before "Branch restoration"):

```typescript
// ── Worktree operations ────────────────────────────────────────────

async ensureExcludeEntry(repoPath: string): Promise<void> {
  const excludePath = `${repoPath}/.git/info/exclude`
  const entry = '.angy-worktrees'
  try {
    const { readTextFile, writeTextFile } = await import('@tauri-apps/plugin-fs')
    let content = ''
    try {
      content = await readTextFile(excludePath)
    } catch { /* file may not exist */ }
    if (!content.split('\n').includes(entry)) {
      const newContent = content.trimEnd() + '\n' + entry + '\n'
      await writeTextFile(excludePath, newContent)
      console.log(`[BranchManager] Added ${entry} to ${excludePath}`)
    }
  } catch (err) {
    console.warn(`[BranchManager] Failed to update exclude file:`, err)
  }
}

async createWorktree(
  repoPath: string,
  branchName: string,
  baseBranch: string,
  worktreeDir: string,
): Promise<boolean> {
  if (!(await this.isGitRepo(repoPath))) return false

  await this.ensureExcludeEntry(repoPath)

  try {
    const exists = await this.branchExists(repoPath, branchName)
    let result
    if (exists) {
      result = await this.runGit(repoPath, ['worktree', 'add', worktreeDir, branchName])
    } else {
      result = await this.runGit(repoPath, ['worktree', 'add', '-b', branchName, worktreeDir, baseBranch])
    }
    if (result.code !== 0) {
      console.warn(`[BranchManager] Failed to create worktree at ${worktreeDir}: ${result.stderr}`)
      return false
    }
    console.log(`[BranchManager] Created worktree at ${worktreeDir} on branch ${branchName}`)
    return true
  } catch (err) {
    console.warn(`[BranchManager] Error creating worktree:`, err)
    return false
  }
}

async removeWorktree(repoPath: string, worktreeDir: string): Promise<boolean> {
  try {
    const result = await this.runGit(repoPath, ['worktree', 'remove', worktreeDir, '--force'])
    if (result.code !== 0) {
      console.warn(`[BranchManager] Failed to remove worktree ${worktreeDir}: ${result.stderr}`)
      return false
    }
    console.log(`[BranchManager] Removed worktree ${worktreeDir}`)
    return true
  } catch (err) {
    console.warn(`[BranchManager] Error removing worktree:`, err)
    return false
  }
}

async listWorktrees(repoPath: string): Promise<string[]> {
  try {
    const result = await this.runGit(repoPath, ['worktree', 'list', '--porcelain'])
    if (result.code !== 0) return []
    return result.stdout
      .split('\n')
      .filter(line => line.startsWith('worktree '))
      .map(line => line.replace('worktree ', ''))
  } catch {
    return []
  }
}

async pruneWorktrees(repoPath: string): Promise<void> {
  await this.runGit(repoPath, ['worktree', 'prune'])
}
```

#### Update `deleteEpicBranches` (line 215–236):

Replace the existing method body. For each branch, if it has a `worktreePath`, remove the worktree first, then delete the branch:

```typescript
async deleteEpicBranches(epicId: string): Promise<void> {
  const branches = await this.db.loadEpicBranches(epicId)

  for (const branch of branches) {
    if (branch.status === 'tracking') continue
    const repo = await this.resolveRepo(branch.repoId)
    if (!repo) continue

    if (await this.isGitRepo(repo.path)) {
      try {
        // Remove worktree first if it exists
        if (branch.worktreePath) {
          await this.removeWorktree(repo.path, branch.worktreePath)
        }
        await this.runGit(repo.path, ['branch', '-D', branch.branchName])
      } catch (err) {
        console.warn(
          `[BranchManager] Error deleting branch in ${repo.name}:`,
          err,
        )
      }
    }
  }

  await this.db.deleteEpicBranches(epicId)
}
```

---

## Part 4: OrchestratorPool — Worktree + Chain Support

### 4A. File: `src/engine/OrchestratorPool.ts`

#### Add Database dependency to constructor

The pool needs DB access to look up predecessor branch records for `runAfter` chains. Add `db` parameter:

In the private constructor (line 46):
```typescript
private db: Database
private constructor(branchManager: BranchManager, db: Database) {
  this.branchManager = branchManager
  this.db = db
}
```

Update `getInstance` (line 50–58):
```typescript
static getInstance(branchManager?: BranchManager, db?: Database): OrchestratorPool {
  if (!OrchestratorPool.instance) {
    if (!branchManager || !db) {
      throw new Error('BranchManager and Database required for first OrchestratorPool initialization')
    }
    OrchestratorPool.instance = new OrchestratorPool(branchManager, db)
  }
  return OrchestratorPool.instance
}
```

Update caller in `AngyEngine.ts` (line 78):
```typescript
this.pool = OrchestratorPool.getInstance(this.branchManager, this.db);
```

#### Add `inheritFromPredecessor` method (new, at end of class before closing `}`):

```typescript
private async inheritFromPredecessor(
  epic: Epic,
  repo: ProjectRepo,
): Promise<EpicBranch | null> {
  if (!epic.runAfter) return null

  const predecessorBranches = await this.db.loadEpicBranches(epic.runAfter)
  const matching = predecessorBranches.find(
    b => b.repoId === repo.id && (b.status === 'active' || b.status === 'merged'),
  )
  if (!matching) return null

  return {
    id: crypto.randomUUID(),
    epicId: epic.id,
    repoId: repo.id,
    branchName: matching.branchName,
    baseBranch: matching.baseBranch,
    worktreePath: matching.worktreePath,
    status: 'active',
  }
}
```

#### Rewrite the repo preparation loop in `spawnRoot` (line 97–136):

Replace the entire block from `const isReadOnly` to the closing `}` of the for-loop:

```typescript
const isReadOnly = epic.pipelineType === 'investigate' || epic.pipelineType === 'plan'
if (repos.length > 0 && !isReadOnly) {
  for (const repo of repos) {
    const effectiveBase = epic.baseBranch || repo.defaultBranch

    if (epic.useGitBranch && epic.useWorktree) {
      // ── Worktree path ──────────────────────────────
      const inherited = await this.inheritFromPredecessor(epic, repo)
      if (inherited) {
        // Reuse predecessor's worktree + branch (runAfter chain continuation)
        await this.branchManager.saveBranchRecord(inherited)
        // Update repoPaths to point to the worktree
        options.repoPaths[repo.id] = inherited.worktreePath ?? repo.path
      } else {
        // Create fresh worktree
        const slug = BranchManager.epicTitleToSlug(epic.title)
        const branchName = `epic/${slug}`
        const wtPath = BranchManager.computeWorktreePath(repo.path, slug)

        await this.branchManager.createCheckpoint(repo.path, epic.title)
        const ok = await this.branchManager.createWorktree(
          repo.path, branchName, effectiveBase, wtPath,
        )
        if (ok) {
          const branch: EpicBranch = {
            id: crypto.randomUUID(),
            epicId,
            repoId: repo.id,
            branchName,
            baseBranch: effectiveBase,
            worktreePath: wtPath,
            status: 'active',
          }
          await this.branchManager.saveBranchRecord(branch)
          options.repoPaths[repo.id] = wtPath
        }
      }
    } else if (epic.useGitBranch) {
      // ── Checkout-based branch (existing behavior, uses effectiveBase) ──
      await this.branchManager.createCheckpoint(repo.path, epic.title)
      const slug = BranchManager.epicTitleToSlug(epic.title)
      const branchName = `epic/${slug}`
      const ok = await this.branchManager.createAndCheckoutEpicBranch(
        repo.path, branchName, effectiveBase,
      )
      if (ok) {
        const branch: EpicBranch = {
          id: crypto.randomUUID(),
          epicId,
          repoId: repo.id,
          branchName,
          baseBranch: effectiveBase,
          worktreePath: null,
          status: 'active',
        }
        await this.branchManager.saveBranchRecord(branch)
      }
    } else {
      // ── Tracking mode (no branch creation) ──
      const currentBranch = await this.branchManager.getCurrentBranch(repo.path)
      if (currentBranch) {
        const branch: EpicBranch = {
          id: crypto.randomUUID(),
          epicId,
          repoId: repo.id,
          branchName: currentBranch,
          baseBranch: currentBranch,
          worktreePath: null,
          status: 'tracking',
        }
        await this.branchManager.saveBranchRecord(branch)
      }
    }
  }
}
```

---

## Part 5: Scheduler Changes

### 5A. File: `src/engine/Scheduler.ts`

#### Import `BlockingReason` (line 12):

```typescript
import type { Epic, SchedulerConfig, SchedulerAction, RepoLock, BlockingReason, PriorityHint, ComplexityEstimate, OrchestratorOptions } from './KosTypes';
```

#### New method: `getBlockingReasons` (insert after `isBlocked`, line 319):

```typescript
getBlockingReasons(epic: Epic): BlockingReason[] {
  const reasons: BlockingReason[] = [];
  const allEpics = this.getAllEpics();

  // 1. runAfter
  if (epic.runAfter) {
    const predecessor = allEpics.find(e => e.id === epic.runAfter);
    if (predecessor && predecessor.column !== 'review' && predecessor.column !== 'done') {
      reasons.push({
        type: 'runAfter',
        label: `Runs after "${predecessor.title}" (${predecessor.column})`,
        relatedEpicId: predecessor.id,
      });
    }
  }

  // 2. Dependencies (only direct — show each unmet one)
  for (const depId of epic.dependsOn) {
    const dep = allEpics.find(e => e.id === depId);
    if (!dep) {
      reasons.push({ type: 'dependency', label: `Depends on deleted epic`, relatedEpicId: depId });
    } else if (dep.column !== 'done') {
      reasons.push({
        type: 'dependency',
        label: `Depends on "${dep.title}" (${dep.column})`,
        relatedEpicId: dep.id,
      });
    }
  }

  // 3. Repo locks (only for non-worktree epics)
  if (!(epic.useWorktree && epic.useGitBranch)) {
    const repoIds = epic.targetRepoIds.length > 0
      ? epic.targetRepoIds
      : (this.projectRepo?.reposByProjectId(epic.projectId).map(r => r.id) ?? []);
    for (const repoId of repoIds) {
      const lock = this.repoLocks.get(repoId);
      if (lock) {
        const lockingEpic = allEpics.find(e => e.id === lock.epicId);
        const repoName = this.projectRepo?.getRepo(repoId)?.name ?? repoId.slice(0, 8);
        reasons.push({
          type: 'repoLock',
          label: `Repo "${repoName}" locked by "${lockingEpic?.title ?? lock.epicId.slice(0, 8)}"`,
          relatedEpicId: lock.epicId,
          relatedRepoId: repoId,
        });
      }
    }
  }

  // 4. Global concurrency
  const inProgressCount = allEpics.filter(e => e.column === 'in-progress').length;
  if (inProgressCount >= this.config.maxConcurrentEpics) {
    reasons.push({
      type: 'concurrency',
      label: `Concurrency limit: ${inProgressCount}/${this.config.maxConcurrentEpics} epics running`,
    });
  }

  // 5. Per-project concurrency
  if (this.config.maxConcurrentPerProject && this.config.maxConcurrentPerProject > 0) {
    const inProgressForProject = allEpics.filter(
      e => e.column === 'in-progress' && e.projectId === epic.projectId,
    ).length;
    if (inProgressForProject >= this.config.maxConcurrentPerProject) {
      reasons.push({
        type: 'projectConcurrency',
        label: `Project limit: ${inProgressForProject}/${this.config.maxConcurrentPerProject} epics running`,
      });
    }
  }

  return reasons;
}
```

This method is public so the UI layer can call it directly.

#### Update `canAcquireRepos` (line 258–264):

```typescript
canAcquireRepos(epic: Epic): boolean {
  // Worktree epics get filesystem isolation — no repo locks needed
  if (epic.useWorktree && epic.useGitBranch) return true;

  // Resolve effective repo IDs (fix: empty targetRepoIds means all repos)
  const repoIds = epic.targetRepoIds.length > 0
    ? epic.targetRepoIds
    : (this.projectRepo?.reposByProjectId(epic.projectId).map(r => r.id) ?? []);

  if (repoIds.length === 0) return true;
  for (const repoId of repoIds) {
    if (this.repoLocks.has(repoId)) return false;
  }
  return true;
}
```

#### Update `acquireRepos` (line 266–271):

```typescript
acquireRepos(epic: Epic): void {
  // Worktree epics don't need locks
  if (epic.useWorktree && epic.useGitBranch) return;

  const repoIds = epic.targetRepoIds.length > 0
    ? epic.targetRepoIds
    : (this.projectRepo?.reposByProjectId(epic.projectId).map(r => r.id) ?? []);

  const now = new Date().toISOString();
  for (const repoId of repoIds) {
    this.repoLocks.set(repoId, { repoId, epicId: epic.id, acquiredAt: now });
  }
}
```

#### Emit blocking reasons during tick (line 383–401 in tick loop):

After the epic is skipped (blocked, repo locked, or concurrency limited), emit an event with its reasons. Add after the `for` loop processes each epic, and also at the end of the tick, emit reasons for ALL todo/backlog epics:

```typescript
// At the end of tick(), before `return actions`:
const blockableEpics = allEpics.filter(e => e.column === 'todo' || e.column === 'backlog');
const blockingMap: Record<string, BlockingReason[]> = {};
for (const e of blockableEpics) {
  const reasons = this.getBlockingReasons(e);
  if (reasons.length > 0) {
    blockingMap[e.id] = reasons;
  }
}
engineBus.emit('scheduler:blockingReasons', { reasons: blockingMap });
```

#### Add event type to `EngineEvents` in `src/engine/types.ts` (after line 170):

```typescript
'scheduler:blockingReasons': { reasons: Record<string, BlockingReason[]> };
```

Also add the import:
```typescript
import type { Epic, EpicColumn, BlockingReason } from './KosTypes';
```

---

## Part 6: AngyEngine Cleanup

### 6A. File: `src/engine/AngyEngine.ts`

#### Update `restoreReposForEpic` (line 1046–1058):

For worktree branches: commit work IN the worktree (using worktreePath as cwd), do NOT checkout back to base in the main repo. The worktree stays for potential runAfter successors.

```typescript
async restoreReposForEpic(epicId: string): Promise<void> {
  const epic = this.epics.getEpic(epicId);
  const branches = await this.branchManager.getEpicBranches(epicId);

  for (const branch of branches) {
    if (branch.status !== 'active') continue;
    const repo = await this.db.loadProjectRepo(branch.repoId);
    if (!repo) continue;

    if (branch.worktreePath) {
      // Worktree: commit in the worktree directory, leave worktree in place
      await this.branchManager.commitEpicWork(branch.worktreePath, epic?.title ?? epicId);
      // Do NOT remove worktree here — runAfter successor may need it
    } else {
      // Checkout-based: commit and restore base branch in main repo
      await this.branchManager.commitEpicWork(repo.path, epic?.title ?? epicId);
      await this.branchManager.restoreBranch(repo.path, branch.baseBranch);
    }
  }
}
```

#### Update `createEpic` (line 675–712):

Add the two new fields with defaults:

```typescript
useGitBranch: false,
useWorktree: false,     // NEW
baseBranch: null,       // NEW
```

#### Update `OrchestratorPool.getInstance` call (line 78):

```typescript
this.pool = OrchestratorPool.getInstance(this.branchManager, this.db);
```

#### Add chain-aware worktree cleanup

Add a helper method (insert after `restoreReposForEpic`):

```typescript
private hasRunAfterSuccessor(epicId: string): boolean {
  const allEpics = this.epics.listEpics();
  return allEpics.some(e => e.runAfter === epicId && e.column !== 'done' && e.column !== 'discarded');
}

async cleanupWorktreesForEpic(epicId: string): Promise<void> {
  if (this.hasRunAfterSuccessor(epicId)) {
    console.log(`[AngyEngine] Skipping worktree cleanup for ${epicId} — has runAfter successor`);
    return;
  }
  const branches = await this.branchManager.getEpicBranches(epicId);
  for (const branch of branches) {
    if (!branch.worktreePath) continue;
    const repo = await this.db.loadProjectRepo(branch.repoId);
    if (!repo) continue;
    await this.branchManager.removeWorktree(repo.path, branch.worktreePath);
  }
}
```

Call `cleanupWorktreesForEpic` in the `epic:completed` handler (line 1062–1069), after `restoreReposForEpic` and before `moveToReview`:

```typescript
engineBus.on('epic:completed', async ({ epicId }) => {
  try {
    await this.restoreReposForEpic(epicId);
    await this.cleanupWorktreesForEpic(epicId);
    await this.scheduler.moveToReview(epicId);
  } catch (err) {
    console.error(`[AngyEngine] Failed to move epic ${epicId} to review:`, err);
  }
  engineBus.emit('epic:storeSyncNeeded');
});
```

Also call it in `epic:failed` handler (line 1073–1081).

#### Startup reconciliation — add to `initialize()` (after scheduler wiring, line 137):

```typescript
// 7. Reconcile orphaned worktrees
await this.reconcileWorktrees();
```

Add the method:

```typescript
private async reconcileWorktrees(): Promise<void> {
  const allRepos = this.projects.listProjects()
    .flatMap(p => this.projects.listRepos(p.id));

  const allBranches = await this.db.loadAllEpicBranches();
  const knownWorktrees = new Set(
    allBranches.filter(b => b.worktreePath).map(b => b.worktreePath!),
  );

  for (const repo of allRepos) {
    const diskWorktrees = await this.branchManager.listWorktrees(repo.path);
    for (const wt of diskWorktrees) {
      if (wt === repo.path) continue; // main worktree = repo itself
      if (wt.includes('.angy-worktrees') && !knownWorktrees.has(wt)) {
        console.log(`[AngyEngine] Removing orphaned worktree: ${wt}`);
        await this.branchManager.removeWorktree(repo.path, wt);
      }
    }
    await this.branchManager.pruneWorktrees(repo.path);
  }
}
```

---

## Part 7: Epic Store (Pinia)

### 7A. File: `src/stores/epics.ts`

#### Update `createEpic` (line 123–163):

Add default values for the two new fields in the epic object (after `useGitBranch: false`, line 141):

```typescript
useWorktree: false,
baseBranch: null,
```

#### Add `blockingReasons` reactive state (after `loading` ref, line 33):

```typescript
const blockingReasons = ref<Map<string, BlockingReason[]>>(new Map());
```

Import `BlockingReason`:
```typescript
import type { Epic, EpicBranch, EpicColumn, PriorityHint, BlockingReason } from '@/engine/KosTypes';
```

#### Add engine event listener in `initialize()` (inside the `if (!engineListenersSetup)` block, line 292–299):

```typescript
engineBus.on('scheduler:blockingReasons', ({ reasons }) => {
  blockingReasons.value = new Map(Object.entries(reasons));
});
```

#### Add getter (after `reviewEpics`, line 88–90):

```typescript
function getBlockingReasons(epicId: string): BlockingReason[] {
  return blockingReasons.value.get(epicId) ?? [];
}
```

#### Export in the return statement (after `reviewEpics`, line 315):

```typescript
blockingReasons,
getBlockingReasons,
```

---

## Part 8: BranchPicker Component

### 8A. New file: `src/components/kanban/BranchPicker.vue`

This is a dropdown/popover component for selecting a git branch.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string \| null` | `null` | Current branch name |
| `repoIds` | `string[]` | `[]` | Repos to fetch branches from |
| `projectId` | `string` | required | To resolve repo paths |
| `placeholder` | `string` | `'Select branch...'` | Placeholder text |
| `disabled` | `boolean` | `false` | Disable the picker |
| `allowCreate` | `boolean` | `true` | Show "create new" option |

**Emits:** `update:modelValue`

**Implementation details:**

1. Uses `useMultiRepoGit` composable (`src/composables/useMultiRepoGit.ts`) — already has `refreshAllBranches`, `createBranchInRepo`, `getCurrentBranch`.
2. Uses `useProjectsStore` to resolve repo paths from `repoIds`/`projectId`.
3. On open (click trigger button):
   - Set `loading = true`
   - Call `refreshAllBranches(repos)` to get fresh data from git
   - Set `loading = false`
   - Show dropdown
4. Dropdown content:
   - Search input at top (filters as user types)
   - "Common branches" section: branches present in ALL repos (e.g. `main`, `develop`). Bold with a star icon.
   - Per-repo sections (only when `repoIds.length > 1`): header with repo name, list of branches
   - Each branch: clickable row, highlights on hover, checkmark if currently selected
   - Bottom: if `allowCreate` and search text doesn't match any branch: show "+ Create `{searchText}`" button
5. Create action: calls `createBranchInRepo(repo.path, name)` for each target repo, then selects it.
6. Clicking outside or pressing Escape closes the dropdown.

**Template structure (sketch):**

```vue
<template>
  <div class="relative">
    <!-- Trigger -->
    <button
      :disabled="disabled"
      class="field-input text-left flex items-center gap-2"
      @click="toggle"
    >
      <svg class="w-3.5 h-3.5 text-teal flex-shrink-0"><!-- git branch icon --></svg>
      <span v-if="modelValue" class="font-mono text-xs truncate">{{ modelValue }}</span>
      <span v-else class="text-txt-faint text-xs">{{ placeholder }}</span>
      <svg class="w-3 h-3 ml-auto text-txt-faint"><!-- chevron --></svg>
    </button>

    <!-- Dropdown (teleport to body for z-index safety) -->
    <Teleport to="body">
      <div v-if="open" class="fixed ..." :style="dropdownPosition">
        <!-- Search -->
        <input v-model="search" placeholder="Search branches..." autofocus />

        <!-- Loading spinner -->
        <div v-if="loading" class="...">Loading branches...</div>

        <!-- Common branches -->
        <div v-if="commonBranches.length > 0">
          <div class="section-header">Common</div>
          <button v-for="b in filteredCommon" @click="select(b)">★ {{ b }}</button>
        </div>

        <!-- Per-repo branches -->
        <div v-for="repo in repoSections">
          <div class="section-header">{{ repo.name }}</div>
          <button v-for="b in repo.filteredBranches" @click="select(b)">{{ b }}</button>
        </div>

        <!-- Create -->
        <button v-if="allowCreate && search && !exactMatch" @click="createAndSelect(search)">
          + Create "{{ search }}"
        </button>
      </div>
    </Teleport>
  </div>
</template>
```

**Script uses:**
- `useMultiRepoGit()` for `refreshAllBranches`, `createBranchInRepo`
- `useProjectsStore()` for `reposByProjectId`
- Computed `commonBranches`: intersection of all repos' branch lists
- Computed `repoSections`: per-repo branch lists minus common branches
- Filtering: case-insensitive match on `search`

---

## Part 9: UpcomingCard Blocking Badges

### 9A. File: `src/components/kanban/cards/UpcomingCard.vue`

#### Add blocking reasons display

Import the epic store and add computed:

```typescript
const epicStore = useEpicStore();
const blockingReasons = computed(() => epicStore.getBlockingReasons(props.epic.id));
```

In the template, after the title `<p>` tag (line 22) and before the branch section (line 24), insert:

```vue
<!-- Blocking reasons -->
<div v-if="blockingReasons.length > 0" class="flex flex-wrap gap-1 mt-1.5">
  <span
    v-for="(reason, i) in blockingReasons.slice(0, 3)"
    :key="i"
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] leading-tight max-w-full"
    :class="reasonClass(reason)"
    :title="reason.label"
  >
    <span class="truncate">{{ reasonShortLabel(reason) }}</span>
  </span>
  <span v-if="blockingReasons.length > 3" class="text-[9px] text-txt-faint">
    +{{ blockingReasons.length - 3 }} more
  </span>
</div>
```

Add helper functions in `<script setup>`:

```typescript
import type { BlockingReason } from '@/engine/KosTypes';

function reasonClass(r: BlockingReason): string {
  switch (r.type) {
    case 'runAfter':
    case 'dependency':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'repoLock':
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default:
      return 'bg-white/5 text-txt-muted border border-border-subtle';
  }
}

function reasonShortLabel(r: BlockingReason): string {
  switch (r.type) {
    case 'runAfter': {
      const title = epicStore.epicById(r.relatedEpicId!)?.title ?? '...';
      return `after: ${title}`;
    }
    case 'dependency': {
      const title = epicStore.epicById(r.relatedEpicId!)?.title ?? '...';
      return `needs: ${title}`;
    }
    case 'repoLock':
      return r.label;
    case 'concurrency':
    case 'projectConcurrency':
      return r.label;
    case 'budget':
      return 'Budget exhausted';
    default:
      return r.label;
  }
}
```

---

## Part 10: EpicDetailPanel Updates

### 10A. File: `src/components/kanban/EpicDetailPanel.vue`

#### Update draft (line 400–413):

Add the two new fields:

```typescript
const draft = ref({
  // ... existing ...
  useGitBranch: false,
  useWorktree: false,     // NEW
  baseBranch: null as string | null,  // NEW
  dependsOn: [] as string[],
  runAfter: null as string | null,
});
```

#### Update `loadDraft` (line 426–443):

After `useGitBranch` (line 439), add:

```typescript
useWorktree: e.useWorktree ?? false,
baseBranch: e.baseBranch ?? null,
```

#### Update `save()` (line 486–512):

In the `updateEpic` call (line 496–508), add after `useGitBranch`:

```typescript
useWorktree: d.useWorktree,
baseBranch: d.baseBranch,
```

#### Update template — Git branch section (line 145–166):

Replace the entire git branch section with:

```vue
<!-- Git branch -->
<div class="space-y-2">
  <div class="flex items-center justify-between">
    <span class="field-label">Git branch</span>
    <button
      class="panel-toggle"
      :class="draft.useGitBranch ? 'on' : 'off'"
      @click="draft.useGitBranch = !draft.useGitBranch"
    />
  </div>
  <p class="text-[11px] text-txt-faint leading-relaxed">
    {{ draft.useGitBranch ? 'Creates a branch for this epic, restores default when done' : 'Agents work on the current branch' }}
  </p>

  <template v-if="draft.useGitBranch">
    <!-- Base branch picker -->
    <div class="space-y-1">
      <span class="text-[10px] text-txt-muted">Base branch</span>
      <BranchPicker
        v-model="draft.baseBranch"
        :repoIds="draft.targetRepoIds"
        :projectId="epic.projectId"
        placeholder="Default (repo default branch)"
        :disabled="!!draft.runAfter"
      />
      <p v-if="draft.runAfter" class="text-[10px] text-amber-400/80 italic">
        Inherits branch from predecessor
      </p>
    </div>

    <!-- Worktree toggle -->
    <div class="flex items-center justify-between">
      <span class="text-[10px] text-txt-muted">Use worktree</span>
      <button
        class="panel-toggle"
        :class="draft.useWorktree ? 'on' : 'off'"
        @click="draft.useWorktree = !draft.useWorktree"
      />
    </div>
    <p class="text-[11px] text-txt-faint leading-relaxed -mt-1">
      {{ draft.useWorktree ? 'Isolated copy — enables parallel execution on this repo' : 'Checks out branch in main repo (exclusive lock)' }}
    </p>
  </template>

  <!-- Current branch display -->
  <div v-if="branchName" class="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-base border border-border-subtle">
    <svg class="w-3.5 h-3.5 text-teal flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
    <span class="text-[12px] font-mono text-teal truncate select-all" :title="branchName">
      {{ branchName }}
    </span>
    <span v-if="epic.useWorktree" class="text-[9px] px-1 py-0.5 rounded bg-teal/10 text-teal border border-teal/20">
      worktree
    </span>
  </div>
</div>
```

#### Add blocking reasons section

In the template, BEFORE the "Definition" section (line 22–107), and AFTER the header (line 18), add:

```vue
<!-- Blocking reasons (visible for backlog/todo epics) -->
<div
  v-if="epic && (epic.column === 'todo' || epic.column === 'backlog') && blockingReasons.length > 0"
  class="px-5 pt-3 pb-1"
>
  <div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
    <span class="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Blocked</span>
    <div v-for="(reason, i) in blockingReasons" :key="i" class="flex items-center gap-2">
      <span
        class="w-1.5 h-1.5 rounded-full flex-shrink-0"
        :class="reason.type === 'repoLock' ? 'bg-red-400' : 'bg-amber-400'"
      />
      <span class="text-[11px] text-txt-secondary leading-snug">{{ reason.label }}</span>
    </div>
  </div>
</div>
```

In the script, add the computed:

```typescript
const blockingReasons = computed(() => epicStore.getBlockingReasons(props.epicId));
```

#### Import BranchPicker (line 361):

```typescript
import BranchPicker from './BranchPicker.vue';
```

---

## Part 11: MergeEpicsDialog — Use BranchPicker

### 11A. File: `src/components/kanban/MergeEpicsDialog.vue`

Replace the base branch `<input>` (line 86–94) with:

```vue
<div>
  <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Base Branch</label>
  <BranchPicker
    v-model="baseBranch"
    :repoIds="repoIdsForPicker"
    :projectId="props.projectId"
    placeholder="master"
    :allowCreate="false"
  />
</div>
```

Add the import and computed:

```typescript
import BranchPicker from './BranchPicker.vue';

const repoIdsForPicker = computed(() =>
  projectsStore.reposByProjectId(props.projectId).map(r => r.id),
);
```

---

## Part 12: EpicCard Worktree Badge

### 12A. File: `src/components/kanban/EpicCard.vue`

Next to the branch name display, add a small badge if `epic.useWorktree` is true:

Find the branch name display in the template and add after the branch name `<span>`:

```vue
<span v-if="epic.useWorktree" class="text-[8px] px-1 py-0.5 rounded bg-teal/10 text-teal border border-teal/20 ml-1">
  wt
</span>
```

---

## Summary of all files touched

| File | Changes |
|------|---------|
| `src/engine/KosTypes.ts` | Add `useWorktree`, `baseBranch` to `Epic`; `worktreePath` to `EpicBranch`; add `BlockingReason` type |
| `src/engine/Database.ts` | 3 migration ALTERs; update `saveEpic` columns/values; update `rowToEpic`; update `saveEpicBranch`/`loadEpicBranches`/`loadAllEpicBranches` |
| `src/engine/BranchManager.ts` | Add `computeWorktreePath`, `listBranches`, `createBranch`, `ensureExcludeEntry`, `createWorktree`, `removeWorktree`, `listWorktrees`, `pruneWorktrees`; update `deleteEpicBranches` |
| `src/engine/OrchestratorPool.ts` | Add `db` to constructor/`getInstance`; add `inheritFromPredecessor`; rewrite repo prep loop in `spawnRoot` |
| `src/engine/Scheduler.ts` | Add `getBlockingReasons`; update `canAcquireRepos`/`acquireRepos`; emit `scheduler:blockingReasons` at end of `tick` |
| `src/engine/AngyEngine.ts` | Update `restoreReposForEpic` for worktrees; add `hasRunAfterSuccessor`/`cleanupWorktreesForEpic`/`reconcileWorktrees`; update `createEpic` defaults; update pool init |
| `src/engine/types.ts` | Add `scheduler:blockingReasons` event |
| `src/stores/epics.ts` | Add `blockingReasons` state + `getBlockingReasons` getter + event listener; update `createEpic` defaults |
| `src/components/kanban/BranchPicker.vue` | **New file** — searchable branch picker with create |
| `src/components/kanban/EpicDetailPanel.vue` | Add `useWorktree`/`baseBranch` to draft + save; replace git section with BranchPicker + worktree toggle; add blocking reasons section |
| `src/components/kanban/cards/UpcomingCard.vue` | Add blocking reason badges |
| `src/components/kanban/EpicCard.vue` | Add worktree badge |
| `src/components/kanban/MergeEpicsDialog.vue` | Replace base branch input with BranchPicker |
| `src/composables/useMultiRepoGit.ts` | No changes needed (already has all required methods) |
| `src/composables/useCreatePR.ts` | No changes needed (works on branch names) |

---

## Implementation order

1. **KosTypes.ts** — data model first (everything depends on this)
2. **Database.ts** — migrations + updated queries
3. **BranchManager.ts** — worktree methods
4. **OrchestratorPool.ts** — worktree + chain support in spawnRoot
5. **Scheduler.ts** — blocking reasons + lock relaxation
6. **AngyEngine.ts** — cleanup + reconciliation
7. **types.ts** — event type
8. **stores/epics.ts** — store updates
9. **BranchPicker.vue** — new component
10. **EpicDetailPanel.vue** — UI: branch picker + worktree toggle + blocking section
11. **UpcomingCard.vue** — blocking badges
12. **EpicCard.vue** — worktree badge
13. **MergeEpicsDialog.vue** — use BranchPicker
