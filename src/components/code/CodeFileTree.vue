<template>
  <div class="w-56 flex flex-col bg-[var(--bg-base)] border-r border-[var(--border-subtle)] overflow-hidden">
    <!-- Tab bar -->
    <div class="flex items-center gap-0.5 px-3 py-2 border-b border-[var(--border-subtle)]">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="text-[10px] px-2 py-0.5 rounded transition-colors"
        :class="codeStore.leftPanelTab === tab.key
          ? 'text-txt-primary bg-[var(--bg-raised)]'
          : 'text-txt-muted hover:text-txt-secondary'"
        @click="codeStore.leftPanelTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Content area -->
    <div class="flex-1 min-h-0 overflow-auto">
      <WorkspaceTree
        v-if="codeStore.leftPanelTab === 'files'"
        :rootPath="ui.workspacePath"
        :gitEntries="gitStore.entries"
        @file-selected="(p: string) => emit('file-selected', p)"
        @file-deleted="(p: string) => emit('file-deleted', p)"
      />
      <GitPanel v-else-if="codeStore.leftPanelTab === 'git'" />
      <SearchPanel
        v-else-if="codeStore.leftPanelTab === 'search'"
        :workspacePath="ui.workspacePath"
        @file-selected="(p: string) => emit('file-selected', p)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCodeStore } from '@/stores/code';
import { useUiStore } from '@/stores/ui';
import { useGitStore } from '@/stores/git';
import WorkspaceTree from '@/components/sidebar/WorkspaceTree.vue';
import GitPanel from '@/components/sidebar/GitPanel.vue';
import SearchPanel from '@/components/sidebar/SearchPanel.vue';

const codeStore = useCodeStore();
const ui = useUiStore();
const gitStore = useGitStore();

const tabs = [
  { key: 'files' as const, label: 'Files' },
  { key: 'git' as const, label: 'Git' },
  { key: 'search' as const, label: 'Find' },
];

const emit = defineEmits<{
  'file-selected': [filePath: string];
  'file-deleted': [filePath: string];
}>();
</script>
