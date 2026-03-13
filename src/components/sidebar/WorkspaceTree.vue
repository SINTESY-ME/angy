<template>
  <div class="flex flex-col h-full bg-[var(--bg-surface)]">
    <!-- Header -->
    <div class="px-3 py-2 border-b border-[var(--border-subtle)]">
      <!-- Multi-repo selector (when epic has multiple repos) -->
      <div v-if="epicRepos.length > 1" class="flex items-center gap-1 mb-1">
        <button
          v-for="repo in epicRepos"
          :key="repo.id"
          class="text-[var(--text-xs)] px-1.5 py-0.5 rounded transition-colors"
          :class="activeRepoPath === repo.path
            ? 'bg-[var(--accent-mauve)]/20 text-[var(--accent-mauve)] font-semibold'
            : 'bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'"
          @click="switchRepo(repo.path)"
        >
          {{ repo.name }}
        </button>
      </div>
      <div class="flex items-center justify-between">
        <div class="text-xs text-[var(--text-muted)] truncate flex-1">{{ displayPath || 'No workspace' }}</div>
        <div v-if="rootPath" class="flex items-center gap-0.5 shrink-0">
          <button @click="createAtRoot('file')" title="New File"
                  class="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z"/>
              <path d="M9 1v4h4"/>
              <path d="M8 9v4M6 11h4"/>
            </svg>
          </button>
          <button @click="createAtRoot('folder')" title="New Folder"
                  class="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 13H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1z"/>
              <path d="M8 7v4M6 9h4"/>
            </svg>
          </button>
          <button @click="refreshTree" title="Refresh"
                  class="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 1v5h5"/>
              <path d="M3.51 10a5 5 0 1 0 .49-5.28L1 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Root-level create input -->
    <div v-if="rootCreatingType" class="flex items-center gap-1 py-0.5 text-xs"
         :style="{ paddingLeft: '8px', paddingRight: '8px' }">
      <span class="w-3"></span>
      <svg v-if="rootCreatingType === 'folder'" class="w-3.5 h-3.5 shrink-0 text-[var(--accent-yellow)]" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>
      <svg v-else class="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/></svg>
      <input ref="rootCreateInputRef"
             v-model="rootCreateName"
             :placeholder="rootCreatingType === 'folder' ? 'folder name' : 'file name'"
             class="flex-1 bg-[var(--bg-base)] text-[var(--text-primary)] text-xs px-1 py-0 border border-[var(--accent-green)] rounded outline-none"
             @keydown.enter.prevent="confirmRootCreate"
             @keydown.escape.prevent="cancelRootCreate"
             @blur="cancelRootCreate" />
    </div>

    <!-- File tree -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="!rootPath" class="flex items-center justify-center h-32 text-xs text-[var(--text-faint)]">
        No workspace open
      </div>
      <template v-else>
        <TreeNode v-for="node in tree" :key="node.path" :node="node" :depth="0"
                  :gitEntries="gitEntries" :changedFiles="changedFiles"
                  @file-selected="(p: string) => emit('file-selected', p)"
                  @node-mutated="refreshTree"
                  @node-deleted="onNodeDeleted" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
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
  'file-deleted': [filePath: string];
}>();

const tree = ref<FileNode[]>([]);
const activeRepoPath = ref('');

// Root-level create state
const rootCreatingType = ref<'file' | 'folder' | null>(null);
const rootCreateName = ref('');
const rootCreateInputRef = ref<HTMLInputElement | null>(null);

// Compute repos for multi-repo tab switching (project-level or epic-scoped)
const epicRepos = computed(() => {
  if (!ui.activeProjectId) return [];
  const projectRepos = projectsStore.reposByProjectId(ui.activeProjectId);
  if (projectRepos.length <= 1) return [];
  if (ui.activeEpicId) {
    const epic = epicStore.epicById(ui.activeEpicId);
    if (epic && epic.targetRepoIds.length > 0) {
      return projectRepos.filter((r) => epic.targetRepoIds.includes(r.id));
    }
  }
  return projectRepos;
});

const displayPath = computed(() => {
  if (epicRepos.value.length > 1 && activeRepoPath.value) {
    const repo = epicRepos.value.find((r) => r.path === activeRepoPath.value);
    return repo ? repo.name : activeRepoPath.value;
  }
  // Show the project name when active, otherwise show the folder name
  if (ui.activeProjectId) {
    const project = projectsStore.projectById(ui.activeProjectId);
    if (project) return project.name;
  }
  return props.rootPath || '';
});

function switchRepo(repoPath: string) {
  activeRepoPath.value = repoPath;
  if (repoPath !== ui.workspacePath) {
    // Path is changing — flag it as repo-only switch, let prop watcher load the tree
    ui.repoSwitchOnly = true;
    ui.workspacePath = repoPath;
  } else {
    // Same path — reload tree locally (no prop change will fire the watcher)
    loadDirectory(repoPath).then((nodes) => {
      tree.value = nodes;
    });
  }
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

async function refreshTree() {
  if (props.rootPath) {
    tree.value = await loadDirectory(props.rootPath);
  }
}

function onNodeDeleted(path: string) {
  tree.value = tree.value.filter(n => n.path !== path);
  emit('file-deleted', path);
}

// Root-level create
async function createAtRoot(type: 'file' | 'folder') {
  rootCreatingType.value = type;
  rootCreateName.value = '';
  await nextTick();
  rootCreateInputRef.value?.focus();
}

async function confirmRootCreate() {
  const name = rootCreateName.value.trim();
  if (!name || !props.rootPath || name.includes('/')) {
    cancelRootCreate();
    return;
  }
  const newPath = `${props.rootPath}/${name}`;
  try {
    const { exists } = await import('@tauri-apps/plugin-fs');
    if (await exists(newPath)) {
      cancelRootCreate();
      return;
    }
    if (rootCreatingType.value === 'folder') {
      const { mkdir } = await import('@tauri-apps/plugin-fs');
      await mkdir(newPath);
    } else {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(newPath, '');
    }
    cancelRootCreate();
    await refreshTree();
  } catch {
    cancelRootCreate();
  }
}

function cancelRootCreate() {
  rootCreatingType.value = null;
  rootCreateName.value = '';
}

watch(() => props.rootPath, async (path) => {
  if (path) {
    activeRepoPath.value = path;
    tree.value = await loadDirectory(path);
  } else {
    activeRepoPath.value = '';
    tree.value = [];
  }
}, { immediate: true });
</script>
