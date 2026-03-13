import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useProjectsStore } from './projects';
import { useUiStore } from './ui';
import type { ProjectRepo } from '@/engine/KosTypes';

export const useCodeStore = defineStore('code', () => {
  const activeRepoId = ref<string | null>(null);
  const leftPanelTab = ref<'files' | 'git' | 'search'>('files');
  const chatExpanded = ref(false);

  const activeRepo = computed<ProjectRepo | undefined>(() => {
    if (!activeRepoId.value) return undefined;
    const projectsStore = useProjectsStore();
    return projectsStore.repos.find(r => r.id === activeRepoId.value);
  });

  function selectRepo(repoId: string) {
    const projectsStore = useProjectsStore();
    const ui = useUiStore();
    const repo = projectsStore.repos.find(r => r.id === repoId);
    if (!repo) return;
    activeRepoId.value = repoId;
    if (repo.path !== ui.workspacePath) {
      ui.repoSwitchOnly = true;
      ui.workspacePath = repo.path;
    }
  }

  return {
    activeRepoId, leftPanelTab, chatExpanded,
    activeRepo,
    selectRepo,
  };
});
