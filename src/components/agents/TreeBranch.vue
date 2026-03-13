<template>
  <details
    :open="agent.status === 'working' || undefined"
    :class="depth > 0 ? 'ml-4' : ''"
  >
    <!-- Summary row -->
    <summary
      class="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-colors select-none"
      :class="[
        'hover:bg-white/[0.03]',
        agent.status === 'done' ? 'opacity-70 hover:opacity-100' : '',
      ]"
    >
      <!-- Chevron -->
      <svg
        class="w-2.5 h-2.5 text-txt-muted flex-shrink-0 transition-transform duration-150 chevron-icon"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path d="M3 1l4 4-4 4" />
      </svg>

      <!-- Avatar -->
      <div
        class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[8px] font-semibold text-white"
        :style="{ background: avatarGradient }"
      >
        {{ initials }}
      </div>

      <!-- Name + status badge -->
      <span
        class="text-xs font-medium truncate"
        :class="agent.status === 'done' ? 'text-txt-secondary' : 'text-txt-primary'"
      >{{ agent.title || 'Untitled' }}</span>

      <span v-if="agent.status === 'working'" class="text-[9px] px-1.5 py-0.5 rounded bg-teal/10 text-teal flex-shrink-0">running</span>
      <span v-else-if="agent.status === 'done'" class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0">done</span>
      <span v-else-if="agent.status === 'error'" class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 flex-shrink-0">failed</span>

      <!-- Running dot -->
      <span
        v-if="agent.status === 'working'"
        class="w-1.5 h-1.5 rounded-full bg-teal anim-breathe flex-shrink-0"
      />

      <span class="flex-1" />

      <!-- Right meta -->
      <span v-if="agent.costUsd > 0" class="text-[9px] font-mono text-txt-faint flex-shrink-0">${{ agent.costUsd.toFixed(2) }}</span>
      <span class="text-[9px] font-mono text-txt-faint flex-shrink-0">{{ messages.length }} msgs</span>
    </summary>

    <!-- Children area -->
    <div
      class="ml-4 pl-2 border-l-2 space-y-1 py-1"
      :class="borderClass"
    >
      <ChatTreeNode
        v-for="(msg, i) in messages"
        :key="msg.id ?? i"
        :message="msg"
        :agentColor="agentColor"
        @file-clicked="(path: string) => $emit('file-clicked', path)"
      />

      <!-- Empty state -->
      <div
        v-if="messages.length === 0"
        class="flex flex-col items-center justify-center py-4 text-center"
      >
        <span class="text-[11px] text-txt-muted">No messages yet</span>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HierarchicalAgent } from '../../stores/fleet';
import type { MessageRecord } from '../../engine/types';
import ChatTreeNode from './ChatTreeNode.vue';

const props = defineProps<{
  agent: HierarchicalAgent;
  messages: MessageRecord[];
  depth: number;
}>();

defineEmits<{
  'file-clicked': [filePath: string];
}>();

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #f59e0b, #ea580c)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #22d3ee, #0891b2)',
  'linear-gradient(135deg, #a855f6, #7c3aed)',
];

const avatarGradient = computed(() => {
  const hash = props.agent.sessionId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
});

const initials = computed(() => {
  const name = props.agent.title || 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
});

const borderClass = computed(() => {
  switch (props.agent.status) {
    case 'working': return 'border-teal/30 anim-shimmer';
    case 'done': return 'border-emerald-500/15';
    case 'error': return 'border-border-subtle';
    default: return 'border-border-subtle';
  }
});

const agentColor = computed(() => {
  switch (props.agent.status) {
    case 'working': return 'var(--accent-teal)';
    case 'done': return 'var(--accent-green)';
    case 'error': return 'var(--accent-red)';
    default: return 'var(--border-standard)';
  }
});
</script>

<style scoped>
summary {
  list-style: none;
}
summary::marker,
summary::-webkit-details-marker {
  display: none;
}
details[open] > summary .chevron-icon {
  transform: rotate(90deg);
}
</style>
