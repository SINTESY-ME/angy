<template>
  <div
    class="w-10 flex flex-col items-center justify-start pt-3 bg-[var(--bg-base)] border-l border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
    @click="codeStore.chatExpanded = true"
  >
    <!-- Chat icon -->
    <svg class="w-4 h-4 text-txt-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    <!-- Vertical "Chat" label -->
    <span class="text-[9px] text-txt-faint mt-1" style="writing-mode: vertical-lr">Chat</span>
  </div>
</template>

<script setup lang="ts">
import { useCodeStore } from '@/stores/code';

const codeStore = useCodeStore();
</script>
