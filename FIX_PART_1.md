# FIX_PART_1: Angy Bug Fixes and Improvements

## Overview

This document details 8 issues discovered in the Angy codebase, their root causes, and proposed solutions.

---

## Issue 1: Orchestrator Internal Calls Not Shown in Chat UI

### Problem
When using an orchestrator, internal agent/claude code calls (like `extractTodos`, `extractVerdict`, `verifyTodo`) are only shown in the status bar, not in the chat UI. Users cannot see what's happening.

### Root Cause Analysis

**Internal calls flow:**
1. Emitted via `engineBus.emit('pipeline:internalCall', { epicId, callType, status })` in `HybridPipelineRunner.ts:1359`
2. Listened in `App.vue` via `onPipelineInternalCall` handler
3. Maps to human-readable labels via `CALL_LABELS` object
4. Updates **status bar only** via `ui.setEpicActivity(epicId, label)`
5. **No database persistence, no chat UI message entries**

**Subagents flow (builder, scaffold, counterpart):**
1. Emitted via `engineBus.emit('agent:toolUse', ...)` in `HeadlessHandle.ts`
2. Persisted to database via `SessionMessageBuffer.addToolMessage()` (`SessionMessageBuffer.ts:114-196`)
3. Displayed in `OrchestratorChat.vue` via `TreeBranch` component (lines 143-149)
4. Full interactive timeline with details

### Key Files
- `src/engine/HybridPipelineRunner.ts` - emits `pipeline:internalCall`
- `src/App.vue` - handles event, updates only status bar
- `src/components/agents/OrchestratorChat.vue` - renders subagent messages
- `src/engine/SessionMessageBuffer.ts` - persists tool messages

### Solution

**Option A: Create pseudo-tool messages for internal calls**
```typescript
// In HybridPipelineRunner.ts, after emitting pipeline:internalCall
// Also emit a tool-like event that gets persisted:
engineBus.emit('agent:toolUse', {
  sessionId: this.rootSessionId,
  toolName: `Internal:${callType}`, // e.g., "Internal:extractTodos"
  summary: CALL_LABELS[callType] || callType,
  toolInput: { type: 'internal_call', callType, status },
});
```

**Option B: Add dedicated internal call rendering to OrchestratorChat**
1. Create new event type `orchestrator:internalCall`
2. Store internal calls in a separate array in session state
3. Render them inline in the chat timeline with a distinct visual style

**Recommended: Option A** - Leverages existing infrastructure with minimal changes.

---

## Issue 2: Epics from Kanban Don't Work with Gemini/Anthropic (AgentLoop)

### Problem
Epics started from the kanban panel don't work when using Gemini or Anthropic providers, which use `AgentLoop` instead of `ClaudeProcess`.

### Root Cause Analysis

The epic orchestration system (`HybridPipelineRunner`, `Orchestrator`) was designed primarily for `ClaudeProcess` (Claude Code subprocess). When using `AgentLoop` for Gemini/Anthropic:

1. **Missing epic context**: `AgentLoop` doesn't receive epic-specific configuration
2. **Different tool handling**: `AgentLoop` uses different tool registration than Claude Code
3. **No spawn_orchestrator support**: The `spawn_orchestrator` tool is specific to Claude Code subprocess

### Key Files
- `src/engine/AngyEngine.ts` - Engine wiring
- `src/engine/Orchestrator.ts` - Main orchestrator
- `code/packages/core/src/agent/AgentLoop.ts` - AgentLoop implementation
- `src/composables/useOrchestrator.ts` - Vue composable

### Solution

1. **Add epic context to AgentLoop sessions:**
```typescript
// In AgentLoop.run() or session creation
if (epicId) {
  session.epicId = epicId;
  session.epicContext = { /* epic details */ };
}
```

2. **Implement orchestrator tools for AgentLoop:**
```typescript
// Register spawn_orchestrator-like tool for AgentLoop
const orchestratorTool = {
  name: 'delegate_task',
  description: 'Delegate a subtask to a specialist agent',
  // ... implementation that creates child AgentLoop sessions
};
```

3. **Unified epic flow:**
   - Create an adapter layer that abstracts ClaudeProcess vs AgentLoop
   - Epic orchestration should work through this adapter

---

## Issue 3: Angycode Bugs (AgentLoop)

### 3a. Stop Signal Doesn't Effectively Stop the Agent

#### Root Cause
- `AgentLoop.abort()` (`AgentLoop.ts:58-60`) only sets `this.aborted = true`
- Abort is checked **only at the start of each turn** (line 199), AFTER tool execution completes
- During streaming from provider (lines 222-247), there is **NO abort check**
- **No AbortSignal/AbortController** passed to provider's `streamMessage()` method
- The `for await (const event of stream)` loop continues until provider finishes

#### Solution
```typescript
// 1. Add AbortController to AgentLoop
private abortController: AbortController | null = null;

abort() {
  this.aborted = true;
  this.abortController?.abort();
}

// 2. Pass signal to providers
async _loop() {
  this.abortController = new AbortController();
  const stream = await this.provider.streamMessage(messages, {
    signal: this.abortController.signal,
    // ...
  });

  // 3. Check abort during streaming
  for await (const event of stream) {
    if (this.aborted) break; // Early exit
    // ... process event
  }
}
```

Also update providers (`anthropic.ts`, `gemini.ts`) to respect the abort signal.

### 3b. Context/Session Lost After Stopping

#### Root Cause
- Messages ARE persisted to database via `sessionStore` and `messageStore`
- **SSE connection management issue**: When abort happens, client disconnects (`sse.ts:37-40`)
- In-memory session state lost after server restart (`session.ts:50-55` uses `Map`)
- No endpoint to query session status after SSE reconnection
- `resume()` and `continueSession()` exist but reconnection flow is unclear

#### Solution
1. **Persist session status to database:**
```typescript
// In session.ts - persist status changes
await db.execute('UPDATE sessions SET status = ? WHERE id = ?', [status, sessionId]);
```

2. **Add session status endpoint:**
```typescript
app.get('/sessions/:id/status', async (req, res) => {
  const session = await getSessionFromDb(req.params.id);
  res.json({ status: session?.status || 'unknown' });
});
```

3. **Auto-reconnect logic in client:**
```typescript
// When SSE disconnects, poll status and reconnect
onSseDisconnect(sessionId) {
  const status = await fetchSessionStatus(sessionId);
  if (status === 'paused') {
    showResumePrompt();
  }
}
```

### 3c. Cannot Read Attached Images (Gemini)

#### Root Cause
Image handling code exists in both adapters:

**Anthropic (`anthropic.ts:31-39`):**
```typescript
case 'image':
  return {
    type: 'image',
    source: { type: 'base64', media_type: part.mimeType, data: part.data }
  };
```

**Gemini (`gemini.ts:86-92`):**
```typescript
case 'image':
  return {
    inlineData: { mimeType: part.mimeType, data: part.data }
  };
```

**Likely issues:**
1. Images not properly base64-encoded by caller
2. Gemini strict MIME type validation (`image/jpeg`, `image/png`, `image/gif`, `image/webp` only)
3. No error handling if image format is invalid
4. `img.mediaType` vs `img.mimeType` inconsistency in `AgentsView.vue:347-349`

#### Solution
1. **Validate and normalize image data before sending:**
```typescript
function normalizeImage(img: AttachedImage): { data: string; mimeType: string } {
  // Ensure proper base64 encoding
  let data = img.data;
  if (data.includes(',')) {
    data = data.split(',')[1]; // Strip data URL prefix
  }

  // Validate MIME type
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const mimeType = validTypes.includes(img.mimeType) ? img.mimeType : 'image/png';

  return { data, mimeType };
}
```

2. **Add error handling in Gemini provider:**
```typescript
try {
  // ... image processing
} catch (e) {
  console.error('Image processing failed:', e);
  // Fall back to text-only or notify user
}
```

### 3d. Output Token Limits Too Low / Files Too Big

#### Root Cause
- Default `maxTokens: 8192` in `server.ts:50`
- When `stop_reason === 'max_tokens'`, session just ends with no warning
- File content is in tool input (not limited by max_tokens), but LLM explanations get truncated
- No per-model adaptation of limits

#### Solution
1. **Model-specific defaults:**
```typescript
const MODEL_MAX_TOKENS = {
  'claude-3-opus': 4096,
  'claude-sonnet-4-5': 8192,
  'gemini-2.0-flash': 16384,
  'gemini-2.5-pro': 32768,
};

const maxTokens = body.maxTokens ?? MODEL_MAX_TOKENS[model] ?? 8192;
```

2. **Detect and warn on truncation:**
```typescript
if (event.stop_reason === 'max_tokens') {
  this.emit({
    type: 'warning',
    message: 'Response was truncated due to token limit. Consider increasing maxTokens.'
  });
}
```

3. **UI configuration:**
- Add maxTokens slider in settings
- Show current/max token usage in status

---

## Issue 4: UI Shows Wrong Chat After Project Switch

### Problem
When switching projects and going to Agent Fleet, the last chat used in the old project is shown.

### Root Cause
`fleetStore.selectedAgentId` persists across project switches. The selected agent may belong to a different project than the currently active one.

### Key Files
- `src/stores/fleet.ts` - `selectedAgentId` state
- `src/components/agents/FleetSidebar.vue` - project filtering
- `src/components/agents/AgentsView.vue` - renders selected agent

### Solution
```typescript
// In useFilterStore or useProjectsStore, when project selection changes:
watch(selectedProjectIds, (newIds, oldIds) => {
  if (JSON.stringify(newIds) !== JSON.stringify(oldIds)) {
    const fleetStore = useFleetStore();
    const currentAgent = fleetStore.selectedAgentId;

    // Check if current agent belongs to new project selection
    if (currentAgent && !agentBelongsToProjects(currentAgent, newIds)) {
      fleetStore.selectedAgentId = null; // Clear selection
      // Or select first agent from new project
    }
  }
});
```

---

## Issue 5: UI Doesn't Scroll to End When Opening Old Chat

### Problem
When opening an "old" chat, the UI doesn't scroll to the end, forcing manual scrolling.

### Root Cause
In `OrchestratorChat.vue:656-663`:
```typescript
watch(totalMessageCount, () => {
  nextTick(() => {
    scrollEl.value?.scrollTo({
      top: scrollEl.value.scrollHeight,
      behavior: 'smooth',
    });
  });
});
```

This only scrolls when `totalMessageCount` **changes**. When loading an existing chat, the count is set once (no change), so no scroll occurs.

### Solution
Add scroll on initial load and sessionId change:
```typescript
// Scroll to bottom on session change (loading a chat)
watch(() => props.sessionId, async () => {
  await nextTick();
  await nextTick(); // Double nextTick for DOM to fully render
  scrollEl.value?.scrollTo({
    top: scrollEl.value.scrollHeight,
    behavior: 'instant', // Use 'instant' for initial load
  });
}, { immediate: true });

// Keep existing watch for new messages (with smooth scroll)
watch(totalMessageCount, () => {
  nextTick(() => {
    scrollEl.value?.scrollTo({
      top: scrollEl.value.scrollHeight,
      behavior: 'smooth',
    });
  });
});
```

---

## Issue 6: Should Not Mix Chat Providers

### Problem
Users should not be able to mix providers within a single chat. Once a chat starts with Claude Code, Anthropic, or Gemini, the model selector should disable other providers.

### Root Cause
No provider locking mechanism exists. The model selector allows any model regardless of chat history.

### Key Files
- `src/stores/sessions.ts` - session data
- Model selector component (needs to be created or located)
- `src/components/agents/AgentsView.vue:344-353` - determines provider from model

### Solution
1. **Store provider on session:**
```typescript
interface SessionInfo {
  // ... existing fields
  provider?: 'claude-code' | 'anthropic' | 'gemini';
}
```

2. **Lock provider on first message:**
```typescript
// In onSend handler
if (messages.length === 0) {
  session.provider = determineProvider(effectiveModel);
  await db.updateSession(sessionId, { provider: session.provider });
}
```

3. **Filter models in selector:**
```typescript
const availableModels = computed(() => {
  const session = sessionsStore.sessions.get(selectedAgentId);
  if (!session?.provider) return ALL_MODELS;

  return ALL_MODELS.filter(m => getProvider(m) === session.provider);
});
```

4. **Visual indicator:**
- Show locked provider badge on chat header
- Disable/gray out incompatible models in selector

---

## Issue 7: Files Edited by Gemini/Anthropic Don't Open in Editor

### Problem
When clicking on files edited by Gemini/Anthropic in the effects panel, nothing shows in the editor. Likely a relative vs absolute path issue.

### Root Cause
In `AgentsEffectsPanel.vue:71`:
```typescript
@click="$emit('file-clicked', change.filePath)"
```

The `filePath` comes from tool input parsing:
```typescript
// AngyCodeProcessManager.ts:193
const filePath = (input.file_path as string) || (input.path as string) || '';
```

**The issue:** Gemini/Anthropic models may return relative paths (e.g., `src/main.ts`) while Claude Code returns absolute paths (e.g., `/Users/alice/project/src/main.ts`).

The editor expects absolute paths:
```typescript
// AgentsView.vue:113
async function onLocalFileClicked(filePath: string) {
  ui.inlinePreviewFile = filePath;
  ui.currentFile = filePath;
  // CodeViewer.loadFile() expects absolute path
}
```

### Solution
Resolve paths to absolute before emitting:
```typescript
// In AngyCodeProcessManager.ts or when extracting effects
function resolveFilePath(filePath: string, workingDir: string): string {
  if (!filePath) return '';
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(workingDir, filePath);
}

// Usage
const absolutePath = resolveFilePath(filePath, session.workingDir);
handle.onFileEdited?.(sessionId, absolutePath, toolName, input);
```

Also in `AgentsEffectsPanel.vue`:
```typescript
// When extracting effects from messages
const filePath = input.file_path || input.path || '';
const absolutePath = filePath.startsWith('/')
  ? filePath
  : `${session.workspace}/${filePath}`;
```

---

## Issue 8: Delete Doesn't Work in Code Editor

### Problem
Delete operation doesn't work in the code editor. Need to verify all basic file/folder operations work.

### Root Cause Analysis
Looking at `TreeNode.vue:325-343`:
```typescript
async function deleteNode() {
  try {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await confirm(...);
    if (!confirmed) return;

    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(props.node.path, { recursive: props.node.isDir });
    // ...
    emit('node-deleted', props.node.path);
  } catch {
    // silently fail <-- THIS IS THE PROBLEM
  }
}
```

**Issues:**
1. Errors are silently swallowed - no way to know why delete failed
2. `@tauri-apps/plugin-dialog` might not be configured properly
3. `@tauri-apps/plugin-fs.remove` permissions might be missing

### Solution

1. **Add error reporting:**
```typescript
async function deleteNode() {
  try {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await confirm(
      `Delete "${props.node.name}"${props.node.isDir ? ' and all its contents' : ''}?`,
      { title: 'Confirm Delete', kind: 'warning' }
    );
    if (!confirmed) return;

    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(props.node.path, { recursive: props.node.isDir });

    editorStore.removeTabByPath(props.node.path);
    if (props.node.isDir) {
      editorStore.removeExpandedDirsUnder(props.node.path);
    }
    emit('node-deleted', props.node.path);
  } catch (error) {
    console.error('Delete failed:', error);
    // Show user-facing error
    const { message } = await import('@tauri-apps/plugin-dialog');
    await message(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      title: 'Delete Error',
      kind: 'error'
    });
  }
}
```

2. **Verify Tauri capabilities in `tauri.conf.json`:**
```json
{
  "plugins": {
    "fs": {
      "scope": ["**"],
      "all": true
    },
    "dialog": {
      "all": true
    }
  }
}
```

3. **Test all operations:**
- [ ] Create file at root
- [ ] Create folder at root
- [ ] Create file in folder
- [ ] Create folder in folder
- [ ] Rename file
- [ ] Rename folder
- [ ] Delete file
- [ ] Delete folder (with contents)
- [ ] Copy path

---

## Implementation Priority

| Issue | Severity | Effort | Priority |
|-------|----------|--------|----------|
| 3a. Stop signal | HIGH | Medium | 1 |
| 7. File paths | HIGH | Low | 2 |
| 8. Delete not working | HIGH | Low | 3 |
| 5. Scroll to end | MEDIUM | Low | 4 |
| 4. Wrong chat on switch | MEDIUM | Low | 5 |
| 6. Provider mixing | MEDIUM | Medium | 6 |
| 3b. Context loss | MEDIUM | Medium | 7 |
| 3c. Image reading | MEDIUM | Medium | 8 |
| 2. Epics with AgentLoop | MEDIUM | High | 9 |
| 1. Internal calls UI | LOW | Medium | 10 |
| 3d. Token limits | LOW | Low | 11 |

---

## Key Files Reference

### Engine
- `src/engine/AngyCodeProcessManager.ts` - AngyCode process management
- `src/engine/ProcessManager.ts` - Claude Code process management
- `src/engine/HybridPipelineRunner.ts` - Epic orchestration
- `src/engine/SessionMessageBuffer.ts` - Message persistence

### Core (AngyCode)
- `code/packages/core/src/agent/AgentLoop.ts` - Main agent loop
- `code/packages/core/src/providers/anthropic.ts` - Anthropic adapter
- `code/packages/core/src/providers/gemini.ts` - Gemini adapter
- `code/packages/server/src/server.ts` - HTTP server
- `code/packages/server/src/session.ts` - Session management
- `code/packages/server/src/sse.ts` - SSE streaming

### UI Components
- `src/components/agents/AgentsView.vue` - Main agent view
- `src/components/agents/OrchestratorChat.vue` - Chat display
- `src/components/agents/AgentsEffectsPanel.vue` - Effects panel
- `src/components/agents/FleetSidebar.vue` - Agent list
- `src/components/sidebar/TreeNode.vue` - File tree node

### Stores
- `src/stores/fleet.ts` - Fleet state
- `src/stores/sessions.ts` - Sessions state
- `src/stores/filter.ts` - Project filtering
