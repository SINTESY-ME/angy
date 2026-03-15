import type { Database } from './Database';

interface SessionState {
  currentAssistantDbId?: number;
  currentAssistantText: string;
  isDirty: boolean;
  debounceTimer?: ReturnType<typeof setTimeout>;
  turnCounter: number;
  /** True while an INSERT is in flight (before currentAssistantDbId is set). */
  insertInFlight: boolean;
  /** Resolves when the in-flight INSERT completes. Null when no INSERT is pending. */
  insertPromise: Promise<void> | null;
  /** Tracks whether any message was actually inserted this turn. */
  hadActivity: boolean;
  /** Epoch counter — incremented on clear() to detect stale async callbacks. */
  epoch: number;
}

export class SessionMessageBuffer {
  private db: Database;
  private sessions = new Map<string, SessionState>();

  constructor(db: Database) {
    this.db = db;
  }

  private getState(sessionId: string): SessionState {
    let state = this.sessions.get(sessionId);
    if (!state) {
      state = {
        currentAssistantText: '',
        isDirty: false,
        turnCounter: 1,
        insertInFlight: false,
        insertPromise: null,
        hadActivity: false,
        epoch: 0,
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  appendAssistantDelta(sessionId: string, text: string): void {
    const state = this.getState(sessionId);
    state.currentAssistantText += text;

    if (state.currentAssistantDbId === undefined) {
      // Guard against duplicate INSERTs while one is in flight
      if (state.insertInFlight) {
        // INSERT already pending — just buffer the text, don't fire another INSERT
        return;
      }

      // First delta — INSERT immediately, capture the row id
      state.insertInFlight = true;
      state.hadActivity = true;
      const capturedEpoch = state.epoch;
      const promise = this.db
        .upsertMessage({
          sessionId,
          role: 'assistant',
          content: state.currentAssistantText,
          turnId: state.turnCounter,
          timestamp: Math.floor(Date.now() / 1000),
        })
        .then((id) => {
          // Discard result if buffer was cleared since this INSERT started
          if (state.epoch !== capturedEpoch) return;
          state.currentAssistantDbId = id;
          state.insertInFlight = false;
          // If more text accumulated while the INSERT was in flight, mark dirty
          // so the next debounce tick (or flush) will UPDATE with the full content
          if (state.currentAssistantText.length > 0) {
            state.isDirty = true;
          }
        })
        .catch((err) => {
          if (state.epoch !== capturedEpoch) return;
          state.insertInFlight = false;
          console.error('[SessionMessageBuffer] Failed to insert assistant message:', err);
        });
      state.insertPromise = promise;
      state.isDirty = false;
    } else {
      // Subsequent deltas — debounce UPDATE
      state.isDirty = true;
      if (state.debounceTimer !== undefined) {
        clearTimeout(state.debounceTimer);
      }
      const capturedEpoch = state.epoch;
      state.debounceTimer = setTimeout(() => {
        state.debounceTimer = undefined;
        if (state.epoch !== capturedEpoch) return;
        if (state.isDirty && state.currentAssistantDbId !== undefined) {
          state.isDirty = false;
          this.db
            .upsertMessage({
              id: state.currentAssistantDbId,
              sessionId,
              role: 'assistant',
              content: state.currentAssistantText,
              turnId: state.turnCounter,
              timestamp: Math.floor(Date.now() / 1000),
            })
            .catch((err) => {
              console.error('[SessionMessageBuffer] Failed to update assistant message:', err);
            });
        }
      }, 500);
    }
  }

  addToolMessage(
    sessionId: string,
    msg: {
      toolName: string;
      summary: string;
      toolInput?: string;
      toolId?: string;
      timestamp: number;
    },
  ): void {
    const state = this.getState(sessionId);

    // Flush pending assistant text first to preserve DB ordering
    if (state.debounceTimer !== undefined) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = undefined;
    }

    // Issue 2 fix: perform synchronous state resets immediately, before any
    // early return, so that appendAssistantDelta calls arriving between now
    // and the deferred .then() start a fresh assistant message.
    const pendingAssistantDbId = state.currentAssistantDbId;
    const pendingAssistantText = state.currentAssistantText;
    const pendingIsDirty = state.isDirty;
    const pendingInsertPromise = state.insertPromise;
    const pendingTurnCounter = state.turnCounter;

    // Reset assistant state immediately for the next turn
    state.turnCounter++;
    state.currentAssistantDbId = undefined;
    state.currentAssistantText = '';
    state.isDirty = false;
    state.insertInFlight = false;
    state.insertPromise = null;
    state.hadActivity = true;

    const newTurnId = state.turnCounter;

    // If an INSERT is still in flight, chain the tool message after it resolves
    if (pendingAssistantDbId === undefined && pendingInsertPromise) {
      pendingInsertPromise.then(() => {
        // Flush the captured assistant text (the INSERT completed, so the row exists)
        this._flushCapturedAssistant(pendingAssistantDbId, pendingAssistantText, pendingIsDirty, pendingTurnCounter, sessionId);
        this._insertToolMessageDb(sessionId, msg, newTurnId);
      });
      return;
    }

    this._flushCapturedAssistant(pendingAssistantDbId, pendingAssistantText, pendingIsDirty, pendingTurnCounter, sessionId);
    this._insertToolMessageDb(sessionId, msg, newTurnId);
  }

  /** Flush dirty assistant text using captured (pre-reset) state values. */
  private _flushCapturedAssistant(
    dbId: number | undefined,
    text: string,
    isDirty: boolean,
    turnId: number,
    sessionId: string,
  ): void {
    if (isDirty && dbId !== undefined) {
      this.db
        .upsertMessage({
          id: dbId,
          sessionId,
          role: 'assistant',
          content: text,
          turnId,
          timestamp: Math.floor(Date.now() / 1000),
        })
        .catch((err) => {
          console.error('[SessionMessageBuffer] Failed to flush assistant before tool:', err);
        });
    }
  }

  /** INSERT a tool message into the DB. */
  private _insertToolMessageDb(
    sessionId: string,
    msg: { toolName: string; summary: string; toolInput?: string; toolId?: string; timestamp: number },
    turnId: number,
  ): void {
    this.db
      .upsertMessage({
        sessionId,
        role: 'tool',
        content: msg.summary,
        toolName: msg.toolName,
        toolInput: msg.toolInput,
        toolId: msg.toolId,
        turnId,
        timestamp: msg.timestamp,
      })
      .catch((err) => {
        console.error('[SessionMessageBuffer] Failed to insert tool message:', err);
      });
  }

  async flush(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    if (state.debounceTimer !== undefined) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = undefined;
    }

    // If an INSERT is in flight, await it before proceeding
    if (state.currentAssistantDbId === undefined && state.insertPromise) {
      await state.insertPromise;
    }

    if (state.isDirty && state.currentAssistantDbId !== undefined) {
      state.isDirty = false;
      await this.db.upsertMessage({
        id: state.currentAssistantDbId,
        sessionId,
        role: 'assistant',
        content: state.currentAssistantText,
        turnId: state.turnCounter,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  }

  clear(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    if (state.debounceTimer !== undefined) {
      clearTimeout(state.debounceTimer);
    }

    // Increment epoch so any in-flight INSERT .then() callbacks discard their results
    state.epoch++;

    // Only increment turnCounter if messages were actually inserted
    if (state.hadActivity) {
      state.turnCounter++;
    }
    state.currentAssistantDbId = undefined;
    state.currentAssistantText = '';
    state.isDirty = false;
    state.debounceTimer = undefined;
    state.insertInFlight = false;
    state.insertPromise = null;
    state.hadActivity = false;
  }
}
