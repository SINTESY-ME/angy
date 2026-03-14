<template>
  <details
    :open="agent.status === 'working' || undefined"
    class="tree-node tree-branch anim-fade-in"
    :class="depth > 0 ? 'ml-4' : ''"
  >
    <!-- Summary row (matches prototype bordered card style) -->
    <summary
      class="tree-summary flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors select-none"
      :class="summaryClasses"
    >
      <!-- Chevron -->
      <svg
        class="tree-chevron w-3 h-3 text-txt-faint flex-shrink-0 transition-transform"
        fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>

      <!-- Avatar -->
      <div
        class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        :style="{ background: avatarGradient }"
      >
        <span class="text-[8px] font-bold" :style="{ color: avatarTextColor }">{{ initials }}</span>
      </div>

      <!-- Name -->
      <span
        class="text-xs font-medium truncate"
        :class="agent.status === 'done' ? 'text-txt-secondary' : 'text-txt-primary'"
      >{{ agent.title || 'Untitled' }}</span>

      <!-- Running dot -->
      <span
        v-if="agent.status === 'working'"
        class="w-1.5 h-1.5 rounded-full bg-teal anim-breathe flex-shrink-0"
      />

      <!-- Status badge -->
      <span v-if="agent.status === 'working'" class="text-[9px] px-1.5 py-0.5 rounded bg-teal/10 text-teal flex-shrink-0">running</span>
      <span v-else-if="agent.status === 'done'" class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0">done</span>
      <span v-else-if="agent.status === 'error'" class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 flex-shrink-0">failed</span>

      <!-- Done checkmark -->
      <svg v-if="agent.status === 'done'" class="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>

      <!-- Right meta -->
      <span class="flex-1" />
      <span v-if="agent.costUsd > 0" class="text-[9px] text-txt-faint flex-shrink-0">${{ agent.costUsd.toFixed(2) }}</span>
      <span class="text-[9px] text-txt-faint flex-shrink-0 ml-1">{{ messages.length }} msgs</span>
    </summary>

    <!-- Children area -->
    <div
      class="tree-children ml-4 pl-4 border-l-2 mt-2 space-y-3 pb-1"
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

const AVATAR_STYLES = [
  { gradient: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(234,88,12,0.3))', textColor: '#fb923c' },
  { gradient: 'linear-gradient(135deg, rgba(16,185,129,0.4), rgba(5,150,105,0.4))', textColor: '#10b981' },
  { gradient: 'linear-gradient(135deg, rgba(251,191,36,0.4), rgba(217,119,6,0.4))', textColor: '#fbbf24' },
  { gradient: 'linear-gradient(135deg, rgba(168,85,247,0.4), rgba(124,58,237,0.4))', textColor: '#a855f6' },
];

const avatarStyle = computed(() => {
  const hash = props.agent.sessionId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
});

const avatarGradient = computed(() => avatarStyle.value.gradient);
const avatarTextColor = computed(() => avatarStyle.value.textColor);

const initials = computed(() => {
  const name = props.agent.title || 'U';
  const parts = name.trim().split(/[-\s]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
});

const summaryClasses = computed(() => {
  if (props.agent.status === 'working') {
    return 'bg-surface border border-teal/20 anim-shimmer hover:border-teal/30';
  }
  if (props.agent.status === 'done') {
    return 'bg-surface border border-border-subtle opacity-70 hover:opacity-100';
  }
  return 'bg-surface border border-border-subtle hover:border-purple-500/20';
});

const borderClass = computed(() => {
  switch (props.agent.status) {
    case 'working': return 'border-teal/20';
    case 'done': return 'border-emerald-500/15';
    default: return 'border-purple-500/15';
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
