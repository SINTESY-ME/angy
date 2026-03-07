/**
 * SessionService — unified session lifecycle management.
 *
 * Wraps SessionManager (in-memory) and Database (persistence) into a single
 * service. Ensures sessions are always persisted immediately on creation
 * (no more FK constraint failures). Provides a clean API for session CRUD,
 * messages, checkpoints, and delegation management.
 *
 * UI-independent: no Vue, no Pinia, no component refs.
 */

import { SessionManager } from './SessionManager';
import { Database } from './Database';
import { DelegationStatus, type SessionInfo, type MessageRecord, type CheckpointRecord } from './types';
import { engineBus } from './EventBus';

export class SessionService {
  readonly manager: SessionManager;
  readonly db: Database;

  constructor(db: Database, manager?: SessionManager) {
    this.db = db;
    this.manager = manager ?? new SessionManager();
  }

  // ── Session lifecycle ──────────────────────────────────────────────────

  /** Create a new session. Persisted to DB immediately. */
  async createSession(workspace: string, mode = 'agent'): Promise<string> {
    const sessionId = this.manager.createSession(workspace, mode);
    await this.persistSession(sessionId);
    return sessionId;
  }

  /** Create a child session with delegation metadata. Persisted to DB immediately. */
  async createChildSession(
    parentId: string,
    workspace: string,
    mode: string,
    task: string,
  ): Promise<string> {
    const childId = this.manager.createChildSession(parentId, workspace, mode, task);
    await this.persistSession(childId);
    engineBus.emit('session:created', { sessionId: childId, parentSessionId: parentId });
    return childId;
  }

  /** Register an externally-created session (e.g., loaded from DB). */
  registerSession(info: SessionInfo): void {
    if (!this.manager.hasSession(info.sessionId)) {
      this.manager.registerSession(info.sessionId, info);
    }
    engineBus.emit('session:created', { sessionId: info.sessionId, parentSessionId: info.parentSessionId });
  }

  // ── Session queries ───────────────────────────────────────────────────

  getSession(sessionId: string): SessionInfo | undefined {
    return this.manager.sessionInfo(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.manager.hasSession(sessionId);
  }

  listSessions(): SessionInfo[] {
    return this.manager.allSessions();
  }

  childSessions(parentId: string): SessionInfo[] {
    return this.manager.childSessions(parentId);
  }

  // ── Session updates ───────────────────────────────────────────────────

  /** Update a temp session ID to the real Claude CLI ID. Persists atomically. */
  async updateSessionId(oldId: string, newId: string): Promise<void> {
    this.manager.updateSessionId(oldId, newId);
    await this.db.updateMessageSessionId(oldId, newId);
    engineBus.emit('session:idChanged', { oldId, newId });
  }

  setTitle(sessionId: string, title: string): void {
    this.manager.setSessionTitle(sessionId, title);
    this.persistSession(sessionId);
  }

  setFavorite(sessionId: string, favorite: boolean): void {
    this.manager.setSessionFavorite(sessionId, favorite);
    this.persistSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.manager.removeSession(sessionId);
    await this.db.deleteSession(sessionId);
  }

  // ── Delegation ────────────────────────────────────────────────────────

  setDelegationStatus(sessionId: string, status: DelegationStatus): void {
    this.manager.setDelegationStatus(sessionId, status);
  }

  setDelegationResult(sessionId: string, result: string): void {
    this.manager.setDelegationResult(sessionId, result);
  }

  // ── Messages ──────────────────────────────────────────────────────────

  async saveMessage(msg: MessageRecord): Promise<void> {
    await this.db.saveMessage(msg);
  }

  async loadMessages(sessionId: string): Promise<MessageRecord[]> {
    return this.db.loadMessages(sessionId);
  }

  async turnCount(sessionId: string): Promise<number> {
    return this.db.turnCountForSession(sessionId);
  }

  async deleteMessagesFromTurn(sessionId: string, fromTurnId: number): Promise<void> {
    await this.db.deleteMessagesFromTurn(sessionId, fromTurnId);
  }

  // ── Checkpoints ───────────────────────────────────────────────────────

  async saveCheckpoint(cp: CheckpointRecord): Promise<void> {
    await this.db.saveCheckpoint(cp);
  }

  async loadCheckpoints(sessionId: string): Promise<CheckpointRecord[]> {
    return this.db.loadCheckpoints(sessionId);
  }

  async checkpointUuid(sessionId: string, turnId: number): Promise<string> {
    return this.db.checkpointUuid(sessionId, turnId);
  }

  async latestCheckpointBefore(sessionId: string, turnId: number): Promise<string> {
    return this.db.latestCheckpointBefore(sessionId, turnId);
  }

  // ── File Changes ──────────────────────────────────────────────────────

  async saveFileChange(
    sessionId: string,
    filePath: string,
    changeType: string,
    linesAdded: number,
    linesRemoved: number,
    turnId: number,
  ): Promise<void> {
    await this.db.saveFileChange(sessionId, filePath, changeType, linesAdded, linesRemoved, turnId);
  }

  async loadFileChanges(sessionId: string) {
    return this.db.loadFileChanges(sessionId);
  }

  // ── Persistence ───────────────────────────────────────────────────────

  /** Persist a single session to the database. */
  async persistSession(sessionId: string): Promise<void> {
    const info = this.manager.sessionInfo(sessionId);
    if (info) {
      await this.db.saveSession(info);
    }
  }

  /** Load all sessions from the database into memory. */
  async loadFromDatabase(workspace?: string): Promise<void> {
    const saved = await this.db.loadSessions();
    for (const info of saved) {
      if (workspace && info.workspace && info.workspace !== workspace) {
        continue;
      }
      if (!this.manager.hasSession(info.sessionId)) {
        this.manager.registerSession(info.sessionId, info);
      }
    }
  }

  /** Clean up stale pending sessions from the database. */
  async deleteStalePendingSessions(): Promise<void> {
    await this.db.deleteStalePendingSessions();
  }

  /** Get distinct workspaces from the database. */
  async getDistinctWorkspaces(): Promise<string[]> {
    return this.db.getDistinctWorkspaces();
  }
}
