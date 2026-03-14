/**
 * useEngine — thin composable bridge between ProcessManager and the UI.
 *
 * Delegates all heavy lifting to ProcessManager (engine layer).
 * Re-exports AgentHandle (aliased as ChatPanelHandle for backward compat)
 * and provides module-level functions that match the old API.
 */

import { ProcessManager } from '../engine/ProcessManager';
import { ClaudeProcess } from '../engine/ClaudeProcess';
import type { AgentHandle, ProcessOptions } from '../engine/types';
import { getDatabase } from '../stores/sessions';

// ── Re-export for backward compatibility ─────────────────────────────────

export type { AgentHandle, ProcessOptions };
/** @deprecated Use AgentHandle instead */
export type ChatPanelHandle = AgentHandle;

// ── Singleton ProcessManager ─────────────────────────────────────────────
//
// The AngyEngine owns the canonical ProcessManager instance. This module
// can either share that instance (via setProcessManager) or create a
// standalone one for legacy / non-engine usage.

let _pm: ProcessManager | null = null;

function getProcessManager(): ProcessManager {
  if (!_pm) {
    _pm = new ProcessManager(getDatabase());
  }
  return _pm;
}

/** Inject the ProcessManager instance (called by AngyEngine or App.vue). */
export function setProcessManager(pm: ProcessManager): void {
  _pm = pm;
}

// ── Public API (delegates to ProcessManager) ─────────────────────────────

/**
 * Send a message to Claude for a given session.
 * Creates a new ClaudeProcess, wires all StreamParser events to the handle,
 * and sends the message.
 */
export function sendMessageToEngine(
  sessionId: string,
  text: string,
  chatPanel: AgentHandle,
  options: ProcessOptions = { workingDir: '.' },
): ClaudeProcess {
  return getProcessManager().sendMessage(sessionId, text, chatPanel, options);
}

/**
 * Send a tool result back to Claude for a given session.
 */
export function sendToolResultToEngine(
  sessionId: string,
  toolUseId: string,
  content: string,
  chatPanel: AgentHandle,
  options: {
    workingDir: string;
    mode?: string;
    model?: string;
    resumeSessionId: string;
  },
): ClaudeProcess {
  return getProcessManager().sendToolResult(sessionId, toolUseId, content, chatPanel, options);
}

/**
 * Cancel the running process for a session.
 */
export function cancelProcess(sessionId: string): void {
  getProcessManager().cancelProcess(sessionId);
}

/**
 * Get the active process for a session (if any).
 */
export function getProcess(sessionId: string): ClaudeProcess | undefined {
  return getProcessManager().getProcess(sessionId);
}
