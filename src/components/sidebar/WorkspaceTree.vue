<template>
  <div class="flex flex-col h-full bg-[var(--bg-surface)]">
    <!-- Header -->
    <div class="px-3 py-2 border-b border-[var(--border-subtle)]">
      <!-- Multi-repo selector (when epic has multiple repos) -->
      <div v-if="epicRepos.length > 1" class="flex items-center gap-1 mb-1">
        <button
          v-for="repo in epicRepos"
          :key="repo.id"
          class="text-[10px] px-1.5 py-0.5 rounded transition-colors"
          :class="activeRepoPath === repo.path
            ? 'bg-[var(--accent-mauve)]/20 text-[var(--accent-mauve)] font-semibold'
            : 'bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'"
          @click="switchRepo(repo.path)"
        >
          {{ repo.name }}
        </button>
      </div>
      <div class="text-xs text-[var(--text-muted)] truncate">{{ displayPath || 'No workspace' }}</div>
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
import { ref, computed, watch } from 'vue';
import { readDir } from '@tauri-apps/plugin-fs';
import TreeNode from './TreeNode.vue';
import type { FileNode } from './TreeNode.vue';
import type { GitFileEntry } from '../../engine/GitManager';
import { useUiStore } from '@/stores/ui';
import { useProjectsStore } from '@/stores/projects';
import { useEpicStore } from '@/stores/epics';

const ui = useUiStore();
const projectsStore = useProjectsStore();
const epicStore = useEpicStore();

const props = defineProps<{
  rootPath: string;
  gitEntries?: GitFileEntry[];
  changedFiles?: Map<string, string>;
}>();

const emit = defineEmits<{
  'file-selected': [filePath: string];
}>();

const tree = ref<FileNode[]>([]);
const activeRepoPath = ref('');

// Compute repos for the active epic (multi-repo support)
const epicRepos = computed(() => {
  if (!ui.activeEpicId || !ui.activeProjectId) return [];
  const epic = epicStore.epicById(ui.activeEpicId);
  if (!epic || epic.targetRepoIds.length <= 1) return [];
  const projectRepos = projectsStore.reposByProjectId(ui.activeProjectId);
  return projectRepos.filter((r) => epic.targetRepoIds.includes(r.id));
});

const displayPath = computed(() => {
  if (epicRepos.value.length > 1 && activeRepoPath.value) {
    const repo = epicRepos.value.find((r) => r.path === activeRepoPath.value);
    return repo ? repo.name : activeRepoPath.value;
  }
  return props.rootPath || '';
});

function switchRepo(repoPath: string) {
  activeRepoPath.value = repoPath;
  ui.workspacePath = repoPath;
}

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
    activeRepoPath.value = path;
    tree.value = await loadDirectory(path);
  } else {
    tree.value = [];
  }
}, { immediate: true });
</script>
