<template>
  <div class="thinking-block my-2">
    <button
      @click="expanded = !expanded"
      class="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors select-none w-full text-left py-1"
    >
      <svg class="w-2 h-2 transition-transform duration-150" :class="expanded ? 'rotate-90' : ''" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2L5 4L3 6"/></svg>
      <span :class="isStreaming ? 'animate-pulse' : ''">
        {{ isStreaming ? 'Thinking...' : `Thought for ${formattedTime}` }}
      </span>
    </button>
    <div
      v-if="expanded"
      class="px-3 py-2 text-[11px] text-[var(--text-muted)] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed"
    >
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(defineProps<{
  content: string;
  elapsedMs?: number;
  isStreaming?: boolean;
}>(), {
  isStreaming: false,
});

const expanded = ref(false);

const formattedTime = computed(() => {
  if (!props.elapsedMs || props.elapsedMs <= 0) return '0s';
  const seconds = Math.round(props.elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
});
</script>

<style scoped>
.thinking-block {
  border-left: 2px solid var(--border-standard);
  padding-left: 10px;
  margin-bottom: 10px;
}
</style>
