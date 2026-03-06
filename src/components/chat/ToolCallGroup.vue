<template>
  <div
    class="my-1"
    style="background: var(--bg-raised); border-left: 2px solid var(--accent-teal); border-radius: 12px; padding: 10px 14px;"
  >
    <!-- Header: expand/collapse arrow + summary -->
    <div
      class="flex items-center gap-1.5 cursor-pointer select-none"
      @click="isExpanded = !isExpanded"
    >
      <span class="text-[10px] text-[var(--text-muted)] w-3 flex-shrink-0">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span class="text-[11px] leading-snug" v-html="summaryHtml" />
    </div>

    <!-- Expanded detail view -->
    <div v-if="isExpanded" class="mt-2 space-y-2 ml-4">
      <div v-for="(call, idx) in calls" :key="idx">
        <!-- Tool icon + name + file path / summary -->
        <div class="flex items-center gap-1.5 text-[11px] flex-wrap">
          <span class="text-[var(--text-muted)]">{{ getToolIcon(call.toolName) }}</span>
          <span class="font-bold text-[var(--accent-green)]">{{ call.toolName }}</span>
          <span
            v-if="call.filePath"
            class="text-[var(--accent-teal)] font-mono cursor-pointer hover:underline truncate max-w-sm"
            @click.stop="$emit('file-clicked', call.filePath!)"
          >{{ call.filePath }}</span>
          <span
            v-else-if="call.summary"
            class="text-[var(--text-muted)] font-mono truncate max-w-sm"
          >{{ call.summary }}</span>
        </div>

        <!-- Diff view for edit tools -->
        <div
          v-if="call.isEdit && (call.oldString || call.newString)"
          class="mt-1 rounded overflow-hidden font-mono text-[11px] max-h-48 overflow-y-auto"
        >
          <template v-if="call.oldString">
            <div
              v-for="(line, i) in call.oldString.split('\n')"
              :key="`old-${i}`"
              class="px-2 leading-5"
              style="background: color-mix(in srgb, var(--accent-red) 12%, transparent); color: var(--accent-red);"
            >- {{ line }}</div>
          </template>
          <template v-if="call.newString">
            <div
              v-for="(line, i) in call.newString.split('\n')"
              :key="`new-${i}`"
              class="px-2 leading-5"
              style="background: color-mix(in srgb, var(--accent-green) 12%, transparent); color: var(--accent-green);"
            >+ {{ line }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

export interface ToolCallInfo {
  toolName: string;
  filePath?: string;
  summary?: string;
  isEdit?: boolean;
  oldString?: string;
  newString?: string;
}

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

const toolIconMap: Record<string, string> = {
  Edit: '✎',
  StrReplace: '✎',
  Write: '✐',
  NotebookEdit: '✐',
  Read: '◧',
  Bash: '⌘',
  Glob: '⊛',
  Grep: '⊚',
  WebFetch: '⊕',
  WebSearch: '⊕',
  TodoWrite: '☐',
  Agent: '◎',
  AskUserQuestion: '?',
};

function getToolIcon(toolName: string): string {
  return toolIconMap[toolName] ?? '✦';
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
    const icon = getToolIcon(name);
    return count > 1
      ? `${icon} <b>${name}</b> x${count}`
      : `${icon} <b>${name}</b>`;
  });
  const editNote = editCount.value > 0
    ? ` &mdash; <span style="color:var(--accent-green)">${editCount.value} file(s) modified</span>`
    : '';
  const n = props.calls.length;
  return `<span style="color:var(--text-muted)">${n} tool call${n !== 1 ? 's' : ''}:</span> ${parts.join(', ')}${editNote}`;
});
</script>
