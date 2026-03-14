<template>
  <div class="flex flex-col h-full bg-base border-r border-border-subtle w-72 flex-shrink-0">
    <!-- Fleet header -->
    <div class="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-txt-muted">Fleet</span>
        <span class="text-[10px] text-txt-faint">{{ fleetStore.agents.length }} total</span>
      </div>
      <div class="flex items-center gap-0.5">
        <!-- Search -->
        <button class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-txt-muted hover:bg-raised hover:text-txt-primary transition-colors">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
        </button>
        <!-- Menu -->
        <button class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-txt-muted hover:bg-raised hover:text-txt-primary transition-colors">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="13" r="1.2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-1 px-3 py-2 border-b border-border-subtle">
      <button
        v-for="tab in filterTabs"
        :key="tab.key"
        class="text-[10px] px-2 py-0.5 rounded-full transition-colors"
        :class="activeFilter === tab.key
          ? 'bg-ember-500/15 text-ember-400'
          : 'text-txt-muted hover:text-txt-secondary'"
        @click="activeFilter = tab.key"
      >{{ tab.label }}</button>
    </div>

    <!-- Scrollable agent list -->
    <div class="flex-1 overflow-y-auto py-2">
      <template v-if="filteredGroups.length > 0">
        <div v-for="group in filteredGroups" :key="group.projectId" class="mb-1">
          <!-- Project section header -->
          <button
            class="w-full px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-white/[0.03] transition-colors"
            @click="toggleGroup(group.projectId)"
          >
            <!-- Chevron -->
            <svg
              class="w-2.5 h-2.5 text-txt-muted flex-shrink-0 transition-transform duration-150"
              :class="collapsedGroups.has(group.projectId) ? '' : 'rotate-90'"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M3 1l4 4-4 4" />
            </svg>
            <!-- Color dot -->
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ backgroundColor: group.projectColor }"
            />
            <!-- Name -->
            <span
              class="text-[11px] font-medium truncate"
              :class="group.projectId === '__orchestrators__' ? 'uppercase tracking-wider text-txt-muted' : 'text-txt-secondary'"
            >{{ group.projectId === '__orchestrators__' ? 'Orchestrators' : group.projectName }}</span>
            <!-- Running count badge -->
            <span
              v-if="group.runningCount > 0"
              class="text-[9px] px-1.5 rounded-full bg-teal/10 text-teal flex-shrink-0"
            >{{ group.runningCount }}</span>
          </button>

          <!-- Agent rows -->
          <div v-if="!collapsedGroups.has(group.projectId)" class="space-y-0.5 px-1">
            <FleetAgentRow
              v-for="agent in group.agents"
              :key="agent.sessionId"
              :agent="agent"
              :selected="fleetStore.selectedAgentId === agent.sessionId"
              class="anim-fade-in"
              @agent-selected="onAgentSelected"
            />
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center h-32 text-center px-6"
      >
        <svg class="w-6 h-6 mb-2 opacity-30 text-txt-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
        <span class="text-[11px] text-txt-muted">
          {{ activeFilter === 'all' ? 'No agents yet' : 'No matching agents' }}
        </span>
        <span class="text-[10px] text-txt-faint mt-1">
          {{ activeFilter === 'all' ? 'Press \u2318N or click + to start your first AI agent conversation.' : 'Try a different filter' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFleetStore } from '../../stores/fleet';
import { useFilterStore } from '../../stores/filter';
import type { HierarchicalAgent } from '../../stores/fleet';
import FleetAgentRow from './FleetAgentRow.vue';

type FilterKey = 'all' | 'running' | 'done' | 'failed';

const emit = defineEmits<{
  'agent-selected': [sessionId: string];
}>();

const fleetStore = useFleetStore();
const filterStore = useFilterStore();
const activeFilter = ref<FilterKey>('all');
const collapsedGroups = ref<Set<string>>(new Set());

const filterTabs: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
];

// Map display filter keys to actual AgentStatus values
function matchesFilter(agent: HierarchicalAgent): boolean {
  switch (activeFilter.value) {
    case 'all': return true;
    case 'running': return agent.status === 'working';
    case 'done': return agent.status === 'done';
    case 'failed': return agent.status === 'error';
  }
}

const filteredGroups = computed(() => {
  const selectedProjects = filterStore.selectedProjectIds;
  return fleetStore.agentsGroupedByProject
    .filter((group) =>
      selectedProjects.length === 0 ||
      group.projectId === '__orchestrators__' ||
      selectedProjects.includes(group.projectId),
    )
    .map((group) => ({
      ...group,
      agents: group.agents.filter(matchesFilter),
      runningCount: group.agents.filter((a) => a.status === 'working').length,
    }))
    .filter((group) => group.agents.length > 0);
});

function toggleGroup(projectId: string) {
  if (collapsedGroups.value.has(projectId)) {
    collapsedGroups.value.delete(projectId);
  } else {
    collapsedGroups.value.add(projectId);
  }
}

function onAgentSelected(sessionId: string) {
  fleetStore.selectAgent(sessionId);
  emit('agent-selected', sessionId);
}
</script>
