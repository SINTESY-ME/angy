<template>
  <div class="tool-group">
    <!-- Header: expand/collapse arrow + summary -->
    <div
      class="flex items-center gap-1.5 cursor-pointer select-none"
      @click="isExpanded = !isExpanded"
    >
      <svg class="w-2 h-2 text-txt-faint flex-shrink-0 transition-transform" :class="isExpanded ? 'rotate-90' : ''" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2L5 4L3 6"/></svg>
      <span class="text-[10px] leading-snug" v-html="summaryHtml" />
    </div>

    <!-- Expanded detail view -->
    <div v-if="isExpanded" class="mt-1 space-y-px ml-3.5">
      <div v-for="(call, idx) in calls" :key="idx">
        <!-- Tool row: name + file path / summary -->
        <div class="flex items-center gap-1 text-[9px] py-0.5 flex-nowrap min-w-0">
          <span class="font-mono text-ember-400 flex-shrink-0">{{ call.toolName }}</span>
          <span
            v-if="call.filePath"
            class="text-txt-secondary font-mono cursor-pointer hover:text-[var(--accent-teal)] truncate"
            @click.stop="$emit('file-clicked', call.filePath!)"
          >{{ shortPath(call.filePath) }}</span>
          <span
            v-else-if="call.summary"
            class="text-txt-faint font-mono truncate"
          >{{ call.summary }}</span>
          <!-- Compact diff stats for edits -->
          <template v-if="call.isEdit && (call.oldString || call.newString)">
            <span v-if="call.oldString" class="text-[var(--accent-red)] flex-shrink-0">-{{ lineCount(call.oldString) }}</span>
            <span v-if="call.newString" class="text-[var(--accent-green)] flex-shrink-0">+{{ lineCount(call.newString) }}</span>
            <button
              class="text-txt-faint hover:text-txt-muted flex-shrink-0 ml-auto"
              @click.stop="toggleDiff(idx)"
              title="Toggle diff"
            >
              <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 3.5h6M2 6.5h4"/></svg>
            </button>
          </template>
        </div>

        <!-- Compact diff (shown on demand) -->
        <div
          v-if="call.isEdit && expandedDiffs.has(idx) && (call.oldString || call.newString)"
          class="diff-block rounded overflow-hidden font-mono text-[9px] leading-[14px] max-h-32 overflow-y-auto my-0.5"
        >
          <template v-if="call.oldString">
            <div
              v-for="(line, i) in limitedLines(call.oldString, false)"
              :key="`old-${i}`"
              class="px-1.5 diff-removed whitespace-pre"
            >-{{ line }}</div>
          </template>
          <template v-if="call.newString">
            <div
              v-for="(line, i) in limitedLines(call.newString, true)"
              :key="`new-${i}`"
              class="px-1.5 diff-added whitespace-pre"
            >+{{ line }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';

export interface ToolCallInfo {
  toolName: string;
  filePath?: string;
  summary?: string;
  isEdit?: boolean;
  oldString?: string;
  newString?: string;
}

const MAX_DIFF_LINES = 8;

const props = withDefaults(
  defineProps<{
    calls: ToolCallInfo[];
    expandedByDefault?: boolean;
  }>(),
  { expandedByDefault: false },
);

defineEmits<{
  'file-clicked': [filePath: string];
}>();

const isExpanded = ref(props.expandedByDefault);
const expandedDiffs = reactive(new Set<number>());

function toggleDiff(idx: number) {
  if (expandedDiffs.has(idx)) expandedDiffs.delete(idx);
  else expandedDiffs.add(idx);
}

function shortPath(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 3) return filePath;
  return '.../' + parts.slice(-2).join('/');
}

function lineCount(text: string): number {
  return text.split('\n').length;
}

function limitedLines(text: string, _isNew: boolean): string[] {
  const lines = text.split('\n');
  if (lines.length <= MAX_DIFF_LINES) return lines;
  return [...lines.slice(0, MAX_DIFF_LINES - 1), `  ... ${lines.length - MAX_DIFF_LINES + 1} more lines`];
}

const toolCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const call of props.calls) {
    counts[call.toolName] = (counts[call.toolName] ?? 0) + 1;
  }
  return counts;
});

const editCount = computed(() => props.calls.filter(c => c.isEdit).length);

const summaryHtml = computed(() => {
  const parts = Object.entries(toolCounts.value).map(([name, count]) => {
    return count > 1
      ? `<b>${name}</b> x${count}`
      : `<b>${name}</b>`;
  });
  const editNote = editCount.value > 0
    ? ` &mdash; <span style="color:var(--accent-green)">${editCount.value} file(s) modified</span>`
    : '';
  const n = props.calls.length;
  return `<span style="color:var(--text-muted)">${n} tool call${n !== 1 ? 's' : ''}:</span> ${parts.join(', ')}${editNote}`;
});
</script>

<style scoped>
.tool-group {
  background: var(--bg-raised);
  border-left: 2px solid var(--accent-teal);
  border-radius: 6px;
  padding: 6px 10px;
  margin: 2px 0;
}
.diff-block {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 4px;
}
.diff-removed {
  background: color-mix(in srgb, var(--accent-red) 8%, transparent);
  color: var(--accent-red);
}
.diff-added {
  background: color-mix(in srgb, var(--accent-green) 8%, transparent);
  color: var(--accent-green);
}
</style>
