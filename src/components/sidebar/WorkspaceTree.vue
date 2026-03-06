<template>
  <div class="flex flex-col h-full bg-[var(--bg-surface)]">
    <!-- Header -->
    <div class="px-3 py-2 border-b border-[var(--border-subtle)]">
      <div class="text-xs text-[var(--text-muted)] truncate">{{ rootPath || 'No workspace' }}</div>
    </div>

    <!-- File tree -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="!rootPath" class="flex items-center justify-center h-32 text-xs text-[var(--text-faint)]">
        No workspace open
      </div>
      <template v-else>
        <TreeNode v-for="node in tree" :key="node.path" :node="node" :depth="0"
                  :gitEntries="gitEntries" :changedFiles="changedFiles"
                  @file-selected="(p: string) => emit('file-selected', p)" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { readDir } from '@tauri-apps/plugin-fs';
import TreeNode from './TreeNode.vue';
import type { FileNode } from './TreeNode.vue';
import type { GitFileEntry } from '../../engine/GitManager';

const props = defineProps<{
  rootPath: string;
  gitEntries?: GitFileEntry[];
  changedFiles?: Map<string, string>;
}>();

const emit = defineEmits<{
  'file-selected': [filePath: string];
}>();

const tree = ref<FileNode[]>([]);

const SKIP_DIRS = new Set(['node_modules', 'target', 'build', 'dist', '.git', '__pycache__']);

async function loadDirectory(dirPath: string): Promise<FileNode[]> {
  try {
    const entries = await readDir(dirPath);
    const nodes: FileNode[] = entries
      .filter(e => e.name != null && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
      .map(e => ({
        name: e.name || '',
        path: `${dirPath}/${e.name}`,
        isDir: e.isDirectory,
      }));

    // Sort: dirs first, then alphabetical
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch {
    return [];
  }
}

watch(() => props.rootPath, async (path) => {
  if (path) {
    tree.value = await loadDirectory(path);
  } else {
    tree.value = [];
  }
}, { immediate: true });
</script>
