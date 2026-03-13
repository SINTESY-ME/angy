<template>
  <div class="tool-group my-1 rounded-[var(--radius-md)]">
    <!-- Header: expand/collapse arrow + summary -->
    <div
      class="flex items-center gap-1.5 cursor-pointer select-none"
      @click="isExpanded = !isExpanded"
    >
      <span class="text-[var(--text-xs)] text-[var(--text-muted)] w-3 flex-shrink-0 flex items-center justify-center">
        <svg v-if="isExpanded" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3L4 5L6 3"/></svg>
        <svg v-else width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2L5 4L3 6"/></svg>
      </span>
      <span class="text-[var(--text-xs)] leading-snug" v-html="summaryHtml" />
    </div>

    <!-- Expanded detail view -->
    <div v-if="isExpanded" class="mt-2 space-y-2 ml-4">
      <div v-for="(call, idx) in calls" :key="idx">
        <!-- Tool name + file path / summary -->
        <div class="flex items-center gap-1.5 text-[var(--text-xs)] flex-wrap">
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
          class="mt-1 rounded overflow-hidden font-mono text-[var(--text-xs)] max-h-48 overflow-y-auto"
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
  border-radius: var(--radius-md);
  padding: 10px 14px;
}
</style>
