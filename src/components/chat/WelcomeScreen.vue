<template>
  <div class="flex flex-col items-center justify-center h-full text-center px-8">
    <div class="text-[20px] font-bold text-[var(--text-primary)] mb-1">What would you like to build?</div>
    <p class="text-[12px] text-[var(--text-muted)] mb-6 max-w-[400px]">Ask your agent to write code, fix bugs, refactor, or explain anything in your workspace.</p>

    <!-- Quick-start suggestions -->
    <div class="flex flex-wrap justify-center gap-2 mb-6 max-w-[420px]">
      <button @click="$emit('prefill', ($event.currentTarget as HTMLElement).textContent)" class="px-3 py-1.5 text-[var(--text-xs)] rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-raised)] hover:border-[var(--accent-mauve)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">Write a feature</button>
      <button @click="$emit('prefill', ($event.currentTarget as HTMLElement).textContent)" class="px-3 py-1.5 text-[var(--text-xs)] rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-raised)] hover:border-[var(--accent-mauve)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">Fix a bug</button>
      <button @click="$emit('prefill', ($event.currentTarget as HTMLElement).textContent)" class="px-3 py-1.5 text-[var(--text-xs)] rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-raised)] hover:border-[var(--accent-mauve)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">Explain code</button>
      <button @click="$emit('prefill', ($event.currentTarget as HTMLElement).textContent)" class="px-3 py-1.5 text-[var(--text-xs)] rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-raised)] hover:border-[var(--accent-mauve)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">Refactor</button>
    </div>

    <!-- Keyboard hints -->
    <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-[var(--text-xs)] text-[var(--text-muted)] mb-5">
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[var(--text-xs)] font-mono border border-[var(--border-subtle)]">{{ modKey }}N</kbd>
        <span>New agent</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[var(--text-xs)] font-mono border border-[var(--border-subtle)]">{{ modKey }}E</kbd>
        <span>Toggle editor</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[var(--text-xs)] font-mono border border-[var(--border-subtle)]">@</kbd>
        <span>Mention file</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-faint)] text-[var(--text-xs)] font-mono border border-[var(--border-subtle)]">/</kbd>
        <span>Commands</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { getModKey } from '@/engine/platform';

defineEmits<{ prefill: [text: string] }>();

const modKey = ref('⌘');
getModKey().then(k => { modKey.value = k; });
</script>
