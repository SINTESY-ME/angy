import mitt from 'mitt';
import { DelegationStatus, type SessionInfo } from './types';

// ── SessionManager Events ─────────────────────────────────────────────────

export type SessionManagerEvents = {
  sessionCreated: string;  // sessionId
  sessionUpdated: string;  // sessionId
  sessionDeleted: string;  // sessionId
};

// ── SessionManager ────────────────────────────────────────────────────────

export class SessionManager {
  readonly events = mitt<SessionManagerEvents>();
  private sessions = new Map<string, SessionInfo>();

  createSession(workspace: string, mode = 'agent'): string {
    const tempId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const info: SessionInfo = {
      sessionId: tempId,
      title: `Chat ${this.sessions.size + 1}`,
      workspace,
      mode,
      createdAt: now,
      updatedAt: now,
      favorite: false,
      delegationStatus: DelegationStatus.None,
    };

    this.sessions.set(tempId, info);
    this.events.emit('sessionCreated', tempId);
    return tempId;
  }

  registerSession(sessionId: string, info: SessionInfo): void {
    this.sessions.set(sessionId, info);
    this.events.emit('sessionCreated', sessionId);
  }

  updateSessionId(tempId: string, realId: string): void {
    const info = this.sessions.get(tempId);
    if (!info) return;

    this.sessions.delete(tempId);
    info.sessionId = realId;
    info.updatedAt = Math.floor(Date.now() / 1000);
    this.sessions.set(realId, info);

    // Update parentSessionId references in child sessions
    for (const s of this.sessions.values()) {
      if (s.parentSessionId === tempId) {
        s.parentSessionId = realId;
      }
    }

    this.events.emit('sessionUpdated', realId);
  }

  setSessionTitle(sessionId: string, title: string): void {
    const info = this.sessions.get(sessionId);
    if (info) {
      info.title = title;
      info.updatedAt = Math.floor(Date.now() / 1000);
      this.events.emit('sessionUpdated', sessionId);
    }
  }

  setSessionFavorite(sessionId: string, favorite: boolean): void {
    const info = this.sessions.get(sessionId);
    if (info) {
      info.favorite = favorite;
      this.events.emit('sessionUpdated', sessionId);
    }
  }

  removeSession(sessionId: string): void {
    if (this.sessions.delete(sessionId)) {
      this.events.emit('sessionDeleted', sessionId);
    }
  }

  sessionInfo(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  allSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  // ── Delegation hierarchy ──────────────────────────────────────────────

  createChildSession(
    parentId: string,
    workspace: string,
    mode: string,
    task: string,
  ): string {
    const childId = this.createSession(workspace, mode);
    const info = this.sessions.get(childId);
    if (info) {
      info.parentSessionId = parentId;
      info.delegationTask = task;
      info.delegationStatus = DelegationStatus.Pending;
      info.title = task.length > 30 ? task.substring(0, 30) + '\u2026' : task;
    }
    return childId;
  }

  childSessions(parentId: string): SessionInfo[] {
    const children: SessionInfo[] = [];
    for (const s of this.sessions.values()) {
      if (s.parentSessionId === parentId) {
        children.push(s);
      }
    }
    return children;
  }

  setDelegationStatus(sessionId: string, status: DelegationStatus): void {
    const info = this.sessions.get(sessionId);
    if (info) {
      info.delegationStatus = status;
      info.updatedAt = Math.floor(Date.now() / 1000);
      this.events.emit('sessionUpdated', sessionId);
    }
  }

  setDelegationResult(sessionId: string, result: string): void {
    const info = this.sessions.get(sessionId);
    if (info) {
      info.delegationResult = result;
      this.events.emit('sessionUpdated', sessionId);
    }
  }
}
