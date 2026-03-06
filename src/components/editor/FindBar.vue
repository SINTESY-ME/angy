<template>
  <!-- Monaco handles find natively via Cmd+F; this is a programmatic wrapper -->
  <div v-if="visible" class="flex items-center gap-2 px-3 py-1 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
    <input v-model="query" ref="input"
           @keydown.enter="findNext" @keydown.escape="$emit('close')"
           placeholder="Find..."
           class="text-xs bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded px-2 py-1 w-48 outline-none focus:border-[var(--accent-mauve)]" />
    <button @click="findPrev" class="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">↑</button>
    <button @click="findNext" class="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">↓</button>
    <span class="text-xs text-[var(--text-faint)]">{{ matchCount }} results</span>
    <button @click="$emit('close')" class="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">✕</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type * as monaco from 'monaco-editor';

// ── Props & Emits ─────────────────────────────────────────────────────────

defineProps<{
  visible: boolean;
}>();

defineEmits<{
  close: [];
}>();

// ── State ─────────────────────────────────────────────────────────────────

const query = ref('');
const matchCount = ref(0);
const input = ref<HTMLInputElement | null>(null);

let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
let decorationIds: string[] = [];

// ── Public API ────────────────────────────────────────────────────────────

function setEditor(editor: monaco.editor.IStandaloneCodeEditor) {
  editorInstance = editor;
}

function focusInput() {
  nextTick(() => input.value?.focus());
}

function prefill(text: string) {
  query.value = text;
  doFind();
}

// ── Find logic ────────────────────────────────────────────────────────────

function doFind() {
  if (!editorInstance || !query.value) {
    matchCount.value = 0;
    clearDecorations();
    return;
  }

  const model = editorInstance.getModel();
  if (!model) return;

  const matches = model.findMatches(query.value, true, false, false, null, false);
  matchCount.value = matches.length;

  // Highlight matches
  clearDecorations();
  decorationIds = editorInstance.deltaDecorations([], matches.map(m => ({
    range: m.range,
    options: {
      className: 'findHighlight',
      overviewRuler: { color: '#cba6f7', position: 1 /* monaco.editor.OverviewRulerLane.Center */ },
    },
  })));

  if (matches.length > 0) {
    editorInstance.revealRangeInCenter(matches[0].range);
    editorInstance.setSelection(matches[0].range);
  }
}

function findNext() {
  if (!editorInstance) return;
  editorInstance.getAction('editor.action.nextMatchFindAction')?.run();
}

function findPrev() {
  if (!editorInstance) return;
  editorInstance.getAction('editor.action.previousMatchFindAction')?.run();
}

function clearDecorations() {
  if (editorInstance && decorationIds.length > 0) {
    editorInstance.deltaDecorations(decorationIds, []);
    decorationIds = [];
  }
}

// Re-search when query changes
watch(query, () => doFind());

// ── Expose ────────────────────────────────────────────────────────────────

defineExpose({ setEditor, focusInput, prefill });
</script>
