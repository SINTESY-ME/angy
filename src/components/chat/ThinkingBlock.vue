<template>
  <details class="thinking-block group my-2">
    <summary class="flex items-center gap-2 cursor-pointer text-[11px] text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors select-none">
      <svg
        class="w-2.5 h-2.5 transition-transform group-open:rotate-90"
        fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
      ><path d="M9 18l6-6-6-6"/></svg>
      <span :class="isStreaming ? 'animate-pulse' : ''">
        {{ isStreaming ? 'Thinking...' : `Thinking · ${formattedTime}` }}
      </span>
    </summary>
    <div class="mt-1.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[11px] text-[var(--text-secondary)] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
      {{ content }}
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  content: string;
  elapsedMs?: number;
  isStreaming?: boolean;
}>(), {
  isStreaming: false,
});

const formattedTime = computed(() => {
  if (!props.elapsedMs || props.elapsedMs <= 0) return 'a moment';
  const seconds = Math.round(props.elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
});
</script>
