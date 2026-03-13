<template>
  <div
    class="project-card group relative bg-[var(--bg-surface)] border rounded-[var(--radius-md)] overflow-hidden"
    :style="isAssigned ? { boxShadow: '0 0 0 1px var(--accent-mauve)' } : { boxShadow: 'var(--shadow-sm)' }"
    :class="isAssigned
      ? 'border-[var(--accent-mauve)]'
      : 'border-[var(--border-subtle)] hover:border-[var(--border-standard)]'"
  >
    <!-- Main card body -->
    <div class="relative p-4 cursor-pointer active:scale-[0.98]" @click="ui.navigateToKanban(project.id)">
      <!-- Header -->
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <!-- Active instance indicator -->
          <div
            v-if="isAssigned"
            class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--accent-mauve)]"
          />
          <h3 class="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">{{ project.name }}</h3>
        </div>
        <!-- Settings (three-dot menu) -->
        <button
          class="flex-shrink-0 p-1 -mr-1 -mt-1 text-[var(--text-faint)] hover:text-[var(--text-secondary)] rounded hover:bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
          title="Project settings"
          @click.stop="$emit('open-settings')"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="3" r="1.2"/>
            <circle cx="7" cy="7" r="1.2"/>
            <circle cx="7" cy="11" r="1.2"/>
          </svg>
        </button>
      </div>

      <!-- Description -->
      <p v-if="project.description" class="text-[var(--text-xs)] text-[var(--text-muted)] mt-2 line-clamp-2 leading-relaxed">
        {{ project.description }}
      </p>

      <!-- Stats -->
      <div class="flex items-center gap-3 mt-3 text-[var(--text-xs)] text-[var(--text-faint)]">
        <span class="flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {{ repoCount }} {{ repoCount === 1 ? 'repo' : 'repos' }}
        </span>
        <span v-if="epicTotal > 0" class="flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span v-if="epicActive > 0" class="text-[var(--accent-mauve)]">{{ epicActive }} active</span>
          <span v-if="epicActive > 0"> / </span>
          {{ epicTotal }} epics
        </span>
      </div>

      <!-- Hover overlay: quick action buttons -->
      <div class="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-faint)] hover:text-[var(--accent-mauve)] hover:bg-[color-mix(in_srgb,var(--accent-mauve)_8%,transparent)] transition-colors"
          title="Go to Kanban"
          @click.stop="ui.navigateToKanban(project.id)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-faint)] hover:text-[var(--accent-blue)] hover:bg-[color-mix(in_srgb,var(--accent-blue)_8%,transparent)] transition-colors"
          title="Go to Code"
          @click.stop="goToCode()"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-faint)] hover:text-[var(--accent-peach)] hover:bg-[color-mix(in_srgb,var(--accent-peach)_8%,transparent)] transition-colors"
          title="Go to Agent Fleet"
          @click.stop="goToFleet()"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="10" rx="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11V8a3 3 0 016 0v3"/>
            <circle cx="9" cy="16" r="1" fill="currentColor"/>
            <circle cx="15" cy="16" r="1" fill="currentColor"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19h6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Project } from '@/engine/KosTypes';
import { useUiStore } from '@/stores/ui';
import { useProjectsStore } from '@/stores/projects';
import { useEpicStore } from '@/stores/epics';

const props = defineProps<{
  project: Project;
}>();

defineEmits<{
  'open-settings': [];
}>();

const ui = useUiStore();
const projectsStore = useProjectsStore();
const epicStore = useEpicStore();

const repoCount = computed(() => projectsStore.reposByProjectId(props.project.id).length);
const isAssigned = computed(() => ui.activeProjectId === props.project.id);

const projectEpics = computed(() => epicStore.epicsByProject(props.project.id));
const epicTotal = computed(() => projectEpics.value.length);
const epicActive = computed(() => projectEpics.value.filter(e => e.column === 'in-progress').length);

function goToCode() {
  ui.activeProjectId = props.project.id;
  const repos = projectsStore.reposByProjectId(props.project.id);
  if (repos.length > 0) {
    ui.workspacePath = repos[0].path;
  }
  ui.switchToMode('editor');
}

function goToFleet() {
  ui.activeProjectId = props.project.id;
  const repos = projectsStore.reposByProjectId(props.project.id);
  if (repos.length > 0) {
    ui.workspacePath = repos[0].path;
  }
  ui.switchToMode('manager');
}
</script>

<style scoped>
.project-card {
  transition: all var(--transition-fast);
}
.project-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
</style>
