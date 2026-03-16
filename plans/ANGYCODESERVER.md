# AngyCode Server — Implementation Plan

A Hono-based HTTP/SSE server wrapping `@angycode/core`'s `AgentLoop`. Angy (Tauri) spawns it
as a child process on startup and communicates with it over localhost. This keeps `@angycode/core`
(a Node.js library) entirely out of Tauri's renderer while still avoiding the CLI round-trip.

---

## 1. Why this approach

- `@angycode/core` uses `better-sqlite3`, `child_process`, `node:fs` — none of these work in a
  Tauri renderer (browser context). Direct import is impossible.
- Spawning `angycode-server` as a sidecar gives Angy a stable localhost HTTP endpoint.
- SSE lets Angy stream `AgentEvent`s in real time, exactly like it currently streams stdout from
  the `claude` CLI process.
- The server is single-tenant (only Angy talks to it, on localhost). No auth complexity needed.

---

## 2. Package location and structure

```
code/packages/server/
├── src/
│   ├── index.ts          — entry point: parse --port, open DB, start server, print READY line
│   ├── server.ts         — Hono app with all routes wired up
│   ├── session.ts        — in-memory session registry (AgentLoop instances + event buffer)
│   └── sse.ts            — SSE stream helper
├── package.json
└── tsconfig.json
```

Add `{ "path": "packages/server" }` to the root `tsconfig.json` references and
`"packages/*"` already covers it in `package.json` workspaces.

---

## 3. Package files

### `package.json`

```json
{
  "name": "@angycode/server",
  "version": "0.1.0",
  "type": "module",
  "bin": { "angycode-server": "dist/index.js" },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc --build",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@angycode/core": "*",
    "@hono/node-server": "^1.13.0",
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

Note: use `@hono/node-server` (the Node.js adapter for Hono). Hono itself is runtime-agnostic;
this adapter provides the `serve()` function for Node.js.

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"],
  "references": [
    { "path": "../core" }
  ]
}
```

---

## 4. Solving the sessionId dependency (required change to `@angycode/core`)

### The problem

`AgentLoop.run()` generates the sessionId internally via `nanoid()` and only exposes it through
the `session_start` event. This creates a chicken-and-egg problem in the server:

- The session registry must be keyed by sessionId so SSE clients can find it via
  `GET /sessions/:id/events`
- But the sessionId isn't known until `run()` starts
- `run()` must be called without `await` so the HTTP response can return immediately
- A `registerSession('pending', loop)` workaround leaves the entry under the wrong key —
  SSE clients looking up the real sessionId will get a 404

### The fix — add `sessionId?` to `AgentLoopOptions`

Add one optional field to `AgentLoopOptions` in `core/src/types.ts`:

```typescript
export interface AgentLoopOptions {
  // ... existing fields ...
  sessionId?: string;   // if provided, use this instead of generating one
}
```

In `AgentLoop.run()`, replace the `nanoid()` call with:

```typescript
const session = this.sessionStore.createSession({
  id: this.options.sessionId ?? nanoid(),
  // ...
});
```

No other change to `AgentLoop` is needed. The server now does:

```typescript
import { nanoid } from 'nanoid';

// In POST /sessions handler:
const sessionId = nanoid();                  // generated here, in the server
const loop = new AgentLoop({ ..., sessionId });
registerSession(sessionId, loop);            // registered under the right key immediately
loop.run(body.goal).catch(() => {});         // fires async, session_start will use sessionId
return c.json({ sessionId }, 201);           // returned before loop even starts
```

This eliminates any timing dependency. The registry, the HTTP response, and the SSE lookup
all use the same id from the start.

---

## 5. The session registry (`session.ts`)

This is the core state. One `ActiveSession` per in-flight `AgentLoop`.

```typescript
import type { AgentLoop } from '@angycode/core';
import type { AgentEvent } from '@angycode/core';

export interface ActiveSession {
  loop: AgentLoop;
  events: AgentEvent[];          // append-only buffer — never truncated during a run
  done: boolean;
  listeners: Set<(e: AgentEvent) => void>;  // live SSE connections
}

const sessions = new Map<string, ActiveSession>();

export function registerSession(sessionId: string, loop: AgentLoop): ActiveSession {
  const entry: ActiveSession = { loop, events: [], done: false, listeners: new Set() };
  sessions.set(sessionId, entry);

  loop.on('event', (event) => {
    entry.events.push(event);
    for (const fn of entry.listeners) fn(event);
    if (event.type === 'done' || event.type === 'error') {
      entry.done = true;
    }
  });

  return entry;
}

export function getSession(sessionId: string): ActiveSession | undefined {
  return sessions.get(sessionId);
}

export function abortSession(sessionId: string): boolean {
  const entry = sessions.get(sessionId);
  if (!entry) return false;
  entry.loop.abort();
  return true;
}

export function allSessions(): string[] {
  return [...sessions.keys()];
}
```

**Why a listener Set instead of just buffering?**
SSE connections subscribe immediately via `listeners`. When a client connects late (or reconnects),
it replays `events[cursor..]` from the buffer and then subscribes for live events. Both paths
are handled cleanly this way.

---

## 6. The SSE helper (`sse.ts`)

Hono supports SSE via `streamSSE()`. The helper wraps the session subscription:

```typescript
import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import type { AgentEvent } from '@angycode/core';
import { getSession } from './session.js';

export async function sseHandler(c: Context): Promise<Response> {
  const sessionId = c.req.param('id');
  const cursor = Number(c.req.query('cursor') ?? '0');

  const entry = getSession(sessionId);
  if (!entry) return c.json({ error: 'session not found' }, 404);

  return streamSSE(c, async (stream) => {
    // 1. Replay buffered events from cursor
    for (let i = cursor; i < entry.events.length; i++) {
      await stream.writeSSE({ data: JSON.stringify(entry.events[i]) });
    }

    // 2. If already done, close immediately
    if (entry.done) return;

    // 3. Subscribe for live events
    await new Promise<void>((resolve) => {
      const listener = async (event: AgentEvent) => {
        await stream.writeSSE({ data: JSON.stringify(event) });
        if (event.type === 'done' || event.type === 'error') {
          entry.listeners.delete(listener);
          resolve();
        }
      };
      entry.listeners.add(listener);

      // Clean up if client disconnects
      stream.onAbort(() => {
        entry.listeners.delete(listener);
        resolve();
      });
    });
  });
}
```

---

## 7. The Hono server (`server.ts`)

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createProvider, createDefaultRegistry, AgentLoop, DatabaseImpl } from '@angycode/core';
import { nanoid } from 'nanoid';
import { registerSession, getSession, abortSession } from './session.js';
import { sseHandler } from './sse.js';

export function createApp(db: DatabaseImpl) {
  const app = new Hono();

  // CORS — Tauri webviews enforce it even on localhost
  app.use('*', cors({ origin: '*' }));

  // ── POST /sessions — start a new session ──────────────────────────
  app.post('/sessions', async (c) => {
    const body = await c.req.json<{
      goal: string;
      provider: 'anthropic' | 'gemini';
      model?: string;
      workingDir: string;
      apiKey: string;
      maxTokens?: number;
      maxTurns?: number;
      systemPromptExtra?: string;
      disabledTools?: string[];
    }>();

    // Generate the id here so it's known before the loop starts (see §4)
    const sessionId = nanoid();

    const provider = createProvider({
      name: body.provider,
      apiKey: body.apiKey,
      model: body.model ?? (body.provider === 'gemini' ? 'gemini-2.0-pro' : 'claude-opus-4-6'),
    });
    const tools = createDefaultRegistry();
    const loop = new AgentLoop({
      provider,
      tools,
      db,
      workingDir: body.workingDir,
      maxTokens: body.maxTokens ?? 8192,
      maxTurns: body.maxTurns ?? 200,
      providerName: body.provider,
      model: body.model,
      systemPromptExtra: body.systemPromptExtra,
      disabledTools: body.disabledTools,
      sessionId,           // injected — loop will use this instead of generating one
    });

    // Register under the known id before the loop fires
    registerSession(sessionId, loop);

    // Run async — do not await
    loop.run(body.goal).catch(() => {});

    return c.json({ sessionId }, 201);
  });

  // ── GET /sessions/:id/events — SSE stream ─────────────────────────
  app.get('/sessions/:id/events', sseHandler);

  // ── POST /sessions/:id/abort ──────────────────────────────────────
  app.post('/sessions/:id/abort', (c) => {
    const ok = abortSession(c.req.param('id'));
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
  });

  // ── POST /sessions/:id/continue — send a follow-up user message ───
  app.post('/sessions/:id/continue', async (c) => {
    const sessionId = c.req.param('id');
    const entry = getSession(sessionId);
    if (!entry) return c.json({ error: 'not found' }, 404);

    const { message } = await c.req.json<{ message: string }>();
    entry.loop.continueSession(sessionId, message).catch(() => {});
    return c.json({ ok: true });
  });

  return app;
}
```

---

## 8. The entry point (`index.ts`)

```typescript
import { serve } from '@hono/node-server';
import { DatabaseImpl } from '@angycode/core';
import { createApp } from './server.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const port = Number(process.argv.find((a, i) => process.argv[i - 1] === '--port') ?? 7341);
const dbDir = join(homedir(), '.angycode');
mkdirSync(dbDir, { recursive: true });

// DatabaseImpl constructor handles directory creation and schema migrations
const db = new DatabaseImpl(join(dbDir, 'angycode.db'));
const app = createApp(db);

// Graceful shutdown
process.on('SIGTERM', () => { db.close(); process.exit(0); });
process.on('SIGINT',  () => { db.close(); process.exit(0); });

serve({ fetch: app.fetch, port }, (info) => {
  // Angy reads this line from stdout to know the server is ready and which port to use
  console.log(`ANGYCODE_SERVER_READY port=${info.port}`);
});
```

Angy spawns the process with `--port 0` to get an OS-assigned port, then reads stdout until it
sees `ANGYCODE_SERVER_READY port=N` to know the actual port.

---

## 9. Core exports — what already exists and what to verify

All of these are already exported from `core/src/index.ts` (verified against current source):

| Name | Where defined | Notes |
|---|---|---|
| `AgentLoop` | `agent/AgentLoop.ts` | Already exported via `agent/index.ts` |
| `createProvider(config: ProviderConfig)` | `providers/index.ts` | Takes `{ name, apiKey, model }` — **not** positional args |
| `createDefaultRegistry()` | `tools/index.ts` | Returns a `ToolRegistry` with all 8 built-in tools |
| `DatabaseImpl` | `db/database.ts` | Constructor takes optional path; handles migrations |

The only change needed in `@angycode/core` is adding `sessionId?` to `AgentLoopOptions`
in `types.ts` and using it in `AgentLoop.run()` (see §4).

---

## 10. What Angy needs on its side

A `ServerProcess` class (in `src/engine/`) that:

1. Resolves the `angycode-server` binary (built into the app bundle as a Tauri sidecar, or
   found via PATH during development)
2. Spawns it with `--port 0`
3. Reads stdout line by line until `ANGYCODE_SERVER_READY port=N`
4. Stores `baseUrl = http://127.0.0.1:N`
5. Exposes methods mirroring `ClaudeProcess`'s interface:
   - `startSession(goal, options)` → `POST /sessions` → returns `sessionId`
   - `subscribeEvents(sessionId, cursor)` → `GET /sessions/:id/events` → returns an `EventSource`
   - `abort(sessionId)` → `POST /sessions/:id/abort`
   - `continueSession(sessionId, message)` → `POST /sessions/:id/continue`

The existing `StreamParser` and `ProcessManager` wiring stays untouched for the `claude` path.
A new `AngyCodeProcessManager` wraps `ServerProcess` and adapts `AgentEvent` to the same
`AgentHandle` interface that `ChatPanel` already implements.

---

## 11. API key flow

Angy passes API keys as environment variables when spawning the server:

```
ANTHROPIC_API_KEY=sk-ant-...  angycode-server --port 0
GEMINI_API_KEY=AIza...         angycode-server --port 0
```

The server reads them from `process.env`. `POST /sessions` body includes `provider` and
`apiKey` — but `apiKey` can be omitted if the server should read from env. Decision: **require
`apiKey` in the POST body** so Angy has full control and the server is stateless about keys.

---

## 12. CORS note

Tauri's webview enforces CORS even for `localhost` requests. The `cors()` middleware with
`origin: '*'` is sufficient. No credentials are involved so wildcard is safe.

---

## 13. Build sequence

### Phase 1 — Package scaffold (no code yet, just wiring)
1. Create `packages/server/package.json` and `tsconfig.json`
2. Add server to root `tsconfig.json` references
3. Run `npm install` in workspace root to link `@angycode/core`

### Phase 2 — Core change (small, surgical)
4. Add `sessionId?: string` to `AgentLoopOptions` in `core/src/types.ts`
5. Use it in `AgentLoop.run()`: `id: this.options.sessionId ?? nanoid()`

### Phase 3 — Server implementation
6. `session.ts` — registry + event buffer
7. `sse.ts` — SSE stream handler
8. `server.ts` — Hono routes
9. `index.ts` — entry point with `ANGYCODE_SERVER_READY` handshake

### Phase 4 — Manual smoke test
10. `npm run build` in workspace root
11. `node packages/server/dist/index.js --port 0`
12. Curl `POST /sessions` with a simple goal against Anthropic
13. Curl `GET /sessions/:id/events` and watch the stream

### Phase 5 — Angy integration (separate task, tracked separately)
14. `ServerProcess.ts` in `src/engine/`
15. `AngyCodeProcessManager.ts` in `src/engine/`
16. Provider selector in Angy UI settings

---

## 14. Open questions

| Question | Decision |
|---|---|
| Where does `angycode-server` binary live in the Angy bundle? | Tauri sidecar config — needs a separate Tauri sidecar entry in `tauri.conf.json`. During dev, resolve via PATH. |
| Should the server persist across Angy restarts? | No — Angy owns the process lifetime. Kill on app quit (SIGTERM). |
| What if the port is already taken? | `--port 0` lets the OS assign. Always use that in production. `7341` is the dev default only. |
| Should session registry survive a server restart? | No for now. Sessions are in SQLite; the in-memory registry is transient. Resume from SQLite is a future feature. |
| Rate limiting / backpressure on SSE? | Not needed — single client (Angy), localhost, low volume. |
