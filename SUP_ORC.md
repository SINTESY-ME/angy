# SUP_ORC — Recursive (Fractal) Orchestration Plan

## Overview

Instead of hardcoding a two-tier hierarchy (root orchestrator → workers), a single
`Orchestrator` class recursively spawns either specialist agents **or** sub-orchestrators,
depending on task complexity and current depth. A hard `maxDepth` cap prevents runaway
token consumption.

---

## Core Concept

```
Depth 0: Root Orchestrator  (goal: "build a SaaS backend")
  ├─ Depth 1: Sub-Orchestrator  (goal: "Auth subsystem")
  │    ├─ Depth 2: architect-1
  │    └─ Depth 2: implementer-2
  ├─ Depth 1: Sub-Orchestrator  (goal: "DB layer")
  │    ├─ Depth 2: architect-3
  │    └─ Depth 2: implementer-4
  └─ Depth 1: implementer-5    (simple task — no sub-orchestrator needed)
```

At `maxDepth`, a node can **only** spawn specialist agents (architect, implementer,
reviewer, tester). The `spawn_orchestrator` tool is removed from its prompt.

---

## Changes Required

### 1. Orchestrator Constructor — Depth State

Add `depth` and `maxDepth` to the `Orchestrator` class:

```typescript
export interface OrchestratorOptions {
  depth?: number;       // current depth (0 = root)
  maxDepth?: number;    // hard cap (default: 3)
  parentSessionId?: string;
}

export class Orchestrator {
  private depth: number;
  private maxDepth: number;
  private parentSessionId: string;

  constructor(opts: OrchestratorOptions = {}) {
    this.depth = opts.depth ?? 0;
    this.maxDepth = opts.maxDepth ?? 3;
    this.parentSessionId = opts.parentSessionId ?? '';
  }
}
```

### 2. New MCP Tool — `spawn_orchestrator`

Add a `spawn_orchestrator(goal, context)` tool to the MCP server. Only exposed when
`depth < maxDepth`. When called:

1. A new `Orchestrator` is instantiated with `depth + 1`.
2. It gets its own `teamId`, session, and `pendingChildren` map.
3. On `done()`, its summary is returned to the parent as a delegation result —
   same path as a specialist agent finishing.

The `OrchestratorCommand` type gains a new action:

```typescript
action: 'delegate' | 'spawn_orchestrator' | 'validate' | 'done' | 'fail' | 'checkpoint' | 'unknown';
```

### 3. Dynamic System Prompt — Tool Gating

`getSystemPrompt()` becomes depth-aware:

```typescript
getSystemPrompt(): string {
  const canSpawnSubOrchestrators = this.depth < this.maxDepth;
  // If canSpawnSubOrchestrators: include spawn_orchestrator tool in prompt
  // Else: omit it entirely, only list specialist roles
}
```

Strict constraint injected into the prompt when `spawn_orchestrator` is available:

> "Only call `spawn_orchestrator` when the sub-task has **multiple sequential phases**
> or **parallel independent subsystems**. If it can be solved in one or two delegation
> steps, send it directly to a specialist."

### 4. Aggregation — Bubbling `done()` Summaries

When a sub-orchestrator calls `done(summary)`:
- Its summary is wrapped and fed back to the parent as a standard delegation result.
- The parent treats it identically to receiving output from a specialist agent.
- No special logic needed — the existing `onDelegateFinished` + `checkAllChildrenDone`
  pipeline handles it.

### 5. Depth Label in Agent Names

Agent names include depth for observability:

```
d0-orchestrator      (root)
d1-orchestrator-1    (sub-orchestrator at depth 1)
d2-implementer-3     (specialist at depth 2)
```

---

## Feature: Strict JSON Handoffs

All `done()` calls — from specialists and sub-orchestrators alike — must return a
structured artifact instead of a plain string. This prevents context dilution as
summaries bubble up the tree and makes outputs machine-readable.

### Schema

```typescript
export interface AgentHandoff {
  status: 'success' | 'partial' | 'failed';
  summary: string;                  // human-readable, ≤ 300 chars
  artifacts: string[];              // file paths written/modified
  unresolved_dependencies: string[]; // blockers the parent must handle
  metadata?: Record<string, string>; // e.g. { testsPassed: "12", coverage: "87%" }
}
```

### Enforcement

- The MCP `done(summary)` tool is replaced by `done(result: AgentHandoff)`.
- The orchestrator's system prompt instructs: *"Your final `done()` call must be a
  valid JSON object matching the AgentHandoff schema. Do not return plain prose."*
- `checkAllChildrenDone()` parses each child's output with `JSON.parse()`. If parsing
  fails, it feeds back an error: *"Your done() output was not valid JSON. Re-call done()
  with the correct schema."*
- The root orchestrator's `completed` event payload changes from `{ summary: string }`
  to `{ handoff: AgentHandoff }`.

### Aggregation Up the Tree

A sub-orchestrator that receives three `AgentHandoff` objects from its children merges
them before calling its own `done()`:

```typescript
// Pseudo-logic inside sub-orchestrator's checkAllChildrenDone()
const merged: AgentHandoff = {
  status: children.every(c => c.status === 'success') ? 'success' : 'partial',
  summary: children.map(c => c.summary).join('; '),
  artifacts: children.flatMap(c => c.artifacts),
  unresolved_dependencies: children.flatMap(c => c.unresolved_dependencies),
};
```

---

## Feature: Session Resumability

Long-running orchestrations (CI pipelines, multi-hour codegen) must survive process
restarts, app quits, and webhook-triggered wake-ups.

### Persistent Checkpoint File

On every phase transition and after every delegation batch, the orchestrator serializes
its full state to disk:

```typescript
export interface OrchestratorSnapshot {
  version: 1;
  snapshotId: string;         // UUID
  savedAt: string;            // ISO timestamp
  goal: string;
  depth: number;
  maxDepth: number;
  teamId: string;
  sessionId: string;
  currentPhase: string;
  totalDelegations: number;
  autoCommit: boolean;
  pendingChildren: PendingChildSnapshot[];
  completedHandoffs: AgentHandoff[];
}

export interface PendingChildSnapshot {
  sessionId: string;
  role: string;
  agentName: string;
  completed: boolean;
  handoff?: AgentHandoff;
}
```

File path: `~/.angy/snapshots/<teamId>.json`

### Resume Flow

```typescript
// New static method
static async resume(snapshotId: string, chatPanel: OrchestratorChatPanelAPI): Promise<Orchestrator>
```

1. Load snapshot from `~/.angy/snapshots/<snapshotId>.json`.
2. Re-instantiate `Orchestrator` with saved `depth`, `maxDepth`, `teamId`.
3. Restore `pendingChildren` map.
4. For each child that was `completed: false`, check if the Claude session produced
   output while the app was closed (`sessionFinalOutput()`). If yes, call
   `onDelegateFinished()` to replay the result.
5. If the session is gone (app was force-quit mid-run), re-issue the delegation with
   the original task — `resumeSessionId` is passed to the new Claude CLI invocation.

### UI

- The "New Orchestration" dialog shows a list of resumable snapshots with timestamp,
  goal preview, and current phase.
- A "Resume" button re-attaches the orchestrator to the existing fleet without
  creating a new root session.

---

## Feature: Multiverse Execution

For high-stakes decisions (architecture choices, algorithm selection), the orchestrator
spawns N isolated branches in parallel, evaluates them against a rubric, and merges
the winner.

### New MCP Tool — `branch(n, goal, evaluator)`

Only available at Depth 0 (no branching inside branches to avoid exponential blowup).

```typescript
// Tool signature exposed to root orchestrator
branch(
  n: number,          // number of parallel branches (2–4)
  goal: string,       // what each branch should produce
  evaluator: string,  // shell command that scores a branch, e.g. "npm test -- --json"
): void
```

### Execution

1. For each branch `i` in `[0..n)`:
   - Create a git worktree at `~/.angy/branches/<teamId>/branch-<i>`.
   - Spawn a child `Orchestrator` (or specialist) scoped to that worktree.
2. Wait for all branches to return `AgentHandoff` objects.
3. Run `evaluator` command in each worktree. Capture exit code + stdout score.
4. Pick the branch with the best score.
5. `git merge --squash` the winning worktree into the main workspace.
6. Clean up losing worktrees.
7. Feed result back to root orchestrator as a standard delegation result.

### Guardrails

- Max `n = 4` (hardcoded).
- Branching is forbidden when `depth > 0`.
- Each branch inherits the root's `MAX_TOTAL_DELEGATIONS` budget divided by `n`.

---

## Feature: MCP Standardization

The `spawn_orchestrator` and `delegate` tools are designed so a child agent can be
hosted locally **or** be a remote MCP endpoint — the orchestrator does not need to
know which.

### Abstract Agent Endpoint

```typescript
export interface AgentEndpoint {
  type: 'local' | 'remote';
  // local: spawns a new Orchestrator/specialist in-process
  profileId?: string;
  // remote: calls an external MCP-compliant agent service
  url?: string;
  apiKey?: string;
  schema?: object; // JSON Schema for validating the remote agent's handoff
}
```

### Remote Delegation Flow

When `endpoint.type === 'remote'`:
1. POST `{ task, context, schema: AgentHandoff }` to `endpoint.url`.
2. Poll or subscribe (SSE/webhook) for the result.
3. Validate the response against `AgentHandoff` schema.
4. Feed the handoff back into `onDelegateFinished()` exactly like a local child.

### Registry

A future `~/.angy/agent-registry.json` maps role names to endpoints:

```json
{
  "auth-specialist": {
    "type": "remote",
    "url": "https://agents.example.com/auth",
    "apiKey": "..."
  },
  "implementer": {
    "type": "local",
    "profileId": "specialist-implementer"
  }
}
```

The orchestrator's `executeDelegation` resolves the role against the registry before
deciding whether to call `delegateToChild()` locally or issue an HTTP request.

---

## Traps to Avoid

### "Middle Management" Problem
LLMs will over-delegate if given the chance. Mitigate with a hard rule in the prompt:
"If the task can be accomplished by a single specialist in one shot, do not spawn a
sub-orchestrator."

### Context Dilution
Summaries lose detail as they bubble up the tree. Mitigate with an **Artifact Store**:
- Agents write outputs to named artifacts (files or an in-memory map keyed by artifact ID).
- Orchestrators pass artifact IDs up the chain, not full content.
- Root orchestrator can retrieve any artifact by ID at the end.

### Token Budget
Each depth level multiplies token usage. Enforce a per-node delegation cap
(`MAX_TOTAL_DELEGATIONS`) inherited from the root, or tracked globally via a shared
counter passed down through options.

---

## Rollout Phases

| Phase | Feature | Scope |
|-------|---------|-------|
| 1 | Recursive core | Add `depth`/`maxDepth` to `Orchestrator` constructor. No behavior change yet. |
| 2 | Recursive core | Add `spawn_orchestrator` to MCP server. Gate it behind `depth < maxDepth`. |
| 3 | Recursive core | Wire `executeDelegation` to detect `role === 'orchestrator'` and spin up child `Orchestrator`. |
| 4 | Recursive core | Implement depth-aware system prompt (tool gating + "when to spawn" constraint). |
| 5 | Recursive core | Add depth labels to agent names and fleet view. |
| 6 | Strict JSON | Replace `done(summary: string)` with `done(result: AgentHandoff)` in MCP + parsing. |
| 7 | Strict JSON | Update `checkAllChildrenDone()` to parse, validate, and merge `AgentHandoff` objects. |
| 8 | Resumability | Implement `OrchestratorSnapshot` serialization on every phase transition. |
| 9 | Resumability | Implement `Orchestrator.resume()` static method + UI resume dialog. |
| 10 | Multiverse | Add `branch(n, goal, evaluator)` MCP tool + git worktree management. |
| 11 | Multiverse | Implement branch evaluator runner + winner merge logic. |
| 12 | MCP Standard | Define `AgentEndpoint` interface + remote delegation HTTP path. |
| 13 | MCP Standard | Implement `agent-registry.json` resolution in `executeDelegation`. |

---

## Open Questions

- Should `maxDepth` be user-configurable in the UI (e.g. a slider 1–4)?
- Should sub-orchestrators share the parent's `autoCommit`/`gitAvailable` state?
- Should the fleet view visually indent by depth to show the tree structure?
- Should `AgentHandoff` be versioned so remote agents from different versions stay compatible?
- Should the branch evaluator support a scoring LLM (judge model) in addition to shell commands?
- Should resumable snapshots have a TTL (e.g. auto-delete after 7 days)?
