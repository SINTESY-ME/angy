<template>
  <div class="flex flex-col h-full bg-base flex-1 min-w-0">
    <!-- Orchestrator header bar -->
    <div class="px-4 py-2.5 bg-surface border-b border-border-subtle flex items-center gap-3">
      <!-- Avatar -->
      <div class="w-7 h-7 rounded-lg bg-purple-500/30 flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4 text-purple-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M2 12L8 4l6 8" />
          <path d="M2 4l6 8 6-8" />
        </svg>
      </div>

      <!-- Name -->
      <span class="text-xs font-medium text-txt-primary truncate">
        {{ selectedAgent?.title || 'Select an agent' }}
      </span>

      <!-- Status badge -->
      <span v-if="selectedAgent?.status === 'working'" class="text-[9px] px-1.5 py-0.5 rounded bg-teal/10 text-teal flex-shrink-0">running</span>
      <span v-else-if="selectedAgent?.status === 'done'" class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0">done</span>
      <span v-else-if="selectedAgent?.status === 'error'" class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 flex-shrink-0">failed</span>

      <span class="flex-1" />

      <!-- More button -->
      <button class="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-txt-muted hover:text-txt-primary transition-colors">
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.2" />
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="13" cy="8" r="1.2" />
        </svg>
      </button>
    </div>

    <!-- Scrollable conversation area -->
    <div
      ref="scrollEl"
      class="flex-1 overflow-y-auto px-4 py-4 space-y-5"
    >
      <!-- No session selected -->
      <div
        v-if="!sessionId"
        class="flex flex-col items-center justify-center h-full text-center px-6"
      >
        <svg class="w-6 h-6 mb-2 opacity-30 text-txt-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <span class="text-[11px] text-txt-muted">Select an agent to view conversation</span>
      </div>

      <!-- Loading -->
      <div
        v-else-if="loading"
        class="flex flex-col items-center justify-center h-full"
      >
        <div class="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
        <span class="text-[11px] text-txt-muted mt-2">Loading messages...</span>
      </div>

      <!-- Messages -->
      <template v-else-if="messages.length > 0">
        <!-- Sub-agent tree branches -->
        <template v-for="agent in childAgents" :key="agent.sessionId">
          <TreeBranch
            :agent="agent"
            :messages="getAgentMessages(agent.sessionId)"
            :depth="0"
            @file-clicked="(path: string) => $emit('file-clicked', path)"
          />
        </template>

        <!-- Orchestrator's own messages (not belonging to sub-agents) -->
        <div v-if="ownMessages.length > 0" class="space-y-3">
          <ChatTreeNode
            v-for="(msg, i) in ownMessages"
            :key="msg.id ?? i"
            :message="msg"
            agentColor="var(--accent-purple)"
            @file-clicked="(path: string) => $emit('file-clicked', path)"
          />
        </div>
      </template>

      <!-- Empty conversation -->
      <div
        v-else
        class="flex flex-col items-center justify-center h-full text-center px-6"
      >
        <svg class="w-6 h-6 mb-2 opacity-30 text-txt-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <span class="text-[11px] text-txt-muted">No messages yet</span>
        <span class="text-[10px] text-txt-faint mt-1">Send a message to get started</span>
      </div>
    </div>

    <!-- Input bar -->
    <ChatInputBar
      :processing="isProcessing"
      @send="(msg: string) => $emit('send', msg)"
      @stop="$emit('stop')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useFleetStore } from '../../stores/fleet';
import { useSessionsStore } from '../../stores/sessions';
import type { MessageRecord } from '../../engine/types';
import TreeBranch from './TreeBranch.vue';
import ChatTreeNode from './ChatTreeNode.vue';
import ChatInputBar from './ChatInputBar.vue';

const props = defineProps<{
  sessionId: string;
}>();

defineEmits<{
  'file-clicked': [filePath: string];
  send: [message: string];
  stop: [];
}>();

const fleetStore = useFleetStore();
const sessionsStore = useSessionsStore();
const scrollEl = ref<HTMLElement | null>(null);
const loading = ref(false);

const selectedAgent = computed(() =>
  fleetStore.agents.find((a) => a.sessionId === props.sessionId),
);

const isProcessing = computed(() =>
  selectedAgent.value?.status === 'working',
);

const messages = computed((): MessageRecord[] =>
  sessionsStore.getMessages(props.sessionId),
);

// Child agents belonging to this orchestrator
const childAgents = computed(() =>
  fleetStore.hierarchicalAgents.filter(
    (a) => a.parentSessionId === props.sessionId,
  ),
);

// Get messages for a specific sub-agent
function getAgentMessages(agentSessionId: string): MessageRecord[] {
  return sessionsStore.getMessages(agentSessionId);
}

// Orchestrator's own messages (from the selected session, not sub-agent sessions)
const ownMessages = computed((): MessageRecord[] => messages.value);

// Auto-scroll on new messages
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      scrollEl.value?.scrollTo({
        top: scrollEl.value.scrollHeight,
        behavior: 'smooth',
      });
    });
  },
);
</script>
