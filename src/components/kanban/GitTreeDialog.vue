<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="w-[780px] max-h-[85vh] bg-[var(--bg-window)] border border-[var(--border-subtle)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-[var(--accent-teal)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="6" y1="3" x2="6" y2="15"/>
              <circle cx="18" cy="6" r="3"/>
              <circle cx="6" cy="18" r="3"/>
              <path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
            <h2 class="text-sm font-semibold text-[var(--text-primary)]">Git Branch Tree</h2>
          </div>
          <button
            class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            @click="$emit('close')"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body: Hybrid layout - SVG rail + commit list -->
        <div class="flex-1 overflow-auto">
          <div v-if="loading && nodes.length === 0" class="flex items-center justify-center py-12">
            <span class="text-xs text-[var(--text-muted)]">Loading...</span>
          </div>
          <div v-else class="flex min-h-0" :style="{ height: graphHeight + 'px' }">
            <!-- Left: SVG Rail -->
            <div class="flex-shrink-0" :style="{ width: graphWidth + 'px' }">
              <GitGraphRail :nodes="nodes" :edges="edges" :width="graphWidth" :height="graphHeight" />
            </div>
            <!-- Right: Commit list -->
            <div class="flex-1 min-w-0">
              <div
                v-for="node in nodes"
                :key="node.commit.hash"
                class="flex items-center gap-2 px-3 hover:bg-[var(--bg-raised)] transition-colors group"
                :style="{ height: ROW_HEIGHT + 'px' }"
              >
                <!-- Branch labels (pills) -->
                <span
                  v-for="ref in node.commit.refs"
                  :key="ref"
                  class="text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                  :style="{ borderColor: node.color, color: node.color, backgroundColor: 'var(--bg-raised)' }"
                >
                  {{ formatRef(ref) }}
                </span>
                <!-- Commit message -->
                <span class="text-xs text-[var(--text-primary)] truncate">{{ node.commit.subject }}</span>
                <!-- Short hash -->
                <span class="text-[10px] text-[var(--text-muted)] font-mono ml-auto flex-shrink-0">{{ node.commit.shortHash }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, computed, toRef, ref, onMounted, onUnmounted } from 'vue';
import { useGitStore } from '@/stores/git';
import { useProjectsStore } from '@/stores/projects';
import { useUiStore } from '@/stores/ui';
import { useGitGraph, ROW_HEIGHT } from '@/composables/useGitGraph';
import GitGraphRail from './GitGraphRail.vue';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ close: [] }>();

const gitStore = useGitStore();
const projectsStore = useProjectsStore();
const ui = useUiStore();

const loading = ref(false);
const commits = toRef(gitStore, 'commits');
const { nodes, edges, width: graphWidth, height: graphHeight } = useGitGraph(commits);

const workDir = computed(() => {
  const projectId = ui.kanbanProjectIds[0];
  if (!projectId) return '';
  const repos = projectsStore.reposByProjectId(projectId);
  return repos.length > 0 ? repos[0].path : '';
});

watch(() => props.visible, (v) => {
  if (v && workDir.value) {
    loading.value = true;
    gitStore.fetchLog(workDir.value);
  }
});

watch(commits, () => {
  loading.value = false;
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function formatRef(ref: string): string {
  return ref
    .replace(/^HEAD\s*->\s*/, '')
    .replace(/^origin\//, '');
}
</script>
