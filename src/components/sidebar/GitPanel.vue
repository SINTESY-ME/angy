<template>
  <div class="flex flex-col h-full bg-[var(--bg-base)]">
    <!-- Branch header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
      <div class="flex items-center gap-1.5">
        <span class="text-[var(--accent-green)] text-sm">&#x2387;</span>
        <span class="text-sm font-medium text-[var(--text-primary)]">{{ git.branch || 'No branch' }}</span>
      </div>
      <button @click="git.manager.refreshStatus()" class="text-xs p-1 rounded hover:bg-white/[0.05] text-[var(--text-muted)]" title="Refresh">&#x21bb;</button>
    </div>

    <!-- File sections -->
    <div class="flex-1 overflow-y-auto">
      <!-- Staged Changes -->
      <div v-if="git.stagedFiles.length > 0">
        <div class="flex items-center justify-between px-3 py-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Staged Changes ({{ git.stagedFiles.length }})</span>
          <button @click="git.manager.unstageAll()" class="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Unstage All</button>
        </div>
        <div v-for="entry in git.stagedFiles" :key="'s-' + entry.path"
             class="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-white/[0.03]"
             @click="onFileClick(entry.path, true)">
          <span class="text-xs w-4 text-center font-bold" :class="statusColor(entry.indexStatus)">{{ entry.indexStatus }}</span>
          <span class="text-xs text-[var(--text-primary)] flex-1 truncate">{{ entry.path }}</span>
          <button @click.stop="git.manager.unstageFile(entry.path)" class="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">&minus;</button>
        </div>
      </div>

      <!-- Working Tree Changes -->
      <div v-if="unstaged.length > 0">
        <div class="flex items-center justify-between px-3 py-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Changes ({{ unstaged.length }})</span>
          <button @click="git.manager.stageAll()" class="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Stage All</button>
        </div>
        <div v-for="entry in unstaged" :key="'u-' + entry.path"
             class="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-white/[0.03]"
             @click="onFileClick(entry.path, false)">
          <span class="text-xs w-4 text-center font-bold" :class="statusColor(entry.workTreeStatus)">{{ entry.workTreeStatus }}</span>
          <span class="text-xs text-[var(--text-primary)] flex-1 truncate">{{ entry.path }}</span>
          <div class="flex gap-0.5">
            <button @click.stop="git.manager.stageFile(entry.path)" class="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-green)]" title="Stage">+</button>
            <button @click.stop="git.manager.discardFile(entry.path)" class="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-red)]" title="Discard">&times;</button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="git.entries.length === 0" class="flex flex-col items-center justify-center h-32 text-center">
        <div class="text-xs text-[var(--text-muted)]">No changes</div>
      </div>
    </div>

    <!-- Commit area -->
    <div class="border-t border-[var(--border-subtle)] px-3 py-2 space-y-2">
      <textarea v-model="commitMessage" placeholder="Commit message..."
                class="w-full text-xs bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded px-2 py-1.5 resize-none outline-none focus:border-[var(--accent-mauve)]"
                rows="2" />
      <div class="flex gap-1">
        <button @click="doCommit" :disabled="!commitMessage.trim() || git.stagedFiles.length === 0"
                class="flex-1 text-xs py-1 rounded bg-[var(--accent-mauve)] text-[var(--bg-base)] font-medium disabled:opacity-30">
          Commit
        </button>
      </div>
      <div class="flex gap-1">
        <button @click="git.manager.fetch()" class="flex-1 text-xs py-1 rounded bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Fetch</button>
        <button @click="git.manager.push()" class="flex-1 text-xs py-1 rounded bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Push</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGitStore } from '../../stores/git';

const git = useGitStore();
const commitMessage = ref('');

const emit = defineEmits<{
  fileClicked: [filePath: string, staged: boolean];
}>();

const unstaged = computed(() =>
  git.entries.filter(e => e.workTreeStatus !== ' ')
);

function statusColor(status: string) {
  switch (status) {
    case 'M': return 'text-[var(--accent-yellow)]';
    case 'A': return 'text-[var(--accent-green)]';
    case 'D': return 'text-[var(--accent-red)]';
    case 'R': case 'C': return 'text-[var(--accent-blue)]';
    case '?': return 'text-[var(--text-muted)]';
    case 'U': return 'text-[var(--accent-peach)]';
    default: return 'text-[var(--text-faint)]';
  }
}

function onFileClick(filePath: string, staged: boolean) {
  emit('fileClicked', filePath, staged);
  git.manager.requestFileDiff(filePath, staged);
}

async function doCommit() {
  if (!commitMessage.value.trim()) return;
  await git.manager.commit(commitMessage.value.trim());
  commitMessage.value = '';
}
</script>
