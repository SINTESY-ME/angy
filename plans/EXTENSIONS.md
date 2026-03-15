# Angy Extension System — Implementation Plan

> **Design principle**: every phase is additive and non-breaking. Existing engine, stores, and UI components are touched only with additive wiring — no existing behavior is modified or removed. Extensions are strictly opt-in; Angy works identically with zero extensions installed.

---

## Architecture overview

Extensions live under `~/.angy/extensions/<extension-id>/` and ship an `angy-extension.json` manifest plus compiled JS. They are discovered at engine startup, loaded into the renderer (Phase 1) or Worker threads (Phase 4), and receive a narrow `ExtensionAPI` object — they never touch engine singletons directly.

Three layers:

```
Engine layer        HookRegistry — called at existing engineBus emit sites (additive only)
Extension API       ExtensionAPIFactory — builds a restricted view per extension
UI layer            ExtensionUIRegistry — mounts contributed Vue components in slots
```

---

## Phase 1 — Core infrastructure (no UI, no hooks yet)

Goal: extension manifests can be discovered, validated, and activated. Extensions can read/write secrets and config. Nothing else changes.

### 1.1 — Type definitions

**New file**: `src/extensions/ExtensionManifest.ts`

```ts
export interface ExtensionManifest {
  id: string;           // reverse-domain: "com.example.jira"
  name: string;
  version: string;      // semver
  description: string;
  author: string;
  angyVersion: string;  // semver range, e.g. ">=0.2.5"
  activationEvents: ActivationEvent[];
  permissions: ExtensionPermission[];
  contributes: ExtensionContributions;
  extensionDependencies?: string[];
}

export type ActivationEvent =
  | 'onStartup'
  | 'onEpicCreate'
  | 'onEpicComplete'
  | `onCommand:${string}`
  | `onView:${string}`
  | 'onSchedulerTick';

export type ExtensionPermission =
  | 'epics:read'    | 'epics:write'   | 'epics:create'
  | 'sessions:read'
  | 'scheduler:hook'
  | 'pipeline:hook'
  | 'ui:sidebar'    | 'ui:kanbanAction' | 'ui:settingsPage'
  | 'ui:notification' | 'ui:modal'
  | 'secrets:read'  | 'secrets:write'
  | 'network:outbound'
  | 'webhooks:register'
  | 'bus:subscribe' | 'bus:publish';

export interface ExtensionContributions {
  epicLifecycleHooks?: EpicLifecycleHookDef[];
  schedulerHooks?: SchedulerHookDef[];
  pipelineTypes?: PipelineTypeDef[];
  agentTools?: AgentToolDef[];
  commands?: CommandDef[];
  webhooks?: WebhookDef[];
  sidebarPanels?: SidebarPanelDef[];
  kanbanCardActions?: KanbanCardActionDef[];
  settingsPages?: SettingsPageDef[];
}

export interface EpicLifecycleHookDef {
  id: string;
  on: 'onCreate' | 'onMove' | 'onComplete' | 'onFail' | 'onDelete';
  handler: string;      // exported function name in engine.js
  priority?: number;    // lower runs first, default 100
  timeout?: number;     // ms, default 5000
}

export interface SchedulerHookDef {
  id: string;
  type: 'canStart' | 'onTick';
  handler: string;
  timeout?: number;
}

export interface PipelineTypeDef {
  type: string;         // added as valid EpicPipelineType value
  label: string;
  description: string;
  handler: string;
}

export interface AgentToolDef {
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: string;
}

export interface CommandDef {
  id: string;
  title: string;
  handler: string;
  keybinding?: string;
}

export interface WebhookDef {
  id: string;
  path: string;
  method: 'POST' | 'GET';
  handler: string;
}

export interface SidebarPanelDef {
  id: string;
  title: string;
  icon: string;
  component: string;    // exported Vue component name from ui.js
  position?: 'top' | 'bottom';
}

export interface KanbanCardActionDef {
  id: string;
  label: string;
  icon?: string;
  columns?: string[];   // restrict to specific EpicColumns; omit = all
  handler: string;
}

export interface SettingsPageDef {
  id: string;
  title: string;
  component: string;
}
```

**New file**: `src/extensions/api/ExtensionAPI.ts`

```ts
import type { Epic, EpicColumn, PriorityHint } from '../engine/KosTypes';

export interface ExtensionAPI {
  readonly extensionId: string;
  epics:   EpicAPI;
  sessions: SessionAPI;
  events:  EventAPI;
  ui:      ExtensionUIAPI;
  config:  ConfigAPI;
  logger:  ExtensionLogger;
}

export interface EpicAPI {
  list(filter?: { projectId?: string; column?: EpicColumn }): Promise<Epic[]>;
  get(id: string): Promise<Epic | null>;
  create(projectId: string, title: string, opts?: {
    description?: string;
    acceptanceCriteria?: string;
    priorityHint?: PriorityHint;
    pipelineType?: string;
  }): Promise<Epic>;
  update(id: string, fields: Partial<Pick<Epic,
    'title' | 'description' | 'acceptanceCriteria' | 'priorityHint' | 'column'
  >>): Promise<Epic>;
  move(id: string, column: EpicColumn): Promise<void>;
  getMeta(epicId: string, key: string): Promise<string | null>;
  setMeta(epicId: string, key: string, value: string): Promise<void>;
}

export interface SessionAPI {
  list(filter?: { epicId?: string }): Promise<SessionSummary[]>;
}

export interface SessionSummary {
  sessionId: string;
  title: string;
  epicId?: string;
  createdAt: number;
}

export interface EventAPI {
  on(event: string, handler: (payload: unknown) => void | Promise<void>): Disposable;
}

export interface Disposable { dispose(): void; }

export interface ExtensionUIAPI {
  notify(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  showProgress(opts: { title: string; cancellable?: boolean }): ProgressHandle;
}

export interface ProgressHandle {
  update(message: string, percent?: number): void;
  complete(): void;
  cancel(): void;
}

export interface ConfigAPI {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}

export interface ExtensionLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
}

// Passed to epic lifecycle hook handler functions
export interface EpicHookContext {
  epic: Readonly<Epic>;
  previousColumn?: EpicColumn;   // set for onMove only
  api: ExtensionAPI;
}

// Passed to scheduler canStart hook handler functions
export interface SchedulerCanStartContext {
  epic: Readonly<Epic>;
  allEpics: Readonly<Epic[]>;
  api: ExtensionAPI;
}

export interface CanStartResult {
  allowed: boolean;
  reason?: string;               // shown in BlockingReasons UI if not allowed
}
```

### 1.2 — Secrets vault

**New file**: `src/extensions/SecretsVault.ts`

Uses `@tauri-apps/plugin-fs` (already in project) to write AES-256-GCM encrypted JSON to `~/.angy/extensions/.secrets/<extensionId>.enc`. The encryption key is derived from `extensionId + machineId` (machine ID via `tauri-plugin-os`, already available).

```ts
export class SecretsVault {
  async get(extensionId: string, key: string): Promise<string | null>
  async set(extensionId: string, key: string, value: string): Promise<void>
  async delete(extensionId: string, key: string): Promise<void>
  async clear(extensionId: string): Promise<void>   // called on uninstall
}
```

> For v1, using the OS keychain via `tauri-plugin-stronghold` is the preferred path if the plugin is added. Until then, file-based AES-GCM is acceptable.

### 1.3 — Database additions

**Modified file**: `src/engine/Database.ts` — add two tables inside `createTables()`, after the existing `CREATE TABLE IF NOT EXISTS` blocks. No existing tables or queries are touched.

```sql
CREATE TABLE IF NOT EXISTS extension_epic_meta (
  extension_id TEXT NOT NULL,
  epic_id      TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (extension_id, epic_id, key)
);

CREATE TABLE IF NOT EXISTS extension_config (
  extension_id TEXT NOT NULL,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (extension_id, key)
);
```

### 1.4 — ExtensionAPIFactory

**New file**: `src/extensions/ExtensionAPIFactory.ts`

Constructs a permission-enforced `ExtensionAPI` instance for each extension. Each method checks that the required permission is declared in the manifest before executing; throws `PermissionDeniedError` otherwise.

```ts
export class ExtensionAPIFactory {
  constructor(
    private db: Database,
    private vault: SecretsVault,
    private bus: typeof engineBus,
  ) {}

  build(manifest: ExtensionManifest): ExtensionAPI
}
```

### 1.5 — ExtensionLoader

**New file**: `src/extensions/ExtensionLoader.ts`

```ts
export class ExtensionLoader {
  private extensionsDir: string; // resolved from tauri-plugin-fs appDataDir()

  // Scan ~/.angy/extensions/ for directories with angy-extension.json
  async discover(): Promise<ExtensionManifest[]>

  // JSON Schema validation + semver check against current app version
  validate(manifest: ExtensionManifest): ValidationResult

  // Topological sort based on extensionDependencies[]
  sortByDependency(manifests: ExtensionManifest[]): ExtensionManifest[]

  // Dynamic import() of dist/engine.js, call activate(api), collect disposables
  async activate(manifest: ExtensionManifest, api: ExtensionAPI): Promise<LoadedExtension>

  // Call deactivate() exported from engine.js, then call dispose() on all disposables
  async deactivate(ext: LoadedExtension): Promise<void>
}

export interface LoadedExtension {
  manifest: ExtensionManifest;
  status: 'active' | 'error' | 'disabled';
  error?: string;
  module: Record<string, unknown>;   // the imported engine.js exports
  disposables: Disposable[];
}
```

Activation event handling: extensions with `activationEvents: ['onStartup']` are activated immediately. Others are deferred — the loader registers a one-time `engineBus.on(event)` listener that activates them on first match. This is invisible to the rest of the app.

### 1.6 — ExtensionManager

**New file**: `src/extensions/ExtensionManager.ts`

Top-level singleton that owns the loader, vault, and API factory. Called by `AngyEngine`.

```ts
export class ExtensionManager {
  static instance: ExtensionManager | null = null;

  private loader: ExtensionLoader;
  private extensions = new Map<string, LoadedExtension>();
  private vault: SecretsVault;
  private apiFactory: ExtensionAPIFactory;

  async initialize(db: Database): Promise<void>
  async shutdown(): Promise<void>

  async install(dirPath: string): Promise<void>     // copy into extensions dir, activate
  async uninstall(extensionId: string): Promise<void>
  async enable(extensionId: string): Promise<void>
  async disable(extensionId: string): Promise<void>
  async reload(extensionId: string): Promise<void>

  listExtensions(): ExtensionStatus[]
}
```

### 1.7 — Wire into AngyEngine

**Modified file**: `src/engine/AngyEngine.ts`

Two additions only — no existing logic touched:

```ts
// 1. New import + field
import { ExtensionManager } from '../extensions/ExtensionManager';
private extensionManager: ExtensionManager | null = null;

// 2. At the end of initialize(), after all singletons are ready:
this.extensionManager = new ExtensionManager();
await this.extensionManager.initialize(this.db);
```

```ts
// 3. At the start of shutdown(), before closing DB:
await this.extensionManager?.shutdown();
```

That's it for Phase 1. At this point extensions can activate, call `api.epics.list()`, store secrets, and log — but no hooks fire yet.

---

## Phase 2 — Epic lifecycle hooks

Goal: extensions can react to epic events (create, move, complete, fail). Zero changes to existing event logic — hooks are appended *after* existing engineBus handlers.

### 2.1 — HookRegistry

**New file**: `src/extensions/HookRegistry.ts`

```ts
export interface RegisteredEpicHook {
  id: string;
  extensionId: string;
  on: EpicLifecycleHookDef['on'];
  handler: (ctx: EpicHookContext) => Promise<void>;
  priority: number;
  timeout: number;
  api: ExtensionAPI;
}

export interface RegisteredSchedulerHook {
  id: string;
  type: 'canStart' | 'onTick';
  handler: (ctx: SchedulerCanStartContext) => Promise<CanStartResult | void>;
  timeout: number;
  api: ExtensionAPI;
}

export class HookRegistry {
  private epicHooks: RegisteredEpicHook[] = [];
  private schedulerHooks: RegisteredSchedulerHook[] = [];

  registerEpicHook(hook: RegisteredEpicHook): Disposable
  registerSchedulerHook(hook: RegisteredSchedulerHook): Disposable

  // Runs all matching epic hooks sequentially by priority.
  // Errors and timeouts are caught and logged — never thrown.
  async runEpicHooks(event: string, epic: Epic, extra?: { previousColumn?: EpicColumn }): Promise<void>

  // Returns first veto, or { allowed: true } if all hooks pass.
  async runCanStartHooks(epic: Epic, allEpics: Epic[]): Promise<CanStartResult>
}
```

Internal `runEpicHooks` pattern:

```ts
async runEpicHooks(event, epic, extra) {
  const hooks = this.epicHooks
    .filter(h => h.on === event)
    .sort((a, b) => a.priority - b.priority);

  for (const hook of hooks) {
    try {
      await Promise.race([
        hook.handler({ epic, ...extra, api: hook.api }),
        rejectAfter(hook.timeout, `Hook ${hook.id} timed out`),
      ]);
    } catch (err) {
      console.error(`[HookRegistry] Hook ${hook.id} failed:`, err);
      // Never rethrow — hook failures must not affect engine operation
    }
  }
}
```

### 2.2 — Wire HookRegistry into AngyEngine

**Modified file**: `src/engine/AngyEngine.ts` — inside the existing `wireEpicLifecycleEvents()` method, append hook calls *after* each existing `engineBus.on()` block. Existing code is untouched.

```ts
// EXISTING (unchanged):
engineBus.on('epic:completed', async ({ epicId }) => {
  // ... existing logic: move column, release locks, release worktree ...
  engineBus.emit('epic:storeSyncNeeded');
});

// ADDITIVE — appended right after:
engineBus.on('epic:completed', async ({ epicId }) => {
  const epic = await this.db.getEpic(epicId);
  if (epic) await this.hookRegistry?.runEpicHooks('onComplete', epic);
});
```

Same pattern for `epic:failed` → `onFail`, and for `epic:updated` → `onMove` (when column changed):

```ts
engineBus.on('epic:updated', async ({ epicId, epic }) => {
  // ADDITIVE: detect column change via previously stored value
  const prev = this.previousColumns.get(epicId);
  if (prev && prev !== epic.column) {
    await this.hookRegistry?.runEpicHooks('onMove', epic, { previousColumn: prev });
  }
  this.previousColumns.set(epicId, epic.column);
});
```

`this.previousColumns = new Map<string, EpicColumn>()` is added as a private field — no impact on anything else.

For `onCreate`: the `createEpic` path in the DB repository emits `epic:created` (add this emit if it doesn't exist, additive). Then:

```ts
engineBus.on('epic:created', async ({ epic }) => {
  await this.hookRegistry?.runEpicHooks('onCreate', epic);
});
```

### 2.3 — Wire HookRegistry into ExtensionManager

When an extension activates, `ExtensionManager` reads `manifest.contributes.epicLifecycleHooks`, resolves each handler from the loaded module, and calls `hookRegistry.registerEpicHook(...)`. The returned `Disposable` is added to the extension's disposables list so it auto-unregisters on deactivation.

### 2.4 — Wire HookRegistry into AngyEngine

```ts
// In AngyEngine, new field:
private hookRegistry: HookRegistry | null = null;

// In initialize(), after extensionManager.initialize():
this.hookRegistry = new HookRegistry();
this.extensionManager.setHookRegistry(this.hookRegistry);
```

---

## Phase 3 — Scheduler canStart hooks

Goal: extensions can veto or delay epic dispatch. Non-breaking because `runCanStartHooks` returns `{ allowed: true }` by default when no hooks are registered, which is identical to current behavior.

### 3.1 — Wire into Scheduler

**Modified file**: `src/engine/Scheduler.ts` — in `tick()`, after the existing `canAcquireRepos(epic)` check, add:

```ts
// EXISTING (unchanged):
if (!this.canAcquireRepos(epic)) {
  blockingReasons.set(epic.id, [...]);
  continue;
}

// ADDITIVE — inserted immediately after:
if (this.hookRegistry) {
  const verdict = await this.hookRegistry.runCanStartHooks(epic, allEpics);
  if (!verdict.allowed) {
    blockingReasons.set(epic.id, [{
      type: 'extension',
      extensionId: verdict.extensionId,
      reason: verdict.reason ?? 'Blocked by extension',
    }]);
    continue;
  }
}
```

`BlockingReason` in `KosTypes.ts` gets one new optional type `'extension'` added to its union — additive, no existing code breaks.

### 3.2 — Wire hookRegistry into Scheduler

`AngyEngine` passes `hookRegistry` when constructing `Scheduler`, or calls `scheduler.setHookRegistry(this.hookRegistry)` after construction. `Scheduler` stores it as an optional field (`private hookRegistry?: HookRegistry`).

---

## Phase 4 — Custom pipeline types

Goal: extensions can register pipeline types (e.g. `"jira-sprint"`) that the engine dispatches to extension-provided handlers instead of `HybridPipelineRunner`. Non-breaking: the type-check falls through to `HybridPipelineRunner` for all existing values.

### 4.1 — Widen EpicPipelineType

**Modified file**: `src/engine/KosTypes.ts`

```ts
// BEFORE:
export type EpicPipelineType = 'hybrid' | 'fix' | 'investigate' | 'plan';

// AFTER (additive — all existing values still valid):
export type EpicPipelineType = 'hybrid' | 'fix' | 'investigate' | 'plan' | (string & {});
```

### 4.2 — CustomPipelineRegistry

**New file**: `src/extensions/CustomPipelineRegistry.ts`

```ts
export interface CustomPipelineRunner {
  type: string;
  extensionId: string;
  handler: (ctx: PipelineContext) => Promise<void>;
}

export class CustomPipelineRegistry {
  private runners = new Map<string, CustomPipelineRunner>();

  register(runner: CustomPipelineRunner): Disposable
  get(type: string): CustomPipelineRunner | undefined
}

export interface PipelineContext {
  epic: Readonly<Epic>;
  workspace: string;
  api: ExtensionAPI;
}
```

### 4.3 — Wire into AngyEngine

**Modified file**: `src/engine/AngyEngine.ts` — in `spawnEpicOrchestrator()`, before constructing `HybridPipelineRunner`:

```ts
// ADDITIVE — check custom registry first:
const customRunner = this.pipelineRegistry?.get(epic.pipelineType);
if (customRunner) {
  const ctx: PipelineContext = { epic, workspace, api: this.extensionManager!.getAPIFor(customRunner.extensionId) };
  customRunner.handler(ctx).catch(err =>
    engineBus.emit('epic:failed', { epicId, reason: err.message })
  );
  return rootSid;
}

// EXISTING (unchanged):
const runner = new HybridPipelineRunner(...);
```

---

## Phase 5 — UI contribution points

Goal: extensions can contribute sidebar panels, kanban card actions, and settings tabs. All UI slots are optional — if no extensions are installed, the UI is identical.

### 5.1 — Pinia store

**New file**: `src/stores/extensions.ts`

```ts
export const useExtensionStore = defineStore('extensions', () => {
  const extensions = ref<ExtensionStatus[]>([]);

  const activePanels = computed(() =>
    extensions.value
      .filter(e => e.status === 'active')
      .flatMap(e => e.manifest.contributes.sidebarPanels ?? [])
  );

  const activeCardActions = computed(() =>
    extensions.value
      .filter(e => e.status === 'active')
      .flatMap(e => e.manifest.contributes.kanbanCardActions ?? [])
  );

  const activeSettingsPages = computed(() =>
    extensions.value
      .filter(e => e.status === 'active')
      .flatMap(e => e.manifest.contributes.settingsPages ?? [])
  );

  function syncFromManager(statuses: ExtensionStatus[]) {
    extensions.value = statuses;
  }

  return { extensions, activePanels, activeCardActions, activeSettingsPages, syncFromManager };
});
```

### 5.2 — ExtensionUIRegistry

**New file**: `src/extensions/ExtensionUIRegistry.ts`

Loads `dist/ui.js` for each active extension that contributes UI via dynamic `import()`. Caches the resulting component map. Provides `getComponent(extensionId, exportName)` to UI slots.

### 5.3 — ExtensionErrorBoundary

**New file**: `src/components/extensions/ExtensionErrorBoundary.vue`

```vue
<template>
  <slot v-if="!hasError" />
  <div v-else class="text-xs text-[var(--text-muted)] p-2">
    Extension error: {{ errorMessage }}
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
const hasError = ref(false);
const errorMessage = ref('');
onErrorCaptured((err) => {
  hasError.value = true;
  errorMessage.value = (err as Error).message;
  return false;
});
</script>
```

### 5.4 — Sidebar panels

**Modified file**: `src/components/layout/NavRail.vue` (or equivalent sidebar/nav component)

Append after existing nav items — additive only:

```vue
<!-- ADDITIVE — contributed sidebar panels -->
<template v-for="panel in extensionStore.activePanels" :key="panel.id">
  <ExtensionErrorBoundary>
    <ExtensionSidebarPanel :panel="panel" />
  </ExtensionErrorBoundary>
</template>
```

**New file**: `src/components/extensions/ExtensionSidebarPanel.vue` — loads component from `ExtensionUIRegistry` and mounts it.

### 5.5 — Kanban card actions

**Modified file**: `src/components/kanban/EpicCard.vue`

Add a "..." context menu button (visible on hover). When opened, show contributed actions filtered by the epic's current column. If `activeCardActions` is empty, the button doesn't render — existing layout is unchanged.

```vue
<!-- ADDITIVE -->
<div v-if="relevantActions.length" class="extension-actions">
  <button @click.stop="actionsOpen = !actionsOpen">···</button>
  <div v-if="actionsOpen" class="dropdown">
    <button
      v-for="action in relevantActions"
      :key="action.id"
      @click="handleExtensionAction(action)"
    >{{ action.label }}</button>
  </div>
</div>
```

### 5.6 — Settings pages

**Modified file**: `src/components/settings/SettingsDialog.vue`

Append contributed tab entries after built-in tabs — additive only. Lazy-mount on first tab activation:

```vue
<TabsTrigger
  v-for="page in extensionStore.activeSettingsPages"
  :key="page.id"
  :value="page.id"
>{{ page.title }}</TabsTrigger>

<TabsContent
  v-for="page in extensionStore.activeSettingsPages"
  :key="page.id"
  :value="page.id"
>
  <ExtensionErrorBoundary>
    <ExtensionSettingsPage :page="page" />
  </ExtensionErrorBoundary>
</TabsContent>
```

---

## Phase 6 — Extensions manager UI

Goal: a dedicated UI to see, enable, disable, and install extensions. Completely new UI — nothing existing is touched.

### 6.1 — ExtensionsManager view

**New file**: `src/components/extensions/ExtensionsManager.vue`

Shows a list of discovered extensions with status badges (active / error / disabled). Per extension:
- Enable / Disable toggle
- Reload button
- "Open folder" (opens `~/.angy/extensions/<id>/` in Finder via Tauri shell)
- Permissions list
- Error detail if status is `error`

### 6.2 — Nav entry

Add an "Extensions" entry to the sidebar/nav. One new route and one new nav icon — additive.

---

## Phase 7 — Webhooks (optional, can ship later)

Goal: extensions can register an inbound HTTP endpoint so external systems (Jira, GitHub) can push events.

**New file**: `src/extensions/WebhookServer.ts`

Starts a single lightweight HTTP server (Node `http` module) on a configurable port (default `47821`). Routes `POST /webhooks/<path>` to the registered handler. The port is shown in the extension's settings page so users can paste the URL into Jira/GitHub webhook configuration.

```ts
export class WebhookServer {
  private server: http.Server | null = null;
  private handlers = new Map<string, WebhookHandler>();

  async start(port: number): Promise<void>
  register(path: string, handler: WebhookHandler): Disposable
  async stop(): Promise<void>
}
```

Extensions access this via `api.webhooks.listen(path, handler)` — the API method calls through to `ExtensionManager` → `WebhookServer.register()`.

---

## File summary

### New files (all additive)

| File | Phase |
|------|-------|
| `src/extensions/ExtensionManifest.ts` | 1 |
| `src/extensions/api/ExtensionAPI.ts` | 1 |
| `src/extensions/SecretsVault.ts` | 1 |
| `src/extensions/ExtensionAPIFactory.ts` | 1 |
| `src/extensions/ExtensionLoader.ts` | 1 |
| `src/extensions/ExtensionManager.ts` | 1 |
| `src/extensions/HookRegistry.ts` | 2 |
| `src/extensions/CustomPipelineRegistry.ts` | 4 |
| `src/extensions/ExtensionUIRegistry.ts` | 5 |
| `src/extensions/WebhookServer.ts` | 7 |
| `src/stores/extensions.ts` | 5 |
| `src/components/extensions/ExtensionErrorBoundary.vue` | 5 |
| `src/components/extensions/ExtensionSidebarPanel.vue` | 5 |
| `src/components/extensions/ExtensionSettingsPage.vue` | 5 |
| `src/components/extensions/ExtensionsManager.vue` | 6 |

### Modified files (additive changes only)

| File | Change | Phase |
|------|--------|-------|
| `src/engine/Database.ts` | Add 2 new `CREATE TABLE IF NOT EXISTS` blocks | 1 |
| `src/engine/AngyEngine.ts` | Add `extensionManager`, `hookRegistry`, `pipelineRegistry` fields; append listeners in `wireEpicLifecycleEvents()`; check custom pipeline before `HybridPipelineRunner` | 1–4 |
| `src/engine/KosTypes.ts` | Widen `EpicPipelineType` to include `string & {}`; add `'extension'` to `BlockingReason` type union | 3–4 |
| `src/engine/Scheduler.ts` | Add optional `hookRegistry` field; insert `runCanStartHooks()` call after `canAcquireRepos()` check | 3 |
| `src/components/layout/NavRail.vue` | Append `<ExtensionSidebarPanel>` slots after existing items | 5 |
| `src/components/kanban/EpicCard.vue` | Append optional "..." context menu for card actions | 5 |
| `src/components/settings/SettingsDialog.vue` | Append contributed tab entries | 5 |

---

## Jira extension — concrete example

To verify the design works, build `com.angy.jira` in parallel with Phase 2. It exercises every hook type and proves the API surface before Phase 5 UI work begins.

**What it does:**
- `onCreate` → create Jira issue, store `jiraKey` in `api.epics.setMeta()`
- `onMove` → transition Jira issue status
- `onComplete` → mark Jira issue Done
- Command `jira.import-sprint` → fetch sprint issues, call `api.epics.create()` for each
- `JiraSettingsPage.vue` → host/email/token fields using `api.config.setSecret()`
- Kanban card action "Open in Jira" → reads `jiraKey` meta, opens URL via Tauri shell

**Directory layout:**
```
~/.angy/extensions/com.angy.jira/
  angy-extension.json
  dist/
    engine.js    (compiled from src/engine/index.ts)
    ui.js        (compiled from src/ui/*.vue)
  package.json
```

This extension requires zero changes to Angy core once Phases 1–5 are complete.
