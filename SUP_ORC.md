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

| Phase | Scope |
|-------|-------|
| 1 | Add `depth`/`maxDepth` to `Orchestrator` constructor. No behavior change yet. |
| 2 | Add `spawn_orchestrator` to MCP server. Gate it behind `depth < maxDepth`. |
| 3 | Wire `executeDelegation` to detect `role === 'orchestrator'` and spin up child `Orchestrator`. |
| 4 | Implement depth-aware system prompt (tool gating + "when to spawn" constraint). |
| 5 | Add depth labels to agent names and UI fleet view. |
| 6 | (Optional) Artifact store for context-loss mitigation. |

---

## Open Questions

- Should `maxDepth` be user-configurable in the UI (e.g. a slider 1–4)?
- Should sub-orchestrators share the parent's `autoCommit`/`gitAvailable` state?
- Should the fleet view visually indent by depth to show the tree structure?
