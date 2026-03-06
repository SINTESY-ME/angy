<template>
  <div class="flex flex-col h-full bg-[var(--bg-surface)]">
    <div class="px-3 py-2 space-y-1.5 border-b border-[var(--border-subtle)]">
      <input
        v-model="query"
        @keydown.enter="search"
        placeholder="Search text..."
        class="w-full text-xs bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded px-2 py-1.5 outline-none focus:border-[var(--accent-mauve)]"
      />
      <div class="flex gap-2">
        <label class="flex items-center gap-1 text-[10px] text-[var(--text-muted)] cursor-pointer">
          <input type="checkbox" v-model="caseSensitive" class="accent-[var(--accent-mauve)]" /> Case
        </label>
        <label class="flex items-center gap-1 text-[10px] text-[var(--text-muted)] cursor-pointer">
          <input type="checkbox" v-model="useRegex" class="accent-[var(--accent-mauve)]" /> Regex
        </label>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div
        v-if="searching"
        class="flex items-center justify-center h-16 text-xs text-[var(--text-muted)]"
      >
        Searching...
      </div>
      <div
        v-else-if="results.length === 0 && hasSearched"
        class="flex items-center justify-center h-16 text-xs text-[var(--text-faint)]"
      >
        No results
      </div>
      <div
        v-else-if="results.length === 0 && !hasSearched"
        class="flex items-center justify-center h-16 text-xs text-[var(--text-faint)]"
      >
        Type to search
      </div>
      <div
        v-for="result in results"
        :key="result.path + ':' + result.line"
        class="px-3 py-1 cursor-pointer hover:bg-white/[0.03]"
        @click="emit('file-selected', result.path, result.line)"
      >
        <div class="text-xs text-[var(--text-primary)] truncate">{{ result.path }}</div>
        <div class="flex gap-2">
          <span class="text-[10px] text-[var(--text-faint)]">:{{ result.line }}</span>
          <span class="text-[10px] text-[var(--text-muted)] truncate">{{ result.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Command } from '@tauri-apps/plugin-shell';

const props = defineProps<{
  workspacePath: string;
}>();

const emit = defineEmits<{
  'file-selected': [path: string, line?: number];
}>();

const query = ref('');
const caseSensitive = ref(false);
const useRegex = ref(false);
const searching = ref(false);
const hasSearched = ref(false);
const results = ref<{ path: string; line: number; text: string }[]>([]);

async function search() {
  if (!query.value.trim() || !props.workspacePath) return;

  searching.value = true;
  hasSearched.value = true;
  results.value = [];

  try {
    // Try ripgrep first
    const args = ['-n', '--no-heading', '--color=never'];
    if (!caseSensitive.value) args.push('-i');
    if (!useRegex.value) args.push('-F');
    args.push('--max-count=100');
    args.push('--');
    args.push(query.value);
    args.push(props.workspacePath);

    let output: { code: number | null; stdout: string; stderr: string };

    try {
      const cmd = Command.create('rg', args);
      output = await cmd.execute();
    } catch {
      // Fallback to grep
      const grepArgs = ['-rn', '--color=never'];
      if (!caseSensitive.value) grepArgs.push('-i');
      if (!useRegex.value) grepArgs.push('-F');
      grepArgs.push('--');
      grepArgs.push(query.value);
      grepArgs.push(props.workspacePath);
      const grepCmd = Command.create('grep', grepArgs);
      output = await grepCmd.execute();
    }

    if (output.stdout) {
      const lines = output.stdout.split('\n').filter((l: string) => l.trim());
      for (const line of lines.slice(0, 100)) {
        // Parse: filepath:linenum:text
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          results.value.push({
            path: match[1],
            line: parseInt(match[2]),
            text: match[3].trim(),
          });
        }
      }
    }
  } catch (e) {
    console.error('Search failed:', e);
  } finally {
    searching.value = false;
  }
}
</script>
