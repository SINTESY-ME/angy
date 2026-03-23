# @angycode/core

Core library for **AngyCode** — an AI coding agent that can read, write, and edit code using LLM-powered tool loops. This package provides the agent loop, LLM provider adapters, built-in tools, and SQLite-backed persistence.

## Installation

```bash
npm install @angycode/core
```

## Quick Start

```typescript
import {
  AgentLoop,
  createProvider,
  createDefaultRegistry,
  DatabaseImpl,
} from '@angycode/core';

// 1. Set up the database (stores sessions, messages, and usage)
const db = new DatabaseImpl();          // defaults to ~/.angycode/angycode.db
// — or provide a custom path:
// const db = new DatabaseImpl('/tmp/my-agent.db');

// 2. Create a provider (Anthropic or Gemini)
const provider = createProvider({
  name: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-6',
});

// 3. Create the tool registry with all built-in tools
const tools = createDefaultRegistry();

// 4. Create and run the agent loop
const agent = new AgentLoop({
  provider,
  tools,
  db,
  workingDir: process.cwd(),
  maxTokens: 16_384,
  maxTurns: 50,
  model: 'claude-sonnet-4-6',
});

// 5. Listen for events
agent.on('event', (event) => {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.text);
      break;
    case 'tool_start':
      console.log(`\n🔧 ${event.name}`);
      break;
    case 'tool_output':
      console.log(event.is_error ? `❌ ${event.output}` : `✅ Done (${event.duration_ms}ms)`);
      break;
    case 'usage':
      console.log(`\n📊 Tokens: ${event.input_tokens} in / ${event.output_tokens} out` +
        (event.cost_usd !== undefined ? ` ($${event.cost_usd.toFixed(4)})` : ''));
      break;
    case 'done':
      console.log(`\n✨ Finished (${event.stop_reason})`);
      break;
    case 'error':
      console.error(`\n💥 ${event.message}`);
      break;
  }
});

// 6. Run!
const session = await agent.run('Add a health-check endpoint to the Express server');

// Clean up
db.close();
```

## Features

### Providers

Connect to different LLM backends through a unified streaming interface.

| Provider | Adapter | Models |
|----------|---------|--------|
| Anthropic | `AnthropicAdapter` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| Gemini | `GeminiAdapter` | `gemini-2.0-pro`, `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` |
| Mock | `MockAdapter` | (for testing) |

```typescript
import { createProvider, AnthropicAdapter, GeminiAdapter } from '@angycode/core';

// Using the factory
const provider = createProvider({
  name: 'gemini',
  apiKey: process.env.GEMINI_API_KEY!,
  model: 'gemini-2.0-flash',
});

// Or construct directly
const anthropic = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const gemini = new GeminiAdapter({ apiKey: process.env.GEMINI_API_KEY! });
```

All providers implement the `ProviderAdapter` interface and return an `AsyncIterable<ProviderStreamEvent>` from `streamMessage()`.

### Built-in Tools

The agent comes with 8 built-in tools for interacting with the file system and web:

| Tool | Description |
|------|-------------|
| **Bash** | Execute shell commands and return output |
| **Read** | Read a file and return its contents with line numbers |
| **Write** | Write content to a file (creates parent directories if needed) |
| **Edit** | Find-and-replace text in a file (single or replace-all mode) |
| **Glob** | Find files matching a glob pattern, sorted by most recently modified |
| **Grep** | Search file contents for a regex pattern |
| **Think** | A no-op tool for the model to record its reasoning |
| **WebFetch** | Fetch a URL and return its content |

```typescript
import { createDefaultRegistry, ToolRegistryImpl, bashTool, readTool } from '@angycode/core';

// Get all built-in tools
const allTools = createDefaultRegistry();

// Or build a custom registry with only the tools you need
const registry = new ToolRegistryImpl();
registry.register(bashTool);
registry.register(readTool);
```

#### Disabling Tools

You can disable specific tools when creating the `AgentLoop` without removing them from the registry:

```typescript
const agent = new AgentLoop({
  // ...
  disabledTools: ['Bash', 'WebFetch'],  // tool names to exclude
});
```

#### Custom Tools

Implement the `Tool` interface to add your own tools:

```typescript
import type { Tool, ToolContext, ToolResult } from '@angycode/core';

const myTool: Tool = {
  definition: {
    name: 'MyTool',
    description: 'Does something custom',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The query to process' },
      },
      required: ['query'],
    },
  },
  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const query = input.query as string;
    return { content: `Result for: ${query}`, is_error: false };
  },
};

const registry = createDefaultRegistry();
registry.register(myTool);
```

The `ToolContext` passed to every tool provides:
- `workingDir` — the agent's working directory
- `sessionId` — the current session ID
- `filesRead` — a `Set<string>` tracking which files have been read (used for the read-before-edit rule)
- `emit(event)` — emit an `AgentEvent` from within tool execution

### AgentLoop

The `AgentLoop` is the main orchestrator. It streams messages from the LLM, executes tool calls, and persists everything to the database.

#### `run(goal, images?)`

Start a new session with an initial goal:

```typescript
const session = await agent.run('Refactor the auth module to use JWT');
```

You can optionally pass images (base64-encoded):

```typescript
const session = await agent.run('What does this diagram show?', [
  { data: base64String, mimeType: 'image/png' },
]);
```

#### `continueSession(sessionId, message, images?)`

Send a follow-up message within an existing session:

```typescript
const session = await agent.continueSession(
  session.id,
  'Also add unit tests for the new JWT validation',
);
```

#### `resume(sessionId)`

Resume a paused or interrupted session (replays existing messages):

```typescript
const session = await agent.resume('abc123');
```

#### `abort()`

Stop the agent loop mid-execution. The session will be set to `'paused'` and can be resumed later.

```typescript
agent.abort();
```

### Events

Subscribe to real-time events with `agent.on('event', callback)`. The `AgentEvent` union type includes:

| Event | Fields | Description |
|-------|--------|-------------|
| `session_start` | `sessionId`, `provider`, `model`, `workingDir` | Emitted when a session begins |
| `text` | `text` | Streamed text delta from the LLM |
| `tool_start` | `id`, `name`, `input` | A tool is about to execute |
| `tool_output` | `id`, `name`, `output`, `is_error`, `duration_ms` | A tool has finished executing |
| `usage` | `input_tokens`, `output_tokens`, `cost_usd` | Token usage for an LLM turn |
| `done` | `stop_reason` | Session ended (`end_turn`, `max_tokens`, `max_turns`, `error`, `aborted`) |
| `error` | `message` | An error occurred |

### Database

All sessions, messages, tool executions, and token usage are persisted in a local SQLite database.

```typescript
import { DatabaseImpl, createSessionStore, createMessageStore, createUsageStore } from '@angycode/core';

const db = new DatabaseImpl();               // ~/.angycode/angycode.db
const db2 = new DatabaseImpl('/tmp/test.db'); // custom path

// Access stores directly if you need to query data
const sessions = createSessionStore(db.db);
const messages = createMessageStore(db.db);
const usage = createUsageStore(db.db);

// Query session history
const session = sessions.getSession('abc123');
const msgs = messages.getMessages('abc123');

// Don't forget to close when done
db.close();
```

The database automatically creates these tables on first use:
- **`sessions`** — session metadata (goal, provider, model, status, working directory)
- **`messages`** — conversation history (role + content parts as JSON)
- **`tool_executions`** — tool call logs with input, output, duration, and error status
- **`usage`** — per-turn token counts and estimated cost

### Cost Estimation

Built-in cost estimation for supported models:

```typescript
import { estimateCost } from '@angycode/core';

const cost = estimateCost('claude-sonnet-4-6', 1000, 500);
// Returns cost in USD, or undefined for unknown models
```

### System Prompt

The system prompt is built automatically from the working directory, available tools, and optional extra instructions:

```typescript
import { buildSystemPrompt } from '@angycode/core';

const prompt = buildSystemPrompt({
  workingDir: '/home/user/project',
  tools: registry.list(),
  extra: 'Always write tests for new functions.',
});
```

You can pass `systemPromptExtra` to `AgentLoopOptions` to append custom instructions:

```typescript
const agent = new AgentLoop({
  // ...
  systemPromptExtra: 'Use TypeScript strict mode. Prefer functional patterns.',
});
```

## AgentLoopOptions Reference

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `provider` | `ProviderAdapter` | ✅ | The LLM provider to use |
| `tools` | `ToolRegistry` | ✅ | Tool registry (use `createDefaultRegistry()`) |
| `db` | `Database` | ✅ | Database for persistence |
| `workingDir` | `string` | ✅ | Working directory for tool operations |
| `maxTokens` | `number` | ✅ | Max tokens per LLM response |
| `maxTurns` | `number` | ✅ | Max agent loop turns before auto-pause |
| `providerName` | `ProviderName` | | Provider identifier (`'anthropic'`, `'gemini'`, `'mock'`) |
| `model` | `string` | | Model identifier (defaults to `claude-opus-4-6`) |
| `systemPromptExtra` | `string` | | Extra text appended to the system prompt |
| `disabledTools` | `string[]` | | Tool names to exclude from the session |
| `sessionId` | `string` | | Custom session ID (auto-generated if omitted) |

## License

Apache 2.0 — see [LICENSE.md](./LICENSE.md)
