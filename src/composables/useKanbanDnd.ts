/**
 * Pointer-event based drag-and-drop for the Kanban board.
 *
 * Tauri's WKWebView on macOS does not dispatch HTML5 drag-target events
 * (dragenter, dragover, drop) to in-page elements, so the standard
 * Drag-and-Drop API cannot be used.  This module implements DnD entirely
 * with pointer events which work reliably in every environment.
 *
 * Columns mark their drop-zone element with a `data-drop-column` attribute
 * whose value is the target EpicColumn (e.g. "idea", "todo", "in-progress").
 * Cards call `startDrag()` on pointerdown; global listeners handle the rest.
 */

import { reactive } from 'vue';
import type { EpicColumn } from '@/engine/KosTypes';
import { useEpicStore } from '@/stores/epics';
import { engineBus } from '@/engine/EventBus';

// ── Shared reactive state ────────────────────────────────────────────

export const kanbanDnd = reactive({
  /** The epic currently being dragged (null when idle). */
  draggingEpicId: null as string | null,
  /** The column the cursor is currently hovering over during a drag. */
  hoverColumn: null as EpicColumn | null,
});

// ── Internal (non-reactive) bookkeeping ──────────────────────────────

let _ghostEl: HTMLElement | null = null;
let _sourceEl: HTMLElement | null = null;
let _startX = 0;
let _startY = 0;
let _offsetX = 0;
let _offsetY = 0;
let _dragging = false;

const DRAG_THRESHOLD = 5; // px – ignore tiny movements (allow clicks)

// ── Public API ───────────────────────────────────────────────────────

/**
 * Called from a card's `pointerdown` handler.
 * Sets up move/up listeners; actual drag begins only after the pointer
 * moves beyond DRAG_THRESHOLD so normal clicks still work.
 */
export function startDrag(epicId: string, e: PointerEvent, cardEl: HTMLElement) {
  if (e.button !== 0) return;           // left button only
  if (kanbanDnd.draggingEpicId) return;  // already dragging

  _startX = e.clientX;
  _startY = e.clientY;
  _sourceEl = cardEl;
  _dragging = false;

  // Store epic id early so the threshold check can reference it,
  // but don't expose it to columns yet (they check draggingEpicId).
  const id = epicId;

  function onMove(ev: PointerEvent) {
    const dx = ev.clientX - _startX;
    const dy = ev.clientY - _startY;

    if (!_dragging) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
      // Passed threshold → begin visual drag
      _dragging = true;
      kanbanDnd.draggingEpicId = id;
      _createGhost(cardEl, ev);
      _sourceEl?.classList.add('opacity-40');
    }

    _moveGhost(ev);
    _detectHoverColumn(ev);
  }

  function onUp(ev: PointerEvent) {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    try {
      if (_dragging) {
        _finishDrag(id, ev);
        // Swallow the click event the browser synthesises after pointerup
        // so cards don't open the detail-panel on a drag-release.
        _suppressNextClick();
      }
    } finally {
      _cleanup();
    }
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ── Ghost element ────────────────────────────────────────────────────

function _createGhost(cardEl: HTMLElement, ev: PointerEvent) {
  const rect = cardEl.getBoundingClientRect();
  _offsetX = ev.clientX - rect.left;
  _offsetY = ev.clientY - rect.top;

  const ghost = cardEl.cloneNode(true) as HTMLElement;
  ghost.style.cssText = `
    position: fixed;
    width: ${rect.width}px;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.85;
    transform: rotate(1.5deg) scale(1.02);
    transition: none;
    box-shadow: 0 12px 28px rgba(0,0,0,0.35);
    left: ${ev.clientX - _offsetX}px;
    top: ${ev.clientY - _offsetY}px;
  `;
  document.body.appendChild(ghost);
  _ghostEl = ghost;
}

function _moveGhost(ev: PointerEvent) {
  if (!_ghostEl) return;
  _ghostEl.style.left = `${ev.clientX - _offsetX}px`;
  _ghostEl.style.top = `${ev.clientY - _offsetY}px`;
}

// ── Column detection ─────────────────────────────────────────────────

function _detectHoverColumn(ev: PointerEvent) {
  const el = document.elementFromPoint(ev.clientX, ev.clientY);
  const colEl = el?.closest('[data-drop-column]') as HTMLElement | null;
  const col = (colEl?.dataset.dropColumn as EpicColumn) ?? null;
  kanbanDnd.hoverColumn = col;
}

// ── Drop ─────────────────────────────────────────────────────────────

function _finishDrag(epicId: string, ev: PointerEvent) {
  _detectHoverColumn(ev);
  const targetColumn = kanbanDnd.hoverColumn;
  if (!targetColumn) return;

  const epicStore = useEpicStore();
  const epic = epicStore.epicById(epicId);
  if (!epic || epic.column === targetColumn) return;

  if (targetColumn === 'in-progress') {
    engineBus.emit('epic:requestStart', { epicId });
  } else if (epic.column === 'in-progress') {
    engineBus.emit('epic:requestStop', { epicId, targetColumn });
  } else {
    epicStore.moveEpic(epicId, targetColumn);
  }
}

// ── Click suppression ────────────────────────────────────────────────

/**
 * After a successful drag the browser still fires a synthetic `click`
 * on the card (from the pointerdown/pointerup pair).  Capture it once
 * on the document and swallow it so `onSingleClick` never runs.
 */
function _suppressNextClick() {
  const handler = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    document.removeEventListener('click', handler, true);
  };
  document.addEventListener('click', handler, true);
  // Safety net: remove if the click never comes (e.g. pointer left the window)
  setTimeout(() => document.removeEventListener('click', handler, true), 200);
}

// ── Cleanup ──────────────────────────────────────────────────────────

function _cleanup() {
  _ghostEl?.remove();
  _ghostEl = null;
  _sourceEl?.classList.remove('opacity-40');
  _sourceEl = null;
  _dragging = false;
  kanbanDnd.draggingEpicId = null;
  kanbanDnd.hoverColumn = null;
}
