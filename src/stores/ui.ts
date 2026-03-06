import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ViewMode = 'manager' | 'editor';

export const useUiStore = defineStore('ui', () => {
  const viewMode = ref<ViewMode>('manager');
  const terminalVisible = ref(false);
  const activeLeftTab = ref<'files' | 'git' | 'search'>('files');
  const workspacePath = ref('');
  const currentFile = ref('');
  const currentBranch = ref('');
  const currentModel = ref('claude-sonnet-4-6');
  const isProcessing = ref(false);
  const inlinePreviewFile = ref<string | null>(null);
  const effectsPanelVisible = ref(true);
  const editorChatVisible = ref(true);

  // Splitter sizes for each mode (pixel hints, splitpanes uses percentages)
  const managerSizes = ref([220, 0, 0, -1, 300]);
  const editorSizes = ref([40, 210, -1, 320, 0]);

  function switchToMode(mode: ViewMode) {
    viewMode.value = mode;
  }

  function toggleViewMode() {
    switchToMode(viewMode.value === 'manager' ? 'editor' : 'manager');
  }

  function toggleTerminal() {
    terminalVisible.value = !terminalVisible.value;
  }

  function dismissInlinePreview() {
    inlinePreviewFile.value = null;
  }

  function toggleEffectsPanel() {
    effectsPanelVisible.value = !effectsPanelVisible.value;
  }

  function toggleEditorChat() {
    editorChatVisible.value = !editorChatVisible.value;
  }

  return {
    viewMode, terminalVisible, activeLeftTab,
    workspacePath, currentFile, currentBranch, currentModel, isProcessing,
    inlinePreviewFile, effectsPanelVisible, editorChatVisible,
    managerSizes, editorSizes,
    switchToMode, toggleViewMode, toggleTerminal, dismissInlinePreview,
    toggleEffectsPanel, toggleEditorChat,
  };
});
