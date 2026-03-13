<template>
  <div class="flex flex-col flex-1 min-w-0 bg-[var(--bg-base)]">
    <!-- Tab bar -->
    <div v-if="tabs.length > 0" class="h-9 flex items-end border-b border-[var(--border-subtle)] px-1 bg-[var(--bg-surface)] overflow-x-auto">
      <div
        v-for="tab in tabs"
        :key="tab.filePath"
        class="group flex items-center gap-1 px-3 py-1.5 text-[11px] cursor-pointer whitespace-nowrap select-none"
        :class="tab.filePath === activeFile
          ? 'bg-[var(--bg-surface)] text-txt-primary border-b-2 border-ember-500'
          : 'text-txt-muted hover:text-txt-secondary'"
        @click="codeViewerRef?.loadFile(tab.filePath)"
        @mousedown.middle.prevent="codeViewerRef?.closeFile(tab.filePath)"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" v-if="tab.dirty" />
        <span>{{ fileName(tab.filePath) }}</span>
        <span
          @click.stop="codeViewerRef?.closeFile(tab.filePath)"
          @mousedown.prevent
          class="ml-1 text-txt-faint hover:text-txt-muted opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
        >&times;</span>
      </div>
    </div>

    <!-- Breadcrumb bar -->
    <div v-if="activeFile" class="px-4 py-1 text-[10px] text-txt-faint border-b border-[var(--border-subtle)] flex items-center gap-1 overflow-hidden">
      <template v-for="(segment, i) in pathSegments" :key="i">
        <span v-if="i > 0" class="text-txt-faint">&rsaquo;</span>
        <span :class="i === pathSegments.length - 1 ? 'text-txt-muted' : 'text-txt-faint'">{{ segment }}</span>
      </template>
    </div>

    <!-- Editor -->
    <CodeViewer ref="codeViewerRef" :hideChrome="true" class="flex-1 min-h-0" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useUiStore } from '@/stores/ui';
import CodeViewer from '@/components/editor/CodeViewer.vue';

const ui = useUiStore();
const codeViewerRef = ref<InstanceType<typeof CodeViewer> | null>(null);

const tabs = computed(() => codeViewerRef.value?.tabs ?? []);
const activeFile = computed(() => codeViewerRef.value?.activeFile ?? '');

const pathSegments = computed(() => {
  if (!activeFile.value) return [];
  return activeFile.value.split('/').filter(Boolean);
});

function fileName(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

watch(activeFile, (val) => {
  ui.currentFile = val;
});

function loadFile(filePath: string) { codeViewerRef.value?.loadFile(filePath); }
function closeFile(filePath: string) { codeViewerRef.value?.closeFile(filePath); }
function openFiles(): string[] { return codeViewerRef.value?.openFiles() ?? []; }

defineExpose({ loadFile, closeFile, openFiles });
</script>
