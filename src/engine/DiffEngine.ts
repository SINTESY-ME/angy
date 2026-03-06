import mitt from 'mitt';
import type { FileDiff, DiffHunk, DiffLine } from './types';

// ── DiffEngine Events ────────────────────────────────────────────────────

type DiffEvents = {
  'fileChanged': { filePath: string; diff: FileDiff };
  'sessionFileChanged': { sessionId: string; filePath: string };
};

// ── DiffEngine ───────────────────────────────────────────────────────────

export class DiffEngine {
  private events = mitt<DiffEvents>();
  private currentSessionId = '';
  private sessionFiles = new Map<string, string[]>();
  private fileDiffs = new Map<string, FileDiff>();
  private _pendingDiffs: FileDiff[] = [];

  on = this.events.on.bind(this.events);
  off = this.events.off.bind(this.events);

  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  get pendingDiffs(): FileDiff[] {
    return this._pendingDiffs;
  }

  // ── LCS-based diff algorithm ─────────────────────────────────────────

  computeDiff(oldContent: string, newContent: string, _filePath = ''): FileDiff {
    const diff: FileDiff = { hunks: [], linesAdded: 0, linesRemoved: 0 };

    // New file
    if (!oldContent && newContent) {
      const lines = newContent.split('\n');
      const hunk: DiffHunk = {
        oldStart: 0, oldCount: 0,
        newStart: 0, newCount: lines.length,
        lines: lines.map(l => ({ type: 'add' as const, content: l })),
      };
      diff.hunks.push(hunk);
      diff.linesAdded = lines.length;
      return diff;
    }

    // Deleted file
    if (oldContent && !newContent) {
      const lines = oldContent.split('\n');
      const hunk: DiffHunk = {
        oldStart: 0, oldCount: lines.length,
        newStart: 0, newCount: 0,
        lines: lines.map(l => ({ type: 'remove' as const, content: l })),
      };
      diff.hunks.push(hunk);
      diff.linesRemoved = lines.length;
      return diff;
    }

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const m = oldLines.length;
    const n = newLines.length;

    // For very large inputs, use simple line-by-line fallback
    if (m * n > 25_000_000) {
      return this.simpleFallbackDiff(oldLines, newLines);
    }

    // Build DP table for LCS
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find diff lines
    interface RawDiffLine {
      type: 'add' | 'remove';
      lineNum: number;
      text: string;
    }
    const rawLines: RawDiffLine[] = [];

    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        rawLines.unshift({ type: 'add', lineNum: j - 1, text: newLines[j - 1] });
        j--;
      } else if (i > 0) {
        rawLines.unshift({ type: 'remove', lineNum: i - 1, text: oldLines[i - 1] });
        i--;
      }
    }

    // Group consecutive same-type lines into hunks
    let k = 0;
    while (k < rawLines.length) {
      const hunkType = rawLines[k].type;
      const startLine = rawLines[k].lineNum;
      const hunkLines: DiffLine[] = [];
      while (k < rawLines.length && rawLines[k].type === hunkType) {
        hunkLines.push({ type: hunkType, content: rawLines[k].text });
        k++;
      }
      const hunk: DiffHunk = {
        oldStart: hunkType === 'remove' ? startLine : 0,
        oldCount: hunkType === 'remove' ? hunkLines.length : 0,
        newStart: hunkType === 'add' ? startLine : 0,
        newCount: hunkType === 'add' ? hunkLines.length : 0,
        lines: hunkLines,
      };
      diff.hunks.push(hunk);
    }

    // Compute totals
    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add') diff.linesAdded++;
        else if (line.type === 'remove') diff.linesRemoved++;
      }
    }

    return diff;
  }

  // ── Simple fallback for large files ──────────────────────────────────

  private simpleFallbackDiff(oldLines: string[], newLines: string[]): FileDiff {
    const diff: FileDiff = { hunks: [], linesAdded: 0, linesRemoved: 0 };
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;

      if (oldLine !== newLine) {
        if (oldLine !== undefined) {
          diff.hunks.push({
            oldStart: i, oldCount: 1, newStart: 0, newCount: 0,
            lines: [{ type: 'remove', content: oldLine }],
          });
          diff.linesRemoved++;
        }
        if (newLine !== undefined) {
          diff.hunks.push({
            oldStart: 0, oldCount: 0, newStart: i, newCount: 1,
            lines: [{ type: 'add', content: newLine }],
          });
          diff.linesAdded++;
        }
      }
    }

    return diff;
  }

  // ── Record changes from Edit tool ────────────────────────────────────

  recordEditToolChange(
    filePath: string,
    oldString: string,
    newString: string,
    sessionId?: string
  ): void {
    const sid = sessionId || this.currentSessionId;
    const editDiff = this.computeDiff(oldString, newString, filePath);

    // Accumulate diffs per file
    const existing = this.fileDiffs.get(filePath);
    if (existing) {
      existing.hunks.push(...editDiff.hunks);
      existing.linesAdded += editDiff.linesAdded;
      existing.linesRemoved += editDiff.linesRemoved;
    } else {
      this.fileDiffs.set(filePath, editDiff);
    }

    this._pendingDiffs.push(editDiff);
    this.events.emit('fileChanged', {
      filePath,
      diff: this.fileDiffs.get(filePath)!,
    });

    if (sid) {
      const files = this.sessionFiles.get(sid) ?? [];
      if (!files.includes(filePath)) {
        files.push(filePath);
        this.sessionFiles.set(sid, files);
      }
      this.events.emit('sessionFileChanged', { sessionId: sid, filePath });
    }
  }

  // ── Record changes from Write tool ───────────────────────────────────

  recordWriteToolChange(
    filePath: string,
    newContent: string,
    sessionId?: string
  ): void {
    const sid = sessionId || this.currentSessionId;

    const lines = newContent.split('\n');
    const diff: FileDiff = {
      hunks: [{
        oldStart: 0, oldCount: 0,
        newStart: 0, newCount: lines.length,
        lines: lines.map(l => ({ type: 'add' as const, content: l })),
      }],
      linesAdded: lines.length,
      linesRemoved: 0,
    };

    this.fileDiffs.set(filePath, diff);
    this._pendingDiffs.push(diff);
    this.events.emit('fileChanged', { filePath, diff });

    if (sid) {
      const files = this.sessionFiles.get(sid) ?? [];
      if (!files.includes(filePath)) {
        files.push(filePath);
        this.sessionFiles.set(sid, files);
      }
      this.events.emit('sessionFileChanged', { sessionId: sid, filePath });
    }
  }

  // ── Query methods ────────────────────────────────────────────────────

  hasFile(filePath: string): boolean {
    return this.fileDiffs.has(filePath);
  }

  changedFilesForSession(sessionId: string): string[] {
    return this.sessionFiles.get(sessionId) ?? [];
  }

  linesAddedForFile(filePath: string): number {
    const diff = this.fileDiffs.get(filePath);
    if (!diff) return 0;
    return diff.linesAdded;
  }

  linesRemovedForFile(filePath: string): number {
    const diff = this.fileDiffs.get(filePath);
    if (!diff) return 0;
    return diff.linesRemoved;
  }

  diffForFile(filePath: string): FileDiff | undefined {
    return this.fileDiffs.get(filePath);
  }

  changedFiles(): string[] {
    return [...this.fileDiffs.keys()];
  }

  clearPendingDiffs(): void {
    this._pendingDiffs = [];
    this.fileDiffs.clear();
  }
}
