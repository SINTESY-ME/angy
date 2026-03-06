<template>
  <div
    ref="popupEl"
    class="absolute bottom-full left-4 mb-1 w-80 max-h-60 overflow-y-auto bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-lg shadow-lg z-50"
    @keydown="onKeydown"
  >
    <div class="p-2 border-b border-[var(--border-subtle)]">
      <div class="text-xs text-[var(--text-muted)]">Add context (@ mention)</div>
    </div>
    <div
      v-for="(file, i) in filteredFiles"
      :key="file"
      class="px-3 py-1.5 text-xs cursor-pointer hover:bg-white/[0.05] text-[var(--text-primary)] truncate"
      :class="i === selectedIndex ? 'bg-white/[0.05]' : ''"
      @click="$emit('select', file)"
    >
      {{ file }}
    </div>
    <div
      v-if="filteredFiles.length === 0"
      class="px-3 py-2 text-xs text-[var(--text-faint)]"
    >
      No files found
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { readDir } from '@tauri-apps/plugin-fs';

const props = defineProps<{
  query: string;
  workspacePath: string;
}>();

const emit = defineEmits<{
  select: [filePath: string];
  close: [];
}>();

const popupEl = ref<HTMLElement | null>(null);
const allFiles = ref<string[]>([]);
const selectedIndex = ref(0);

const MAX_RESULTS = 20;
const MAX_DEPTH = 3;
const SKIP_DIRS = new Set([
  'node_modules', 'target', 'build', 'dist', '.git', '__pycache__', '.next', '.nuxt', '.cache',
]);

const filteredFiles = computed(() => {
  const q = props.query.toLowerCase();
  const filtered = q
    ? allFiles.value.filter((f) => f.toLowerCase().includes(q))
    : allFiles.value;
  return filtered.slice(0, MAX_RESULTS);
});

watch(
  () => filteredFiles.value.length,
  () => {
    selectedIndex.value = 0;
  },
);

async function loadFiles(dirPath: string, depth: number): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  try {
    const entries = await readDir(dirPath);
    const result: string[] = [];
    for (const entry of entries) {
      if (!entry.name || entry.name.startsWith('.')) continue;
      if (entry.isDirectory) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const children = await loadFiles(`${dirPath}/${entry.name}`, depth + 1);
        result.push(...children);
      } else {
        const rel = `${dirPath}/${entry.name}`.replace(props.workspacePath + '/', '');
        result.push(rel);
      }
    }
    return result;
  } catch {
    return [];
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredFiles.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filteredFiles.value[selectedIndex.value]) {
      emit('select', filteredFiles.value[selectedIndex.value]);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

function onClickOutside(e: MouseEvent) {
  if (popupEl.value && !popupEl.value.contains(e.target as Node)) {
    emit('close');
  }
}

onMounted(async () => {
  if (props.workspacePath) {
    allFiles.value = await loadFiles(props.workspacePath, 0);
  }
  document.addEventListener('mousedown', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});

defineExpose({ onKeydown });
</script>
