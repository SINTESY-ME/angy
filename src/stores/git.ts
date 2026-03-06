import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { GitManager, type GitFileEntry, type GitBranchEntry } from '../engine/GitManager';

export const useGitStore = defineStore('git', () => {
  const manager = new GitManager();
  const branch = ref('');
  const entries = ref<GitFileEntry[]>([]);
  const branches = ref<GitBranchEntry[]>([]);

  // Wire manager events to reactive state
  manager.on('branchChanged', (e) => { branch.value = e.branch; });
  manager.on('statusChanged', (e) => { entries.value = [...e.entries]; });
  manager.on('branchesListed', (e) => { branches.value = [...e.branches]; });

  const stagedFiles = computed(() =>
    entries.value.filter(e => e.staged)
  );

  const unstagedFiles = computed(() =>
    entries.value.filter(e => e.workTreeStatus !== ' ')
  );

  function init(workDir: string) {
    manager.setWorkingDirectory(workDir);
  }

  return {
    manager, branch, entries, branches,
    stagedFiles, unstagedFiles,
    init,
  };
});
