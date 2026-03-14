<template>
  <div class="flex items-center gap-2 h-9 overflow-hidden">
    <!-- Prefix label -->
    <span class="text-[10px] text-txt-faint uppercase tracking-wider mr-1 flex-shrink-0">Projects:</span>

    <!-- Visible chips -->
    <template v-for="project in visibleProjects" :key="project.id">
      <!-- Selected chip -->
      <button
        v-if="selectedIds.includes(project.id)"
        class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors flex-shrink-0 cursor-pointer"
        :style="selectedChipStyle(project.color)"
        @click="onToggle(project.id)"
      >
        <span
          class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: project.color || 'var(--accent-ember)' }"
        />
        {{ project.name }}
        <span
          v-if="showAgentCounts && agentRunningCount(project.id) > 0"
          class="text-[9px] font-mono ml-0.5"
          :style="{ color: `color-mix(in srgb, ${project.color || 'var(--accent-ember)'} 50%, transparent)` }"
        >{{ agentRunningCount(project.id) }}</span>
        <span
          class="ml-0.5 leading-none opacity-60 hover:opacity-100"
          @click.stop="onRemove(project.id)"
        >&times;</span>
      </button>

      <!-- Unselected chip -->
      <button
        v-else
        class="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border-standard text-txt-faint text-[10px] hover:border-txt-faint hover:text-txt-muted transition-colors flex-shrink-0 cursor-pointer"
        @click="onToggle(project.id)"
      >
        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-txt-faint/40" />
        {{ project.name }}
        <span
          v-if="showAgentCounts && agentRunningCount(project.id) > 0"
          class="text-[9px] font-mono text-txt-faint ml-0.5"
        >{{ agentRunningCount(project.id) }}</span>
      </button>
    </template>

    <!-- Overflow button -->
    <button
      v-if="overflowCount > 0"
      ref="overflowBtnEl"
      class="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-raised hover:bg-raised-hover text-txt-secondary border border-border-standard text-[10px] transition-colors flex-shrink-0 cursor-pointer"
      @click="togglePopover"
    >
      +{{ overflowCount }} more
      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Preset button -->
    <button
      class="flex items-center gap-1 px-2 py-0.5 rounded-md bg-raised hover:bg-raised-hover text-[10px] text-txt-secondary flex-shrink-0 cursor-pointer transition-colors"
      @click="cyclePreset"
    >
      Show: {{ presetLabel }}
      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <!-- Popover -->
    <PopoverPanel
      v-if="popoverOpen"
      :id="popoverId"
      mode="multi"
      :groups="popoverGroups"
      :selected-ids="selectedIds"
      :footer-text="selectedIds.length + ' of ' + projects.length + ' selected'"
      :panel-style="popoverStyle"
      @toggle="onToggle"
      @close="popoverOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import PopoverPanel from './PopoverPanel.vue';
import { useFleetStore } from '../../stores/fleet';
import { useFilterStore } from '../../stores/filter';

interface ProjectItem {
  id: string;
  name: string;
  color?: string;
}

const props = withDefaults(defineProps<{
  selectedIds: string[];
  projects: ProjectItem[];
  pinnedCount?: number;
  showAgentCounts?: boolean;
  popoverId: string;
}>(), {
  pinnedCount: 3,
  showAgentCounts: false,
});

const emit = defineEmits<{
  toggle: [projectId: string];
  remove: [projectId: string];
}>();

const popoverOpen = ref(false);
const overflowBtnEl = ref<HTMLElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});

const fleetStore = useFleetStore();
const filterStore = useFilterStore();

const presetCycle = ['active', 'all', 'none'] as const;

const presetLabel = computed(() => {
  const p = filterStore.activePreset;
  if (p === 'active') return 'Active';
  if (p === 'all') return 'All';
  if (p === 'none') return 'None';
  if (p === 'my projects') return 'My Projects';
  return p.charAt(0).toUpperCase() + p.slice(1);
});

function cyclePreset() {
  const currentIdx = presetCycle.indexOf(filterStore.activePreset as typeof presetCycle[number]);
  const nextIdx = (currentIdx + 1) % presetCycle.length;
  filterStore.applyPreset(presetCycle[nextIdx]);
}

function agentRunningCount(projectId: string): number {
  if (!props.showAgentCounts) return 0;
  const group = fleetStore.agentsGroupedByProject.find((g) => g.projectId === projectId);
  return group?.runningCount ?? 0;
}

const sortedProjects = computed(() => {
  const selected = props.projects.filter(p => props.selectedIds.includes(p.id));
  const unselected = props.projects.filter(p => !props.selectedIds.includes(p.id));
  return [...selected, ...unselected];
});
const effectivePinnedCount = computed(() =>
  Math.max(props.pinnedCount, props.projects.filter(p => props.selectedIds.includes(p.id)).length),
);
const visibleProjects = computed(() => sortedProjects.value.slice(0, effectivePinnedCount.value));
const overflowCount = computed(() => Math.max(0, sortedProjects.value.length - effectivePinnedCount.value));

const popoverGroups = computed(() => [{
  label: '',
  items: props.projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
  })),
}]);

function selectedChipStyle(color?: string) {
  const c = color || 'var(--accent-ember)';
  return {
    backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`,
    color: c,
    borderColor: `color-mix(in srgb, ${c} 25%, transparent)`,
  };
}

function onToggle(projectId: string) {
  emit('toggle', projectId);
}

function onRemove(projectId: string) {
  emit('remove', projectId);
}

async function togglePopover() {
  if (popoverOpen.value) {
    popoverOpen.value = false;
    return;
  }
  // Compute position from overflow button
  if (overflowBtnEl.value) {
    const rect = overflowBtnEl.value.getBoundingClientRect();
    let left = Math.max(56, rect.left);
    let top = rect.bottom + 4;
    popoverStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
    };
    popoverOpen.value = true;
    await nextTick();
    // Viewport clamping after popover renders
    const popEl = overflowBtnEl.value?.closest('.flex')?.querySelector('.fixed');
    if (popEl) {
      const popRect = popEl.getBoundingClientRect();
      if (popRect.right > window.innerWidth - 8) {
        left = window.innerWidth - 8 - popRect.width;
      }
      if (popRect.bottom > window.innerHeight - 8) {
        top = rect.top - popRect.height - 4;
      }
      popoverStyle.value = {
        top: `${top}px`,
        left: `${left}px`,
      };
    }
  } else {
    popoverOpen.value = true;
  }
}
</script>
