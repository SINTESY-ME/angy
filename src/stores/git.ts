import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { GitManager, type GitFileEntry, type GitBranchEntry, type GitCommitEntry } from '../engine/GitManager';

export const useGitStore = defineStore('git', () => {
  const manager = new GitManager();
  const branch = ref('');
  const entries = ref<GitFileEntry[]>([]);
  const branches = ref<GitBranchEntry[]>([]);
  const commits = ref<GitCommitEntry[]>([]);

  // Wire manager events to reactive state
  manager.on('branchChanged', (e) => { branch.value = e.branch; });
  manager.on('statusChanged', (e) => { entries.value = [...e.entries]; });
  manager.on('branchesListed', (e) => { branches.value = [...e.branches]; });
  manager.on('logReady', (e) => { commits.value = [...e.commits]; });

  const stagedFiles = computed(() =>
    entries.value.filter(e => e.staged)
  );

  const unstagedFiles = computed(() =>
    entries.value.filter(e => e.workTreeStatus !== ' ')
  );

  function init(workDir: string) {
    manager.setWorkingDirectory(workDir);
  }

  function fetchLog(workDir: string) {
    manager.fetchLog(workDir);
  }

  return {
    manager, branch, entries, branches, commits,
    stagedFiles, unstagedFiles,
    init, fetchLog,
  };
});
