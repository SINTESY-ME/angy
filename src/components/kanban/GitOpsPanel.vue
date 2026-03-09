<template>
  <div class="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-x-auto">
    <div v-if="repos.length === 0" class="text-xs text-[var(--text-muted)]">No repos configured</div>

    <div
      v-for="repo in repos"
      :key="repo.id"
      class="flex items-center gap-2 min-w-0 shrink-0"
    >
      <!-- Repo name -->
      <span class="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">{{ repo.name }}</span>

      <!-- Current branch -->
      <div class="relative">
        <select
          class="text-xs pl-2 pr-6 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)]
                 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-mauve)]
                 transition-colors appearance-none cursor-pointer"
          :value="branchInfo(repo.id)?.currentBranch ?? ''"
          :disabled="branchInfo(repo.id)?.loading"
          @change="onCheckout(repo, ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="b in branchInfo(repo.id)?.branches ?? []"
            :key="b"
            :value="b"
          >{{ b }}</option>
        </select>
        <svg class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <!-- Refresh -->
      <button
        class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Refresh branches"
        :disabled="branchInfo(repo.id)?.loading"
        @click="refresh()"
      >
        <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': branchInfo(repo.id)?.loading }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <!-- New branch input -->
      <div class="flex items-center gap-0.5">
        <input
          v-model="newBranchNames[repo.id]"
          placeholder="new branch"
          class="text-xs px-2 py-1 w-24 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)]
                 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                 focus:outline-none focus:border-[var(--accent-mauve)] transition-colors"
          @keydown.enter="onCreateBranch(repo)"
        />
        <button
          class="text-[var(--text-muted)] hover:text-[var(--accent-teal)] transition-colors"
          title="Create branch"
          :disabled="!newBranchNames[repo.id]"
          @click="onCreateBranch(repo)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <!-- Pull / Fetch / Push -->
      <button
        class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Pull"
        @click="onPull(repo)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
      <button
        class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Fetch"
        @click="onFetch(repo)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
      <button
        class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        title="Push"
        @click="onPush(repo)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>

      <!-- Feedback -->
      <span v-if="feedback[repo.id]" class="text-[10px] whitespace-nowrap" :class="feedback[repo.id]!.ok ? 'text-green-400' : 'text-red-400'">
        {{ feedback[repo.id]!.msg }}
      </span>

      <!-- Separator between repos -->
      <div v-if="repos.indexOf(repo) < repos.length - 1" class="w-px h-5 bg-[var(--border-subtle)] mx-1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, onMounted, watch } from 'vue';
import { useProjectsStore } from '@/stores/projects';
import { useMultiRepoGit, type RepoBranchInfo } from '@/composables/useMultiRepoGit';
import type { ProjectRepo } from '@/engine/KosTypes';

const props = defineProps<{ projectId: string }>();

const projectsStore = useProjectsStore();
const multiRepo = useMultiRepoGit();

const newBranchNames = reactive<Record<string, string>>({});
const feedback = reactive<Record<string, { ok: boolean; msg: string } | null>>({});

const repos = computed(() => projectsStore.reposByProjectId(props.projectId));

function branchInfo(repoId: string): RepoBranchInfo | undefined {
  return multiRepo.repoBranches.get(repoId);
}

function repoArgs() {
  return repos.value.map(r => ({ id: r.id, name: r.name, path: r.path }));
}

async function refresh() {
  await multiRepo.refreshAllBranches(repoArgs());
}

function showFeedback(repoId: string, ok: boolean, msg: string) {
  feedback[repoId] = { ok, msg };
  setTimeout(() => { feedback[repoId] = null; }, 3000);
}

async function onCheckout(repo: ProjectRepo, branchName: string) {
  const result = await multiRepo.checkoutInRepo(repo.path, branchName);
  if (result.success) {
    showFeedback(repo.id, true, `on ${branchName}`);
  } else {
    showFeedback(repo.id, false, result.error ?? 'checkout failed');
  }
}

async function onCreateBranch(repo: ProjectRepo) {
  const name = newBranchNames[repo.id]?.trim();
  if (!name) return;
  const result = await multiRepo.createBranchInRepo(repo.path, name);
  if (result.success) {
    newBranchNames[repo.id] = '';
    showFeedback(repo.id, true, `created ${name}`);
  } else {
    showFeedback(repo.id, false, result.error ?? 'create failed');
  }
}

async function onPull(repo: ProjectRepo) {
  const result = await multiRepo.pullRepo(repo.path);
  showFeedback(repo.id, result.success, result.success ? 'pulled' : (result.error ?? 'pull failed'));
}

async function onFetch(repo: ProjectRepo) {
  const result = await multiRepo.fetchRepo(repo.path);
  showFeedback(repo.id, result.success, result.success ? 'fetched' : (result.error ?? 'fetch failed'));
}

async function onPush(repo: ProjectRepo) {
  const result = await multiRepo.pushRepo(repo.path);
  showFeedback(repo.id, result.success, result.success ? 'pushed' : (result.error ?? 'push failed'));
}

onMounted(() => {
  if (repos.value.length > 0) {
    refresh();
  }
});

watch(() => props.projectId, () => {
  refresh();
});

defineExpose({ refresh });
</script>
