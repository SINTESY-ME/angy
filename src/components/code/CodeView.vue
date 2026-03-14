<template>
  <div class="flex flex-col h-full">
    <CodeViewHeader />
    <div class="flex flex-1 min-h-0">
      <CodeFileTree
        @file-selected="onFileSelected"
        @file-deleted="onFileDeleted"
      />
      <CodeEditorPane ref="editorPaneRef" />

      <!-- Expanded chat panel -->
      <div v-if="codeStore.chatExpanded" class="flex flex-col w-[360px] flex-shrink-0 border-l border-[var(--border-subtle)]">
        <!-- Header bar -->
        <div class="flex items-center h-9 px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <span class="text-[11px] text-txt-muted font-medium">Chat</span>
          <span class="flex-1" />
          <button
            @click="onNewChat"
            class="text-[10px] text-txt-muted hover:text-txt-primary px-1.5 py-0.5 rounded hover:bg-[var(--bg-raised)] transition-colors mr-1"
            title="New chat"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            @click="codeStore.chatExpanded = false"
            class="text-txt-faint hover:text-txt-primary transition-colors p-0.5"
            title="Close chat"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <CodeChatPanel
          ref="chatPanelRef"
          class="flex-1 min-h-0"
          @file-clicked="onFileSelected"
        />
      </div>

      <!-- Collapsed chat bar -->
      <CodeChatCollapsed v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useCodeStore } from '@/stores/code';
import CodeViewHeader from './CodeViewHeader.vue';
import CodeFileTree from './CodeFileTree.vue';
import CodeEditorPane from './CodeEditorPane.vue';
import CodeChatCollapsed from './CodeChatCollapsed.vue';
import CodeChatPanel from './CodeChatPanel.vue';

const ui = useUiStore();
const codeStore = useCodeStore();
const editorPaneRef = ref<InstanceType<typeof CodeEditorPane> | null>(null);
const chatPanelRef = ref<InstanceType<typeof CodeChatPanel> | null>(null);

// Auto-create a fresh chat when the panel is first expanded
watch(() => codeStore.chatExpanded, async (expanded) => {
  if (expanded) {
    await nextTick();
    if (chatPanelRef.value && !chatPanelRef.value.sessionId) {
      chatPanelRef.value.createNewChat();
    }
  }
});

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

async function onNewChat() {
  if (chatPanelRef.value) {
    await chatPanelRef.value.createNewChat();
  }
}
</script>
