<template>
  <div>
    <div class="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-white/[0.03] text-xs"
         :style="{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '8px' }"
         @click="onClick"
         @dblclick="onDblClick"
         @contextmenu.prevent="showContextMenu">
      <!-- Expand arrow for directories -->
      <span v-if="node.isDir" class="w-3 text-[var(--text-faint)] text-[10px] select-none">
        {{ expanded ? '&#x25be;' : '&#x25b8;' }}
      </span>
      <span v-else class="w-3"></span>

      <!-- Icon -->
      <span class="text-xs shrink-0">{{ node.isDir ? '📁' : fileIcon }}</span>

      <!-- Name (or inline rename input) -->
      <input v-if="isRenaming" ref="renameInputRef"
             v-model="renameText"
             class="flex-1 bg-[var(--bg-base)] text-[var(--text-primary)] text-xs px-1 py-0 border border-[var(--accent-mauve)] rounded outline-none"
             @keydown.enter.prevent="confirmRename"
             @keydown.escape.prevent="cancelRename"
             @blur="cancelRename"
             @click.stop />
      <span v-else class="flex-1 truncate" :class="nameClass">{{ node.name }}</span>

      <!-- Git status badge -->
      <span v-if="gitStatus" class="text-[10px] font-bold shrink-0" :class="gitStatusColor">{{ gitStatus }}</span>

      <!-- Change badge from DiffEngine -->
      <span v-if="changeType" class="text-[10px] font-bold px-1 rounded shrink-0" :class="changeBadgeClass">{{ changeType }}</span>
    </div>

    <!-- Inline create input (shown at top of children when creating) -->
    <div v-if="node.isDir && expanded && creatingType"
         class="flex items-center gap-1 py-0.5 text-xs"
         :style="{ paddingLeft: `${8 + (depth + 1) * 12}px`, paddingRight: '8px' }">
      <span class="w-3"></span>
      <span class="text-xs shrink-0">{{ creatingType === 'folder' ? '📁' : '📄' }}</span>
      <input ref="createInputRef"
             v-model="createName"
             :placeholder="creatingType === 'folder' ? 'folder name' : 'file name'"
             class="flex-1 bg-[var(--bg-base)] text-[var(--text-primary)] text-xs px-1 py-0 border border-[var(--accent-green)] rounded outline-none"
             @keydown.enter.prevent="confirmCreate"
             @keydown.escape.prevent="cancelCreate"
             @blur="cancelCreate"
             @click.stop />
    </div>

    <!-- Children (lazy loaded) -->
    <template v-if="node.isDir && expanded">
      <TreeNode v-for="child in children" :key="child.path" :node="child" :depth="depth + 1"
                :gitEntries="gitEntries" :changedFiles="changedFiles"
                @file-selected="(p: string) => emit('file-selected', p)"
                @node-mutated="() => emit('node-mutated')"
                @node-deleted="(p: string) => onChildDeleted(p)" />
    </template>

    <!-- Context menu -->
    <Teleport to="body">
      <div v-if="contextMenuVisible"
           class="fixed z-50 bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-md py-1 shadow-lg min-w-[160px]"
           :style="{ left: `${contextMenuPos.x}px`, top: `${contextMenuPos.y}px` }"
           @click="contextMenuVisible = false">
        <!-- Directory-only actions -->
        <template v-if="node.isDir">
          <button class="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
                  @click="startCreate('file')">New File</button>
          <button class="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
                  @click="startCreate('folder')">New Folder</button>
          <div class="h-px bg-[var(--border-subtle)] my-1" />
        </template>
        <button class="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
                @click="startRename">Rename</button>
        <button class="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
                @click="copyPath">Copy Path</button>
        <div class="h-px bg-[var(--border-subtle)] my-1" />
        <button class="w-full text-left px-3 py-1.5 text-xs text-[var(--accent-red)] hover:bg-white/[0.06] transition-colors"
                @click="deleteNode">Delete</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { readDir } from '@tauri-apps/plugin-fs';
import type { GitFileEntry } from '../../engine/GitManager';
import { useEditorStore } from '../../stores/editor';

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
}

const props = defineProps<{
  node: FileNode;
  depth: number;
  gitEntries?: GitFileEntry[];
  changedFiles?: Map<string, string>;
}>();

const emit = defineEmits<{
  'file-selected': [filePath: string];
  'node-mutated': [];
  'node-deleted': [filePath: string];
}>();

const editorStore = useEditorStore();

const expanded = ref(props.node.isDir && editorStore.isExpanded(props.node.path));
const children = ref<FileNode[]>([]);

// Context menu state
const contextMenuVisible = ref(false);
const contextMenuPos = ref({ x: 0, y: 0 });

// Inline rename state
const isRenaming = ref(false);
const renameText = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

// Inline create state
const creatingType = ref<'file' | 'folder' | null>(null);
const createName = ref('');
const createInputRef = ref<HTMLInputElement | null>(null);

// Git status for this file
const gitStatus = computed(() => {
  if (!props.gitEntries || props.node.isDir) return null;
  const entry = props.gitEntries.find(e => props.node.path.endsWith(e.path));
  if (!entry) return null;
  return entry.workTreeStatus !== ' ' ? entry.workTreeStatus : entry.indexStatus;
});

const gitStatusColor = computed(() => {
  switch (gitStatus.value) {
    case 'M': return 'text-[var(--accent-yellow)]';
    case 'A': case '?': return 'text-[var(--accent-green)]';
    case 'D': return 'text-[var(--accent-red)]';
    default: return 'text-[var(--text-faint)]';
  }
});

// Change markers from DiffEngine
const changeType = computed(() => {
  if (!props.changedFiles) return null;
  return props.changedFiles.get(props.node.path) || null;
});

const changeBadgeClass = computed(() => {
  switch (changeType.value) {
    case 'M': return 'bg-[color-mix(in_srgb,var(--accent-yellow)_15%,transparent)] text-[var(--accent-yellow)]';
    case 'C': return 'bg-[color-mix(in_srgb,var(--accent-green)_15%,transparent)] text-[var(--accent-green)]';
    case 'D': return 'bg-[color-mix(in_srgb,var(--accent-red)_15%,transparent)] text-[var(--accent-red)]';
    default: return '';
  }
});

const nameClass = computed(() => {
  if (gitStatus.value === 'D') return 'text-[var(--text-faint)] line-through';
  if (gitStatus.value === '?' || gitStatus.value === 'A') return 'text-[var(--accent-green)]';
  if (gitStatus.value === 'M') return 'text-[var(--accent-yellow)]';
  return 'text-[var(--text-primary)]';
});

const fileIcon = computed(() => {
  const ext = props.node.name.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡',
    vue: '💚', py: '🐍', rs: '🦀', go: '🔵',
    json: '📋', md: '📝', css: '🎨', html: '🌐',
    sh: '⚙️', yml: '⚙️', yaml: '⚙️', toml: '⚙️',
  };
  return iconMap[ext || ''] || '📄';
});

const SKIP_DIRS = new Set(['node_modules', 'target', 'build', 'dist', '.git', '__pycache__']);

// --- Click handlers ---

async function onClick() {
  if (props.node.isDir) {
    expanded.value = !expanded.value;
    if (expanded.value) {
      editorStore.saveExpandedDir(props.node.path);
      if (children.value.length === 0) {
        await loadChildren();
      }
    } else {
      editorStore.removeExpandedDir(props.node.path);
    }
  }
}

function onDblClick() {
  if (!props.node.isDir) {
    emit('file-selected', props.node.path);
  }
}

// --- Context menu ---

function showContextMenu(e: MouseEvent) {
  contextMenuPos.value = { x: e.clientX, y: e.clientY };
  contextMenuVisible.value = true;
}

function closeContextMenu() {
  contextMenuVisible.value = false;
}

// --- Rename ---

async function startRename() {
  renameText.value = props.node.name;
  isRenaming.value = true;
  await nextTick();
  renameInputRef.value?.focus();
  // Select filename without extension for files
  if (!props.node.isDir) {
    const dotIndex = props.node.name.lastIndexOf('.');
    if (dotIndex > 0) {
      renameInputRef.value?.setSelectionRange(0, dotIndex);
    } else {
      renameInputRef.value?.select();
    }
  } else {
    renameInputRef.value?.select();
  }
}

async function confirmRename() {
  const newName = renameText.value.trim();
  if (!newName || newName === props.node.name || newName.includes('/')) {
    cancelRename();
    return;
  }
  try {
    const { rename: fsRename, exists } = await import('@tauri-apps/plugin-fs');
    const parentDir = props.node.path.substring(0, props.node.path.lastIndexOf('/'));
    const newPath = `${parentDir}/${newName}`;
    if (await exists(newPath)) {
      cancelRename();
      return;
    }
    await fsRename(props.node.path, newPath);
    editorStore.updateTabPath(props.node.path, newPath);
    if (props.node.isDir) {
      editorStore.updateExpandedDirs(props.node.path, newPath);
    }
    isRenaming.value = false;
    emit('node-mutated');
  } catch {
    cancelRename();
  }
}

function cancelRename() {
  isRenaming.value = false;
  renameText.value = '';
}

// --- Create file/folder ---

async function startCreate(type: 'file' | 'folder') {
  creatingType.value = type;
  createName.value = '';
  // Expand dir if collapsed
  if (!expanded.value) {
    expanded.value = true;
    editorStore.saveExpandedDir(props.node.path);
    if (children.value.length === 0) {
      await loadChildren();
    }
  }
  await nextTick();
  createInputRef.value?.focus();
}

async function confirmCreate() {
  const name = createName.value.trim();
  if (!name || name.includes('/')) {
    cancelCreate();
    return;
  }
  const newPath = `${props.node.path}/${name}`;
  try {
    const { exists } = await import('@tauri-apps/plugin-fs');
    if (await exists(newPath)) {
      cancelCreate();
      return;
    }
    if (creatingType.value === 'folder') {
      const { mkdir } = await import('@tauri-apps/plugin-fs');
      await mkdir(newPath);
    } else {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(newPath, '');
    }
    creatingType.value = null;
    createName.value = '';
    await loadChildren();
    emit('node-mutated');
  } catch {
    cancelCreate();
  }
}

function cancelCreate() {
  creatingType.value = null;
  createName.value = '';
}

// --- Delete ---

async function deleteNode() {
  try {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await confirm(
      `Delete "${props.node.name}"${props.node.isDir ? ' and all its contents' : ''}?`,
      { title: 'Confirm Delete', kind: 'warning' }
    );
    if (!confirmed) return;
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(props.node.path, { recursive: props.node.isDir });
    editorStore.removeTabByPath(props.node.path);
    if (props.node.isDir) {
      editorStore.removeExpandedDirsUnder(props.node.path);
    }
    emit('node-deleted', props.node.path);
  } catch {
    // silently fail
  }
}

// --- Copy path ---

function copyPath() {
  navigator.clipboard.writeText(props.node.path);
}

// --- Child deleted handler ---

function onChildDeleted(path: string) {
  children.value = children.value.filter(c => c.path !== path);
  emit('node-deleted', path);
}

// --- Load children ---

onMounted(async () => {
  document.addEventListener('click', closeContextMenu);
  if (expanded.value && props.node.isDir && children.value.length === 0) {
    await loadChildren();
  }
});

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
});

async function loadChildren() {
  try {
    const entries = await readDir(props.node.path);
    children.value = entries
      .filter(e => e.name != null && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
      .map(e => ({
        name: e.name || '',
        path: `${props.node.path}/${e.name}`,
        isDir: e.isDirectory,
      }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    children.value = [];
  }
}
</script>
