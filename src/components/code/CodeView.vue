<template>
  <div class="flex flex-col h-full">
    <CodeViewHeader />
    <div class="flex flex-1 min-h-0">
      <CodeFileTree
        @file-selected="onFileSelected"
        @file-deleted="onFileDeleted"
      />
      <CodeEditorPane ref="editorPaneRef" />
      <CodeChatCollapsed />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import CodeViewHeader from './CodeViewHeader.vue';
import CodeFileTree from './CodeFileTree.vue';
import CodeEditorPane from './CodeEditorPane.vue';
import CodeChatCollapsed from './CodeChatCollapsed.vue';

const ui = useUiStore();
const editorPaneRef = ref<InstanceType<typeof CodeEditorPane> | null>(null);

function onFileSelected(filePath: string) {
  ui.currentFile = filePath;
  editorPaneRef.value?.loadFile(filePath);
}

function onFileDeleted(filePath: string) {
  editorPaneRef.value?.closeFile(filePath);
  const openFiles = editorPaneRef.value?.openFiles() ?? [];
  for (const f of openFiles) {
    if (f.startsWith(filePath + '/')) {
      editorPaneRef.value?.closeFile(f);
    }
  }
}
</script>
