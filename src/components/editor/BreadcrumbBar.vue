<template>
  <div class="flex items-center gap-0.5 px-3 h-6 text-xs bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] overflow-hidden">
    <template v-for="(segment, i) in segments" :key="i">
      <span v-if="i > 0" class="text-[var(--text-faint)]"> › </span>
      <span v-if="i < segments.length - 1"
            class="text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer"
            @click="$emit('segment-clicked', segment.path)">
        {{ segment.name }}
      </span>
      <span v-else class="text-[var(--text-primary)] font-medium">{{ segment.name }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// ── Props & Emits ─────────────────────────────────────────────────────────

const props = defineProps<{
  filePath: string;
  rootPath: string;
}>();

defineEmits<{
  'segment-clicked': [path: string];
}>();

// ── Computed ──────────────────────────────────────────────────────────────

interface Segment {
  name: string;
  path: string;
}

const segments = computed<Segment[]>(() => {
  if (!props.filePath) return [];

  // Make path relative to rootPath
  let rel = props.filePath;
  if (props.rootPath && rel.startsWith(props.rootPath)) {
    rel = rel.slice(props.rootPath.length);
    if (rel.startsWith('/')) rel = rel.slice(1);
  }

  const parts = rel.split('/').filter(Boolean);
  const result: Segment[] = [];
  let accumulated = props.rootPath || '';

  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    result.push({ name: part, path: accumulated });
  }

  return result;
});
</script>
