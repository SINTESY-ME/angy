# AngyCode Server → Angy UI Integration Plan

Connect `angycode-server` to the Angy UI so that Gemini (and future non-Claude) models are
available in the chat UI with **full message history owned by Angy's own SQLite DB**.

The server has its own SQLite DB (`~/.angycode/angycode.db`) but that is its internal concern.
Angy must consume the SSE `AgentEvent` stream and write every message into its own DB, exactly
as it does today for the Claude CLI path.

---

## 1. Invariants — what must not break

- `ClaudeProcess` / `ProcessManager` are **not touched**. The Claude CLI path is unchanged.
- `useEngine.ts` / `ChatPanel.vue` send-logic changes are **surgical**: only a routing branch
  for Gemini models.
- `AgentHandle` interface is **not changed**.
- Angy's SQLite DB (`Database`) remains the single source of truth for all chat history.

---

## 2. High-level architecture

```
ChatPanel.vue
  └─ onSend()
       ├─ (Claude model)  → sendMessageToEngine → ProcessManager → ClaudeProcess [unchanged]
       └─ (Gemini model)  → sendAngyCodeMessage → AngyCodeProcessManager
                                                        └─ ServerProcess (HTTP)
                                                             ├─ POST /sessions
                                                             └─ GET /sessions/:id/events (SSE)
                                                                  └─ AgentEvent → AgentHandle
                                                                                 + Angy DB
```

---

## 3. Pre-requisite: extract `summarizeTool` to a shared utility

`summarizeTool` is a module-level function inside `ProcessManager.ts` and is **not exported**.
`AngyCodeProcessManager` needs the same logic. Before implementing anything else:

**Create `src/engine/toolSummary.ts`** — move the function there and export it:

```typescript
export function summarizeTool(toolName: string, input: Record<string, any>): string { ... }
```

**Update `ProcessManager.ts`** — remove the local definition and import from `toolSummary.ts`.

This is a pure refactor with no behaviour change. It must be done first to avoid a build error.

---

## 4. New files (all in `src/engine/`)

### 4.1 `ServerProcess.ts`

Single responsibility: own the `angycode-server` child process and expose a base URL.

```
State:
  child: Child | null        (Tauri shell child)
  baseUrl: string | null     (set when READY line is parsed)
  port: number | null

Public API:
  start(): Promise<void>
    - Resolve binary via the same enhanced PATH as ClaudeProcess.buildEnhancedPath()
    - Spawn via Command.create('exec-sh', ['-c', 'angycode-server --port 0'])
      (exec-sh is already in Tauri capabilities — no new capability needed)
    - Read stdout lines until `ANGYCODE_SERVER_READY port=N`
    - Set baseUrl = `http://127.0.0.1:N`

  stop(): Promise<void>
    - Kill child process

  getBaseUrl(): string
    - Throws if not started yet

  isRunning(): boolean
```

**Tauri CSP note:** `tauri.conf.json` has `"csp": null` — all localhost `fetch()` calls are
unrestricted. No Tauri config changes needed.

**Dev setup requirement:** `angycode-server` must be built and in PATH before Angy starts.
The developer must run `cd code && npm run build` once. Add this to the project README.
Without it, `start()` will fail with "command not found" and Gemini models will appear to hang.

**Lifecycle:** `AngyEngine.initialize()` starts it, `AngyEngine.shutdown()` stops it.
Store on `AngyEngine` as `engine.serverProcess`.

---

### 4.2 `AngyCodeProcessManager.ts`

Single responsibility: map one Angy session to one `angycode-server` session and bridge all
`AgentEvent`s to `AgentHandle` + Angy's own DB persistence.

```typescript
interface AngyCodeSession {
  serverSessionId: string;   // ID returned by POST /sessions
  cursor: number;            // count of SSE events consumed — passed as ?cursor=N on reconnect
  eventSource: EventSource | null;
  done: boolean;
}
```

```
State:
  private sessions: Map<string, AngyCodeSession>   (keyed by Angy sessionId)
  private buffer: SessionMessageBuffer              (same class used by ProcessManager)
  private serverProcess: ServerProcess

Public API:
  sendMessage(sessionId, text, handle, options): Promise<void>
    1. POST baseUrl/sessions → get serverSessionId
    2. Create AngyCodeSession { serverSessionId, cursor: 0, eventSource: null, done: false }
    3. Store entry in sessions map
    4. openSseStream(sessionId, handle)

  continueSession(sessionId, text, handle): Promise<void>
    1. Look up AngyCodeSession — if not found, throw (caller must use sendMessage)
    2. POST baseUrl/sessions/:serverSessionId/continue { message: text }
    3. openSseStream(sessionId, handle)  ← opens new EventSource with ?cursor=<current cursor>

  cancel(sessionId): void
    1. Close eventSource if open
    2. POST baseUrl/sessions/:serverSessionId/abort  (fire-and-forget)
    3. Mark done, call handle.markDone

  isRunning(sessionId): boolean
    - entry exists and !entry.done
```

**`openSseStream(sessionId, handle)`** — private helper:

```
1. const entry = sessions.get(sessionId)
2. Close any existing entry.eventSource
3. const es = new EventSource(baseUrl/sessions/:serverSessionId/events?cursor=entry.cursor)
4. entry.eventSource = es
5. es.onmessage = (e) => { handleEvent(JSON.parse(e.data), sessionId, handle) }
6. es.onerror = () => { handle.showError(sessionId, 'SSE connection lost'); entry.done = true; }
```

**Why `EventSource` (not `fetch` + stream):** `EventSource` is natively available in Tauri's
WebKit renderer and is simpler to implement correctly. Custom headers are not needed — the API
key is in the `POST /sessions` body, not in the SSE request. The plan originally mentioned
`fetch` as a fallback, but `EventSource` is the right tool here.

---

## 5. Event mapping: `AgentEvent` → `AgentHandle` + Angy DB

This is the critical correctness requirement. Every event must:
1. Increment `entry.cursor` (prevents duplicate messages on reconnect)
2. Update `AgentHandle` (live UI)
3. Update `SessionMessageBuffer` (Angy DB persistence)

| `AgentEvent.type` | Action |
|---|---|
| `session_start` | `handle.setRealSessionId(sessionId, event.sessionId)` |
| `text` | `buffer.appendAssistantDelta(sessionId, event.text)` + `handle.appendTextDelta(sessionId, event.text)` |
| `tool_start` | `summarizeTool(event.name, event.input)` → `buffer.addToolMessage(...)` + `handle.addToolUse(...)` + `engineBus.emit('agent:statusChanged', working)` + `handle.onFileEdited?.(...)` if Edit/Write |
| `tool_output` | no-op — tool results are internal to `AgentLoop`; not stored in Angy chat (consistent with Claude path) |
| `usage` | `engineBus.emit('agent:costUpdate', { sessionId, costUsd: event.cost_usd ?? 0, inputTokens: event.input_tokens, outputTokens: event.output_tokens })` |
| `done` | close EventSource → `await buffer.flush(sessionId)` → `handle.markDone(sessionId)` → `buffer.clear(sessionId)` → `engineBus.emit('session:finished', ...)` → `engineBus.emit('agent:statusChanged', idle)` → mark `entry.done = true` |
| `error` | `buffer.appendAssistantDelta(sessionId, 'Error: ' + event.message)` + `handle.showError(sessionId, event.message)` |

**Critical ordering for `done`:** `buffer.flush()` is `async` and must be `await`-ed before
calling `handle.markDone()`. This matches what `ProcessManager.wireEvents` does. If `markDone`
fires before flush completes, the last assistant message may not be in the DB yet when the UI
tries to load history.

**Cursor increment:** `entry.cursor++` must happen for **every** event, including `done` and
`error`. This ensures that if `continueSession` is called after an error, the new SSE
connection starts from where the error was, not from the beginning.

---

## 6. Routing: when to use which path

The routing decision is made in **`useEngine.ts`**, keeping `ChatPanel.vue` unaware.

Add alongside the existing exports:

```typescript
export function isAngyCodeModel(model: string): boolean {
  return model.startsWith('gemini-');
}

export function sendAngyCodeMessage(
  sessionId: string,
  text: string,
  handle: AgentHandle,
  options: AngyCodeProcessOptions,
): Promise<void> {
  return getAngyCodeProcessManager().sendMessage(sessionId, text, handle, options);
}

export function cancelAngyCodeProcess(sessionId: string): void {
  getAngyCodeProcessManager().cancel(sessionId);
}
```

`getAngyCodeProcessManager()` follows the same singleton pattern as `getProcessManager()`,
injected via `setAngyCodeProcessManager(apm)` called from `AngyEngine.initialize()`.

In `ChatPanel.vue`'s `onSend()`:

```typescript
if (isAngyCodeModel(ui.currentModel)) {
  sendAngyCodeMessage(sid, engineMessage, chatPanelHandle, {
    workingDir: ui.workspacePath || '.',
    provider: 'gemini',
    model: ui.currentModel,
    apiKey: ui.geminiApiKey,
    systemPrompt,
  });
} else {
  sendMessageToEngine(sid, engineMessage, chatPanelHandle, { ... });
}
```

Also update `onStop()` in `ChatPanel.vue` — currently calls `cancelProcess(sid)`. Add:

```typescript
if (isAngyCodeModel(ui.currentModel)) {
  cancelAngyCodeProcess(sid);
} else {
  cancelProcess(sid);
}
```

Same routing in `CodeChatPanel.vue` (it also calls `sendMessageToEngine` with `ui.currentModel`).

---

## 7. `ModelSelector.vue` — add Gemini models, disable when no key

### Model list

```typescript
import { useUiStore } from '../../stores/ui';
const ui = useUiStore();

const models = [
  { id: 'claude-sonnet-4-6',         name: 'Sonnet 4.6',       desc: 'Fast & capable',   provider: 'claude' },
  { id: 'claude-opus-4-6',           name: 'Opus 4.6',         desc: 'Most powerful',    provider: 'claude' },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5',        desc: 'Fastest',          provider: 'claude' },
  { id: 'gemini-3-flash-preview',    name: 'Gemini 3 Flash',   desc: 'Google · Fast',    provider: 'gemini' },
  { id: 'gemini-3.1-pro-preview',    name: 'Gemini 3.1 Pro',   desc: 'Google · Powerful', provider: 'gemini' },
];

const geminiKeyMissing = computed(() => !ui.geminiApiKey);

function isDisabled(model: typeof models[0]): boolean {
  return model.provider === 'gemini' && geminiKeyMissing.value;
}
```

### Template change

In the dropdown item loop, apply disabled styling and block click when key is missing:

```html
<div
  v-for="model in models"
  :key="model.id"
  @click="!isDisabled(model) && select(model.id)"
  class="flex items-center gap-2 px-3 py-1.5 whitespace-nowrap"
  :class="[
    model.id === props.modelValue ? 'text-[var(--accent-mauve)]' : '',
    isDisabled(model)
      ? 'opacity-40 cursor-not-allowed'
      : 'cursor-pointer hover:bg-white/[0.05]'
  ]"
  :title="isDisabled(model) ? 'Add your Gemini API key in Settings to enable' : ''"
>
```

This means Gemini rows are visible in the list (the user can see they exist) but clicking does
nothing and a native tooltip explains why. No separate modal or warning needed.

---

## 8. API key storage — SQLite `app_settings` table

### Why SQLite (not `settings.json` or `localStorage`)

The existing app-level settings (Claude path, default model, workspace) use a `settings.json`
file (plaintext). An API key should not live in a JSON file that can be trivially `cat`-ed.
`localStorage` in a Tauri renderer is ephemeral on some platforms and also plaintext.
Angy's own SQLite DB (`history.db`) is the right place — it is already the authoritative store
for all session and config data.

### `src/engine/Database.ts` — add `app_settings` table

In `createTables()`, add:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
```

Add two methods:

```typescript
async getAppSetting(key: string): Promise<string | null>
async setAppSetting(key: string, value: string): Promise<void>
```

Both are simple `SELECT`/`INSERT OR REPLACE` one-liners on the `app_settings` table.

### `src/stores/ui.ts`

Add one reactive field, initially empty:

```typescript
const geminiApiKey = ref('');
```

Expose it in the store's return object alongside `currentModel`.

**Population:** After engine initializes (in `App.vue` or the engine init hook), load the key
from the DB into the store:

```typescript
const key = await engine.db.getAppSetting('gemini_api_key');
if (key) ui.geminiApiKey = key;
```

The store is not responsible for DB I/O itself — it is populated once at startup and updated
by the settings dialog.

### `src/components/settings/SettingsDialog.vue`

Add a **"Providers"** section inside the existing **General** tab (after the Default Model row).
It contains a single "Gemini API Key" password input:

```
Label: Gemini API Key
Input: type="password", placeholder="AIza…", v-model="localGeminiKey"
       + a toggle-visibility button (show/hide the key)
Help:  "Required to use Gemini models. Get yours at aistudio.google.com"
```

**Load on open:** when the dialog opens (or `onMounted`), read the current value:

```typescript
const localGeminiKey = ref('');
onMounted(async () => {
  localGeminiKey.value = await getDatabase().getAppSetting('gemini_api_key') ?? '';
});
```

**Save on the existing Save button:** the `save()` function already writes `settings.json`
and triggers `emit('saved', ...)`. Extend it to also persist the key:

```typescript
if (localGeminiKey.value.trim()) {
  await getDatabase().setAppSetting('gemini_api_key', localGeminiKey.value.trim());
} else {
  // empty input means "remove key" — store empty string
  await getDatabase().setAppSetting('gemini_api_key', '');
}
// Update the ui store so the model selector reacts immediately
ui.geminiApiKey = localGeminiKey.value.trim();
```

No new tab is needed — keep it in General to avoid tab proliferation.

---

## 9. `AngyCodeProcessOptions` type

Add to `src/engine/types.ts`:

```typescript
export interface AngyCodeProcessOptions {
  workingDir: string;
  provider: 'gemini';
  model: string;
  apiKey: string;
  systemPrompt?: string;
  maxTokens?: number;
  maxTurns?: number;
}
```

---

## 10. `AngyEngine` — wire `ServerProcess` and `AngyCodeProcessManager`

```typescript
// New fields
readonly serverProcess: ServerProcess;
readonly angyCodeProcesses: AngyCodeProcessManager;

// constructor:
this.serverProcess = new ServerProcess();
this.angyCodeProcesses = new AngyCodeProcessManager(this.serverProcess, this.db);

// initialize() — after DB open:
await this.serverProcess.start();
setAngyCodeProcessManager(this.angyCodeProcesses);

// shutdown() — before DB close:
await this.serverProcess.stop();
```

---

## 11. Session continuity: how multi-turn works end-to-end

```
Turn 1:
  ChatPanel.onSend("hello")
    → sendAngyCodeMessage → POST /sessions → serverSessionId = "abc"
    → entry = { serverSessionId: "abc", cursor: 0, done: false }
    → EventSource(/sessions/abc/events?cursor=0)
    → events arrive: text, tool_start, done
    → cursor ends at e.g. 5, entry.done = true, EventSource closed

Turn 2:
  ChatPanel.onSend("follow up")
    → continueSession → POST /sessions/abc/continue { message: "follow up" }
    → EventSource(/sessions/abc/events?cursor=5)   ← starts AFTER turn-1 events
    → new events arrive from cursor=5 onward
    → cursor grows from 5, entry.done = true again at end
```

The cursor prevents re-processing turn-1 events. Without it, the server would replay all 5
turn-1 events again on the turn-2 SSE connection, causing duplicate messages in the UI and DB.

---

## 12. Build sequence

### Phase 0 — Refactor (prerequisite, no behaviour change)
1. Extract `summarizeTool` from `ProcessManager.ts` → new `src/engine/toolSummary.ts`
2. Update `ProcessManager.ts` to import from `toolSummary.ts`
3. Verify build still passes

### Phase 1 — Types and key storage
4. Add `AngyCodeProcessOptions` to `src/engine/types.ts`
5. Add `app_settings` table + `getAppSetting`/`setAppSetting` to `Database.ts`
6. Add `geminiApiKey = ref('')` to `src/stores/ui.ts`, populate from DB after engine init
7. Add Gemini key input (password field) to `SettingsDialog.vue` General tab

### Phase 2 — Server process wrapper
7. Implement `src/engine/ServerProcess.ts`
8. Wire into `AngyEngine` (field + start/stop)
9. Run `cd code && npm run build` — verify `angycode-server` binary is available in PATH

### Phase 3 — Event bridge
10. Implement `src/engine/AngyCodeProcessManager.ts` (event mapping per §5)
11. Add `setAngyCodeProcessManager` + `getAngyCodeProcessManager` to `useEngine.ts`
12. Wire `AngyEngine.initialize()` to call `setAngyCodeProcessManager`

### Phase 4 — Routing
13. Add `isAngyCodeModel`, `sendAngyCodeMessage`, `cancelAngyCodeProcess` to `useEngine.ts`
14. Update `ChatPanel.vue` `onSend` + `onStop` with routing branch
15. Update `CodeChatPanel.vue` similarly

### Phase 5 — Model selector
16. Add two Gemini entries to `ModelSelector.vue`

### Phase 6 — Manual smoke test
17. Start Angy, enter Gemini API key in settings
18. Select "Gemini 3 Flash", send a message — verify SSE events arrive and messages appear
19. Send a follow-up — verify cursor is correct (no duplicate messages)
20. Verify Claude models still work without regression

---

## 13. What the server DB is used for (and what it is NOT)

The server's `~/.angycode/angycode.db` is `AgentLoop`'s internal store for its own session
and message records. It is **opaque to Angy**. Angy's chat history, session list, tool records,
and costs are all written by `AngyCodeProcessManager` via `SessionMessageBuffer` and `engineBus`
into Angy's own DB. No reads from the server DB are ever needed by the UI.

---

## 14. Known limitations (deferred)

| Limitation | Notes |
|---|---|
| Server restart loses session registry | The server's in-memory session map doesn't survive restart. If Angy or the server restarts mid-session, `/continue` will 404. Not handled — user must start a new session. |
| Epics always use Claude | `HybridPipelineRunner` uses `ProcessManager` exclusively. Gemini is chat-only. Acceptable for phase 1. |
| `rewindFiles` not available for Gemini | Claude-CLI-specific feature. Omit from `AngyCodeProcessManager`. |
| `angycode-server` packaging | Dev: manually built + in PATH. Prod: Tauri sidecar entry in `tauri.conf.json` needed. Deferred to packaging phase. |
