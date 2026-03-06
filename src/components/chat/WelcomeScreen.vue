<template>
  <div class="flex flex-col items-center justify-center h-full text-center px-8">
    <!-- Logo area -->
    <div class="w-16 h-16 rounded-2xl bg-[color-mix(in_srgb,var(--accent-mauve)_12%,transparent)] flex items-center justify-center mb-4 overflow-hidden">
      <img src="/angylogo.png" alt="Angy" class="w-12 h-12 object-contain" />
    </div>
    <div class="text-xl font-bold text-[var(--text-primary)] mb-1">Angy</div>
    <div class="text-xs text-[var(--text-muted)] mb-6">Agent Fleet Manager</div>

    <!-- Workspace indicator -->
    <div v-if="ui.workspacePath" class="mb-5 px-4 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <div class="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-0.5">Workspace</div>
      <div class="text-sm text-[var(--text-secondary)] font-mono">{{ workspaceLabel }}</div>
    </div>

    <button
      @click="openFolder"
      class="mb-6 px-5 py-2.5 rounded-lg bg-[color-mix(in_srgb,var(--accent-mauve)_12%,transparent)] border border-[color-mix(in_srgb,var(--accent-mauve)_30%,transparent)] text-sm text-[var(--accent-mauve)] hover:bg-[color-mix(in_srgb,var(--accent-mauve)_20%,transparent)] transition-colors font-medium"
    >
      {{ ui.workspacePath ? 'Change Workspace' : 'Open Workspace' }}
    </button>

    <!-- Keyboard hints -->
    <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-[var(--text-muted)]">
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[10px] font-mono border border-[var(--border-subtle)]">⌘N</kbd>
        <span>New agent</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[10px] font-mono border border-[var(--border-subtle)]">⌘E</kbd>
        <span>Toggle editor</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[10px] font-mono border border-[var(--border-subtle)]">@</kbd>
        <span>Mention file</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[10px] font-mono border border-[var(--border-subtle)]">/</kbd>
        <span>Commands</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { useUiStore } from '../../stores/ui';

const ui = useUiStore();

const workspaceLabel = computed(() => {
  if (!ui.workspacePath) return '';
  const parts = ui.workspacePath.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || ui.workspacePath;
});

async function openFolder() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Workspace Folder',
  });
  if (selected && typeof selected === 'string') {
    ui.workspacePath = selected;
  }
}
</script>
