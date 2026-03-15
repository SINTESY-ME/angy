# AngyCode — Design Plan

A standalone, provider-agnostic agentic runtime that works like Claude Code CLI, but is fully
owned by us. Built in TypeScript, designed to run as a CLI first, then wire into Angy and expose
as an HTTP/SSE server.

---

## 1. Vision and Scope

### Why we build this

- **Provider freedom**: Anthropic and Gemini today, others tomorrow. No vendor lock-in.
- **No subprocess dependency**: Angy currently shells out to the `claude` CLI. That means one
  Claude Code subscription per concurrent agent, usage limits, and no control over the loop.
- **Server-ready**: A self-contained runtime that runs headless can move to a VM later with
  minimal changes.
- **Angy integration**: `AngyCodeProcess` becomes a drop-in replacement for `ClaudeProcess`.
  Same event protocol, same session concept, no UI changes needed initially.

### What it is NOT (yet)

- A full IDE (that's Angy's job)
- A multi-user SaaS
- A replacement for Angy's orchestration layer (Scheduler, OrchestratorPool stay in Angy)

---

## 2. Package Layout

AngyCode lives as a sibling directory or a monorepo workspace alongside Angy.

```
angycode/
├── packages/
│   ├── core/           # Provider-agnostic agent runtime — the brain
│   │   ├── src/
│   │   │   ├── agent/          # AgentLoop, AgentSession, context manager
│   │   │   ├── providers/      # Anthropic and Gemini adapters
│   │   │   ├── tools/          # Built-in tool implementations + registry
│   │   │   ├── db/             # SQLite persistence (better-sqlite3)
│   │   │   ├── events.ts       # Typed event bus (mitt)
│   │   │   └── types.ts        # All shared types
│   │   └── package.json
│   ├── cli/            # CLI entry point (thin wrapper over core)
│   │   ├── src/
│   │   │   ├── index.ts        # Entry: parse args → create AgentLoop → run
│   │   │   ├── formatter.ts    # Pretty-print streaming events to terminal
│   │   │   └── commands/       # run, resume, sessions, config, cost
│   │   └── package.json
│   └── server/         # HTTP/SSE server (future — thin wrapper over core)
│       ├── src/
│       │   ├── index.ts        # Hono server setup
│       │   └── sse.ts          # SSE stream per session
│       └── package.json
├── package.json        # Workspace root
└── tsconfig.json
```

**Tech stack:**
- Runtime: Node.js 22+ (or Bun — both work, Node is safer for subprocess/PTY)
- TypeScript: strict mode
- SQLite: `better-sqlite3` (synchronous, fast, no async complexity)
- CLI args: `commander` or `yargs`
- HTTP server: `hono` (tiny, fast, first-class SSE support)
- Anthropic SDK: `@anthropic-ai/sdk`
- Gemini SDK: `@google/genai` (the new unified SDK)
- Process spawning: Node built-in `child_process.spawn`
- File watching: not needed initially

---

## 3. Core Types

Everything in the system speaks this common language. Defined in `core/src/types.ts`.

```typescript
// ── Provider ──────────────────────────────────────────────────────────────

export type ProviderName = 'anthropic' | 'gemini';

export interface ProviderConfig {
  name: ProviderName;
  apiKey: string;
  model: string;          // e.g. 'claude-opus-4-6', 'gemini-2.0-pro'
  maxTokens?: number;     // default 8192
  temperature?: number;   // default 1
}

// ── Messages (unified conversation format) ────────────────────────────────
// This is our internal format — adapters translate to/from provider formats.

export type MessageRole = 'user' | 'assistant';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error: boolean };

export interface Message {
  role: MessageRole;
  content: ContentPart[];
}

// ── Streaming events emitted by the AgentLoop ─────────────────────────────

export type AgentEvent =
  | { type: 'text';        text: string }
  | { type: 'tool_start';  id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_output'; id: string; name: string; output: string; is_error: boolean; duration_ms: number }
  | { type: 'usage';       input_tokens: number; output_tokens: number; cost_usd?: number }
  | { type: 'done';        stop_reason: 'end_turn' | 'max_tokens' | 'error' }
  | { type: 'error';       message: string };

// ── Tools ─────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;  // JSON Schema Draft-7 object
}

export interface ToolResult {
  content: string;
  is_error: boolean;
}

export interface ToolContext {
  workingDir: string;
  sessionId: string;
  filesRead: Set<string>;    // guards the Edit tool
  emit: (event: AgentEvent) => void;
}

// ── Session ───────────────────────────────────────────────────────────────

export type SessionStatus = 'running' | 'done' | 'error' | 'paused';

export interface Session {
  id: string;
  goal: string;
  provider: ProviderName;
  model: string;
  status: SessionStatus;
  workingDir: string;
  createdAt: number;
  updatedAt: number;
}

// ── JSON Schema (minimal subset we need) ──────────────────────────────────

export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export type JsonSchemaProperty =
  | { type: 'string'; description?: string; enum?: string[] }
  | { type: 'number'; description?: string }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; items: JsonSchemaProperty; description?: string }
  | { type: 'object'; properties: Record<string, JsonSchemaProperty>; description?: string };
```

---

## 4. Provider Adapters

Each provider adapter implements a single interface. The rest of the system never imports
Anthropic or Gemini SDKs directly.

```typescript
// core/src/providers/provider.ts

export interface ProviderAdapter {
  streamMessage(params: StreamParams): AsyncIterable<ProviderStreamEvent>;
}

export interface StreamParams {
  model: string;
  system: string;
  messages: Message[];            // our unified format — adapter translates
  tools: ToolDefinition[];
  maxTokens: number;
}

export type ProviderStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; partial_input: string }    // JSON accumulation
  | { type: 'tool_call_end'; id: string }
  | { type: 'message_end'; stop_reason: string; usage: { input: number; output: number } };
```

### 4.1 Anthropic Adapter

**SDK**: `@anthropic-ai/sdk`

```typescript
// core/src/providers/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamMessage(params: StreamParams): AsyncIterable<ProviderStreamEvent> {
    // Tool definitions: our JsonSchema maps 1:1 to Anthropic's input_schema
    const tools = params.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    // Messages: our ContentPart[] maps almost 1:1 to Anthropic
    // tool_use → { type:'tool_use', id, name, input }
    // tool_result → { type:'tool_result', tool_use_id, content }
    const messages = toAnthropicMessages(params.messages);

    const stream = this.client.messages.stream({
      model: params.model,
      system: params.system,
      max_tokens: params.maxTokens,
      tools,
      messages,
    });

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'tool_use') {
            yield { type: 'tool_call_start', id: event.content_block.id, name: event.content_block.name };
          }
          break;
        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', text: event.delta.text };
          }
          if (event.delta.type === 'input_json_delta') {
            yield { type: 'tool_call_delta', id: /* tracked */ '', partial_input: event.delta.partial_json };
          }
          break;
        case 'message_delta':
          if (event.delta.stop_reason) {
            yield { type: 'message_end', stop_reason: event.delta.stop_reason, usage: { input: 0, output: event.usage.output_tokens } };
          }
          break;
      }
    }

    const final = await stream.finalMessage();
    // emit final usage from final.usage
  }
}
```

**Key points:**
- `stop_reason: 'tool_use'` → we must execute tools and continue
- `stop_reason: 'end_turn'` → agent is done
- Tool `id` comes from `content_block_start.content_block.id` — must be tracked to correlate deltas
- Prompt caching: Anthropic supports `cache_control: { type: 'ephemeral' }` on the system prompt
  and large tool blocks. Worth adding early for cost savings.

### 4.2 Gemini Adapter

**SDK**: `@google/genai` (new unified SDK, not the old `@google/generative-ai`)

```typescript
// core/src/providers/gemini.ts
import { GoogleGenAI } from '@google/genai';

export class GeminiAdapter implements ProviderAdapter {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async *streamMessage(params: StreamParams): AsyncIterable<ProviderStreamEvent> {
    // Tool definitions: Gemini uses functionDeclarations with a slightly different schema
    // Our JsonSchema is close but Gemini uses its own SchemaType enum
    const tools = [{
      functionDeclarations: params.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: toGeminiSchema(t.inputSchema),  // translate type strings to SchemaType
      })),
    }];

    // Gemini history format: Content[] with role 'user' | 'model'
    // tool_use in our format → role:'model', parts:[{functionCall:{name, args}}]
    // tool_result in our format → role:'user', parts:[{functionResponse:{name, response}}]
    // TRICKY: Gemini identifies tool calls by function name, NOT by id.
    // We must generate our own ids for tool_use entries when receiving from Gemini.
    const contents = toGeminiContents(params.messages);

    const stream = this.client.models.generateContentStream({
      model: params.model,
      contents,
      config: {
        systemInstruction: params.system,
        tools,
        maxOutputTokens: params.maxTokens,
      },
    });

    const toolCallsThisRound: Map<string, { name: string; args: Record<string, unknown> }> = new Map();

    for await (const chunk of stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) {
          yield { type: 'text_delta', text: part.text };
        }
        if (part.functionCall) {
          // Gemini delivers complete functionCall in one chunk (no streaming of args)
          const id = generateId();  // we fabricate a stable id
          yield { type: 'tool_call_start', id, name: part.functionCall.name };
          yield { type: 'tool_call_delta', id, partial_input: JSON.stringify(part.functionCall.args ?? {}) };
          yield { type: 'tool_call_end', id };
          toolCallsThisRound.set(id, { name: part.functionCall.name, args: part.functionCall.args ?? {} });
        }
      }
    }

    // Determine stop reason from finishReason
    // Gemini: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'FUNCTION_CALL'
    const finishReason = /* from final chunk */ 'STOP';
    const stop_reason = toolCallsThisRound.size > 0 ? 'tool_use'
      : finishReason === 'MAX_TOKENS' ? 'max_tokens'
      : 'end_turn';

    yield { type: 'message_end', stop_reason, usage: { input: 0, output: 0 } };
  }
}
```

**Tricky Gemini differences:**
| Issue | Gemini | Our solution |
|---|---|---|
| No tool call IDs | Identifies by function name | Generate UUID per call |
| Multiple calls with same name | Ambiguous | Disambiguate by order |
| Args come complete, not streamed | No partial_input deltas | Emit as one chunk |
| Tool responses go as `user` turn | `functionResponse` in parts | toGeminiContents handles it |
| `FUNCTION_CALL` finish reason | Not always set | Infer from presence of functionCalls |
| Schema types | Uses `SchemaType` enum | `toGeminiSchema()` translates |

**`toGeminiContents` — the key translation function:**

Gemini groups consecutive tool results from the same turn into one `user` Content with multiple
`functionResponse` parts. Our format has them as individual `tool_result` parts in one user
message, which translates cleanly.

---

## 5. Tool System

### 5.1 Registry

```typescript
// core/src/tools/registry.ts

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map(t => t.definition);
  }

  async execute(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { content: `Unknown tool: ${name}`, is_error: true };
    try {
      return await tool.execute(input, ctx);
    } catch (err) {
      return { content: `Tool error: ${String(err)}`, is_error: true };
    }
  }
}

export interface Tool {
  definition: ToolDefinition;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
```

### 5.2 Built-in Tools

#### `Bash` — run shell commands

The most critical tool. Must stream output so the user sees progress in real time.

```typescript
definition: {
  name: 'Bash',
  description: 'Run a shell command. Returns stdout, stderr, and exit code.',
  inputSchema: {
    type: 'object',
    properties: {
      command:     { type: 'string', description: 'Shell command to execute' },
      description: { type: 'string', description: 'What this command does (shown to user)' },
      timeout:     { type: 'number', description: 'Timeout in ms (default 120000)' },
    },
    required: ['command', 'description'],
  }
}
```

**Implementation details:**
- Use `child_process.spawn('bash', ['-c', command], { cwd, env })`
- Stream stdout/stderr chunks to `ctx.emit({ type: 'tool_output', ... })` in real time for the UI
- Capture full output to return as tool result
- Truncate at 100 000 chars of stdout, 10 000 of stderr (models don't need more)
- Kill on timeout, return partial output + timeout message
- Wrap output: `<stdout>...</stdout><stderr>...</stderr><exit_code>N</exit_code>`
- `is_error = exit_code !== 0`
- **Do NOT use `exec`** — it buffers all output; `spawn` streams it

#### `Read` — read a file

```typescript
definition: {
  name: 'Read',
  inputSchema: {
    properties: {
      file_path: { type: 'string' },
      offset:    { type: 'number', description: 'Line to start at (1-based)' },
      limit:     { type: 'number', description: 'Max lines to read' },
    },
    required: ['file_path'],
  }
}
```

**Implementation:**
- `fs.readFile(path, 'utf-8')`
- Split into lines, apply offset/limit
- Format as `cat -n`: `     1\t<line>\n     2\t<line>\n ...`
- Side effect: `ctx.filesRead.add(path)` — required before Edit
- On missing file: return descriptive error, `is_error: true`

#### `Write` — write a file

```typescript
definition: {
  name: 'Write',
  inputSchema: {
    properties: {
      file_path: { type: 'string' },
      content:   { type: 'string' },
    },
    required: ['file_path', 'content'],
  }
}
```

**Implementation:**
- For new files: write directly
- For existing files: require `ctx.filesRead.has(path)` (model must have read it first)
- Create parent directories with `fs.mkdir(dir, { recursive: true })`
- Atomic write: write to `file_path + '.angycode.tmp'`, then `fs.rename()` to target
  - Prevents partial writes from corrupting the file

#### `Edit` — precise string replacement (the tricky one)

This is the tool that requires the most care. The model MUST have read the file first.

```typescript
definition: {
  name: 'Edit',
  description: 'Replace an exact string in a file. old_string must be unique or use replace_all.',
  inputSchema: {
    properties: {
      file_path:   { type: 'string' },
      old_string:  { type: 'string', description: 'Exact text to find (must be unique in file)' },
      new_string:  { type: 'string', description: 'Text to replace it with' },
      replace_all: { type: 'boolean', description: 'Replace every occurrence (default false)' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  }
}
```

**Implementation (step by step):**

```typescript
async execute(input, ctx): Promise<ToolResult> {
  const { file_path, old_string, new_string, replace_all = false } = input;

  // 1. Guard: model must have read the file
  if (!ctx.filesRead.has(file_path)) {
    return { content: `Error: must Read ${file_path} before editing it.`, is_error: true };
  }

  // 2. Read current content
  let content: string;
  try {
    content = await fs.readFile(file_path, 'utf-8');
  } catch {
    return { content: `Error: cannot read ${file_path}`, is_error: true };
  }

  // 3. Validate old_string exists and uniqueness
  // Count occurrences (simple indexOf loop — handles overlapping correctly)
  let count = 0, idx = 0;
  while ((idx = content.indexOf(old_string, idx)) !== -1) { count++; idx++; }

  if (count === 0) {
    // Provide a helpful diff hint — show surrounding lines to help model recover
    return { content: `Error: old_string not found in ${file_path}.\nMake sure the string matches exactly (whitespace, newlines).`, is_error: true };
  }
  if (count > 1 && !replace_all) {
    return { content: `Error: old_string found ${count} times. Add more surrounding context to make it unique, or set replace_all=true.`, is_error: true };
  }

  // 4. Apply replacement
  const newContent = replace_all
    ? content.split(old_string).join(new_string)   // replaceAll
    : content.replace(old_string, new_string);

  // 5. Atomic write
  const tmp = file_path + '.angycode.tmp';
  await fs.writeFile(tmp, newContent, 'utf-8');
  await fs.rename(tmp, file_path);

  // 6. Update filesRead with new content fingerprint (optional — already marked as read)
  return { content: `Edited ${file_path} (${count > 1 ? count + ' occurrences' : '1 occurrence'} replaced).`, is_error: false };
}
```

**Why it fails and how to help the model recover:**
- Models sometimes miss leading/trailing whitespace, or use wrong newline style (CRLF vs LF).
- When `old_string not found`, show the first 3 lines around where the model likely intended to
  edit (requires fuzzy search — can be added later). For now, a clear error message is enough.

#### `Glob` — find files by pattern

```typescript
// Uses fast-glob (npm package: fast-glob)
definition: {
  name: 'Glob',
  inputSchema: {
    properties: {
      pattern: { type: 'string', description: 'Glob pattern e.g. "src/**/*.ts"' },
      path:    { type: 'string', description: 'Base directory (default: workingDir)' },
    },
    required: ['pattern'],
  }
}
```

- Return file paths, sorted by modification time (most recently modified first)
- Limit to 500 results to avoid flooding context

#### `Grep` — search file contents

```typescript
definition: {
  name: 'Grep',
  inputSchema: {
    properties: {
      pattern:     { type: 'string', description: 'Regex pattern' },
      path:        { type: 'string' },
      glob:        { type: 'string', description: 'File filter e.g. "*.ts"' },
      output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'] },
      '-C':        { type: 'number', description: 'Context lines around match' },
      '-i':        { type: 'boolean', description: 'Case insensitive' },
      head_limit:  { type: 'number', description: 'Limit output lines' },
    },
    required: ['pattern'],
  }
}
```

- Spawn `rg` (ripgrep) as subprocess — it's fast and handles binary detection
- If `rg` not available, fall back to Node.js regex scan
- Truncate output at 50 000 chars

#### `WebFetch` — fetch a URL

```typescript
definition: {
  name: 'WebFetch',
  inputSchema: {
    properties: {
      url:    { type: 'string' },
      prompt: { type: 'string', description: 'What specifically to extract from the page' },
    },
    required: ['url'],
  }
}
```

- Use Node.js built-in `fetch`
- Strip HTML with a lightweight regex cleaner (remove `<script>`, `<style>`, collapse tags to text)
- Truncate at 50 000 chars
- The `prompt` hint is just passed back in the result header so the model remembers its intent

#### `Think` — explicit reasoning scratchpad

```typescript
definition: {
  name: 'Think',
  description: 'Use this to think step by step before complex actions. The thought is not shown to the user but helps you reason.',
  inputSchema: {
    properties: {
      thought: { type: 'string' },
    },
    required: ['thought'],
  }
}
```

- Simply returns `{ content: thought, is_error: false }` — it's a no-op
- Forces the model to articulate reasoning before acting
- Extremely useful for multi-step tasks: improves accuracy significantly

---

## 6. The Agentic Loop

The heart of AngyCode. Lives in `core/src/agent/AgentLoop.ts`.

```
┌─────────────────────────────────────────────┐
│                 AgentLoop.run()              │
│                                              │
│  messages = [{ role:'user', content:goal }] │
│                                              │
│  loop:                                       │
│    1. provider.streamMessage(messages)       │
│    2. accumulate AssistantMessage            │
│    3. emit text chunks to caller in realtime │
│    4. if stop_reason == 'end_turn'  → DONE  │
│    5. if stop_reason == 'max_tokens'→ DONE  │
│    6. if stop_reason == 'tool_use':          │
│         for each tool_call in message:       │
│           execute tool → ToolResult          │
│           emit tool_start / tool_output      │
│         push ToolResultMessage to messages   │
│         persist to SQLite                    │
│         → back to top of loop               │
└─────────────────────────────────────────────┘
```

**Key design choices:**

- **Turn limit**: Hard cap at 200 turns to prevent runaway agents (configurable)
- **Context window management**: Track estimated token count. When approaching limit (>80%):
  - Option A: Summarize old messages (call provider with summarize prompt, replace with summary)
  - Option B: Fail gracefully with a message. Start with Option B, add A later.
- **Parallel tool calls**: Anthropic can return multiple tool_use blocks in one response.
  Execute them concurrently with `Promise.all`. Gemini also can return multiple functionCalls.
- **Persist after each turn**: Write messages to SQLite after each round-trip. This enables
  resume after crash.
- **Interruption**: Expose `abort()` method. Sets an internal flag checked between turns.
  Current tool execution completes, then the loop exits cleanly.

---

## 7. SQLite Schema

Using `better-sqlite3` (synchronous). File location: `~/.angycode/angycode.db`

```sql
-- Sessions
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,   -- nanoid
  goal        TEXT NOT NULL,
  provider    TEXT NOT NULL,      -- 'anthropic' | 'gemini'
  model       TEXT NOT NULL,
  status      TEXT NOT NULL,      -- 'running' | 'done' | 'error' | 'paused'
  working_dir TEXT NOT NULL,
  system_prompt TEXT,
  turn_count  INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,   -- unix ms
  updated_at  INTEGER NOT NULL
);

-- Messages (the full conversation history, persisted per turn)
CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,      -- 'user' | 'assistant'
  content     TEXT NOT NULL,      -- JSON: ContentPart[]
  turn_index  INTEGER NOT NULL,   -- which loop iteration produced this
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_messages_session ON messages(session_id, turn_index);

-- Tool executions (audit log, separate from messages for easy querying)
CREATE TABLE tool_executions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  tool_name   TEXT NOT NULL,
  input       TEXT NOT NULL,       -- JSON
  output      TEXT NOT NULL,       -- truncated text
  is_error    INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Usage tracking (for cost monitoring)
CREATE TABLE usage (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL,
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL,
  output_tokens  INTEGER NOT NULL,
  cost_usd       REAL,             -- computed from known pricing
  created_at     INTEGER NOT NULL
);
```

**Resume flow:**
1. `angycode resume <session-id>`
2. Load session from DB, verify status is 'paused' or 'error'
3. Load all messages ordered by turn_index
4. Reconstruct `messages[]` array
5. Re-enter AgentLoop from where it stopped

---

## 8. System Prompt Design

The system prompt is critical. It shapes how the agent uses tools.

**Core sections:**

```
You are AngyCode, a powerful autonomous software engineering agent.

## Environment
- Working directory: {workingDir}
- Shell: bash
- OS: {os}
- Date: {date}

## Available Tools
[auto-generated from ToolRegistry.getDefinitions()]

## Core Rules
1. Always Read a file before editing it with Edit or Write.
2. Use Think before complex multi-step operations.
3. Prefer Edit over Write when modifying existing files (safer).
4. After running Bash commands that modify the filesystem, verify with Read or Glob.
5. If you are uncertain about a file's location, use Glob or Grep before assuming.
6. Be concise in text responses — the user sees your output in real time.
7. When a Bash command fails, read the error carefully and fix the root cause.
   Do not retry the same command more than twice without changing something.

## Goal
{goal}
```

**Provider-specific notes:**
- Anthropic: system prompt in the `system` field (not a message)
- Gemini: `systemInstruction` in model config — same effect

---

## 9. CLI Interface

`angycode` binary — entry point in `packages/cli/src/index.ts`

```
Usage: angycode [options] <goal>
       angycode resume <session-id>
       angycode sessions [--limit N]
       angycode cost [--session <id>] [--since YYYY-MM-DD]
       angycode config set <key> <value>

Options:
  -p, --provider <name>     anthropic | gemini  (default: anthropic)
  -m, --model <name>        Model name (default: claude-opus-4-6 / gemini-2.0-pro)
  -d, --dir <path>          Working directory (default: cwd)
  --max-tokens <n>          Max tokens per response (default: 8192)
  --max-turns <n>           Turn limit (default: 200)
  --system <text>           Append to system prompt
  --no-tools <list>         Comma-separated tools to disable
  --json                    Machine-readable JSON output (for Angy integration)
  --verbose                 Show full tool inputs and outputs
  -h, --help
```

**Output format (human mode):**
```
[AngyCode] Starting session abc123 — anthropic / claude-opus-4-6
[AngyCode] Working in: /Users/alice/Work/myproject

I'll start by reading the relevant files...

[Tool: Read] src/main.ts
[Tool: Grep] pattern: "function processOrder"
[Tool: Edit] src/main.ts

The bug was in line 42. I've fixed the off-by-one error in processOrder().

[AngyCode] Done (12 turns, 4 tool calls, ~$0.08)
```

**Output format (JSON mode, for Angy):**
```json
{"type":"session_start","sessionId":"abc123","provider":"anthropic","model":"claude-opus-4-6"}
{"type":"text","text":"I'll start by reading..."}
{"type":"tool_start","id":"t1","name":"Read","input":{"file_path":"src/main.ts"}}
{"type":"tool_output","id":"t1","name":"Read","output":"...","is_error":false,"duration_ms":12}
{"type":"done","stop_reason":"end_turn","turns":12,"cost_usd":0.08}
```

This JSON stream is the protocol Angy uses to replace `ClaudeProcess`.

---

## 10. HTTP/SSE Server (future — `packages/server`)

When ready for remote/team use:

```
POST   /sessions                    Create + start session
GET    /sessions                    List sessions
GET    /sessions/:id                Get session detail
POST   /sessions/:id/abort          Interrupt running session
GET    /sessions/:id/events         SSE stream of AgentEvents
GET    /sessions/:id/messages       Full conversation history
```

**SSE event format** — same `AgentEvent` type, serialized as `data: {...}\n\n`

**Auth:** Simple API key in `Authorization: Bearer <key>` header. The server is not designed for
public internet exposure — it's for a trusted team/VM environment.

---

## 11. Angy Integration Path

### Step 1 — AngyCode as a subprocess (minimal Angy changes)

Replace `ClaudeProcess` with `AngyCodeProcess`:
- Spawn `angycode --json <goal>` as a child process
- Parse the JSON stream (same as current `StreamParser` concept)
- Map `AgentEvent` to Angy's existing session events
- This keeps Angy's UI, Scheduler, OrchestratorPool unchanged

### Step 2 — AngyCode as a library (no subprocess)

Import `@angycode/core` directly in Angy's engine:
- `AngyEngine.spawnEpicOrchestrator()` creates an `AgentLoop` instead of `ClaudeProcess`
- `AgentLoop.on('event', ...)` replaces the subprocess stdout listener
- `HybridPipelineRunner` calls `AgentLoop.run(goal, ...)` directly
- Eliminates process spawn overhead, enables shared SQLite DB (one DB for Angy + AngyCode)

### Step 3 — Provider selection per epic

Add a `provider` field to the Epic type:
```typescript
interface Epic {
  ...
  provider?: 'anthropic' | 'gemini';
  model?: string;
}
```
Scheduler passes this to `OrchestratorPool`, which passes to `AngyCodeProcess`.

---

## 12. Cost Estimation

Per-request cost computation in `core/src/agent/cost.ts`:

```typescript
const PRICING: Record<string, { input: number; output: number }> = {
  // per million tokens
  'claude-opus-4-6':       { input: 15.00,  output: 75.00  },
  'claude-sonnet-4-6':     { input: 3.00,   output: 15.00  },
  'claude-haiku-4-5':      { input: 0.80,   output: 4.00   },
  'gemini-2.0-pro':        { input: 3.50,   output: 10.50  },
  'gemini-2.0-flash':      { input: 0.10,   output: 0.40   },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number | undefined {
  const price = PRICING[model];
  if (!price) return undefined;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
```

---

## 13. Open Questions / Decisions Deferred

| Question | Options | Notes |
|---|---|---|
| Monorepo location | Sibling dir `angycode/` vs workspace in `angy/` | Start sibling, merge later |
| Runtime: Node vs Bun | Node safer for compat; Bun faster | Node for now |
| SQLite library | `better-sqlite3` vs `@sqlite.org/sqlite-wasm` | better-sqlite3, synchronous API is simpler |
| Context summarization | Summarize old turns vs fail gracefully | Fail + clear message first |
| Gemini streaming of tool args | Gemini doesn't stream args, just complete | Deliver as one chunk, noted above |
| Multi-modal (images) | Anthropic and Gemini both support it | Defer — add `image` part type later |
| Config store | JSON file in `~/.angycode/config.json` | Simple, no DB for config |
| Max output size from Bash | Truncate at 100k chars | Might need smarter truncation |

---

## 14. Build Sequence

**Phase 1 — Core + CLI (MVP)**
1. `core/src/types.ts` — all types
2. `core/src/providers/anthropic.ts` — Anthropic adapter + tests
3. `core/src/providers/gemini.ts` — Gemini adapter + tests
4. `core/src/tools/` — Bash, Read, Write, Edit, Glob, Grep, Think
5. `core/src/agent/AgentLoop.ts` — the loop
6. `core/src/db/` — SQLite schema, session/message persistence
7. `packages/cli/` — commander CLI, human + JSON output formatters
8. End-to-end test: `angycode "add a hello world function to src/index.ts"`

**Phase 2 — Angy Integration**
1. `AngyCodeProcess` subprocess wrapper
2. Wire into `HybridPipelineRunner` as alternative to `ClaudeProcess`
3. Provider selection per epic in Angy UI

**Phase 3 — HTTP/SSE Server**
1. `packages/server/` with Hono
2. Session management via REST
3. SSE streaming of AgentEvents
4. Basic API key auth

**Phase 4 — Advanced**
1. Prompt caching (Anthropic)
2. Context window management (summarization)
3. More providers (OpenAI, Mistral)
4. Image/multimodal tool results
5. Web UI (replaces or complements Angy for server mode)
