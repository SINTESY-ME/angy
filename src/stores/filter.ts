import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useEpicStore } from '@/stores/epics';
import { useProjectsStore } from '@/stores/projects';

export const useFilterStore = defineStore('filter', () => {
  const selectedProjectIds = ref<string[]>([]);
  const pinnedProjectIds = ref<string[]>([]);
  const activePreset = ref<string>('active'); // 'active' | 'my projects' | 'all' | 'none'

  function toggleProject(projectId: string): void {
    const idx = selectedProjectIds.value.indexOf(projectId);
    if (idx === -1) {
      selectedProjectIds.value.push(projectId);
    } else if (selectedProjectIds.value.length > 1) {
      selectedProjectIds.value.splice(idx, 1);
    }
  }
  function applySelection(ids: string[]): void {
    selectedProjectIds.value = [...ids];
  }
  function applyPreset(preset: string): void {
    activePreset.value = preset;
    if (preset === 'active') {
      const epicStore = useEpicStore();
      const projectsStore = useProjectsStore();
      const activeIds = projectsStore.projects
        .filter(p => epicStore.epics.some(e => e.projectId === p.id && e.column === 'in-progress'))
        .map(p => p.id);
      selectedProjectIds.value = activeIds.length > 0 ? activeIds : projectsStore.projects.map(p => p.id);
    } else if (preset === 'my projects' || preset === 'all') {
      selectedProjectIds.value = useProjectsStore().projects.map(p => p.id);
    } else if (preset === 'none') {
      selectedProjectIds.value = [];
    }
  }

  return { selectedProjectIds, pinnedProjectIds, activePreset, toggleProject, applySelection, applyPreset };
});
