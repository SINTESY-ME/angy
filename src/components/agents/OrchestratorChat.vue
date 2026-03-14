<template>
  <div class="flex flex-col h-full bg-base flex-1 min-w-0">
    <!-- Orchestrator header bar (matches prototype) -->
    <div class="px-5 py-3 border-b border-border-subtle flex items-center gap-3">
      <!-- Avatar -->
      <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/30 to-purple-600/30 flex items-center justify-center flex-shrink-0">
        <svg class="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      </div>

      <!-- Name + badges -->
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-txt-primary truncate">
            {{ selectedAgent?.title || 'Select an agent' }}
          </span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 flex-shrink-0">orchestrator</span>
          <span v-if="selectedAgent?.status === 'working'" class="text-[10px] px-1.5 py-0.5 rounded bg-teal/10 text-teal flex-shrink-0">running</span>
          <span v-else-if="selectedAgent?.status === 'done'" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0">done</span>
          <span v-else-if="selectedAgent?.status === 'error'" class="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 flex-shrink-0">failed</span>
        </div>
        <!-- Breadcrumb: project > epic -->
        <div v-if="epicInfo" class="flex items-center gap-2 mt-0.5">
          <span class="text-[10px] text-txt-muted">{{ epicInfo.projectName }}</span>
          <span class="text-txt-faint text-[10px]">›</span>
          <span class="text-[10px] text-txt-muted">{{ epicInfo.epicTitle }}</span>
          <span class="text-txt-faint text-[10px]">·</span>
          <span class="text-[10px] text-txt-faint">{{ childAgents.length }} sub-agents</span>
        </div>
      </div>

      <span class="flex-1" />

      <!-- Cost + time -->
      <span v-if="selectedAgent?.costUsd" class="text-[10px] text-txt-faint">${{ selectedAgent.costUsd.toFixed(2) }} total</span>
      <span v-if="selectedAgent?.costUsd" class="text-[10px] text-txt-faint">·</span>
      <span class="text-[10px] text-txt-faint">{{ elapsedTime }}</span>

      <!-- Stop All -->
      <button
        v-if="isProcessing"
        class="text-[10px] text-txt-faint hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
        @click="$emit('stop')"
      >Stop All</button>
    </div>

    <!-- Scrollable hierarchical conversation -->
    <div
      ref="scrollEl"
      class="flex-1 overflow-y-auto px-5 py-4 space-y-3"
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

      <!-- Interleaved timeline -->
      <template v-else-if="timeline.length > 0">
        <template v-for="(item, idx) in timeline" :key="idx">
          <!-- Orchestrator's own message -->
          <div v-if="item.type === 'orchestrator-message'" class="tree-node anim-fade-in">
            <div class="flex items-center gap-2 mb-1.5">
              <div class="w-5 h-5 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-2.5 h-2.5 text-purple-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <span class="text-xs font-medium text-purple-400">Orchestrator</span>
            </div>
            <div class="ml-7 text-[13px] text-txt-primary leading-relaxed whitespace-pre-wrap">{{ item.message!.content }}</div>
          </div>

          <!-- Orchestrator decision (tool calls / spawning) -->
          <div v-else-if="item.type === 'orchestrator-decision'" class="tree-node flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-500/10 anim-fade-in">
            <svg class="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span class="text-[11px] text-purple-300 whitespace-pre-wrap">{{ item.message!.content }}</span>
          </div>

          <!-- Sub-agent branch -->
          <TreeBranch
            v-else-if="item.type === 'sub-agent'"
            :agent="item.agent!"
            :messages="getAgentMessages(item.agent!.sessionId)"
            :depth="0"
            @file-clicked="(path: string) => $emit('file-clicked', path)"
          />
        </template>
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
import { useFleetStore, type HierarchicalAgent } from '../../stores/fleet';
import { useSessionsStore } from '../../stores/sessions';
import { useProjectsStore } from '../../stores/projects';
import { useEpicStore } from '../../stores/epics';
import type { MessageRecord } from '../../engine/types';
import TreeBranch from './TreeBranch.vue';
import ChatInputBar from './ChatInputBar.vue';

interface TimelineItem {
  type: 'orchestrator-message' | 'orchestrator-decision' | 'sub-agent';
  message?: MessageRecord;
  agent?: HierarchicalAgent;
  timestamp: number;
}

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
const projectsStore = useProjectsStore();
const epicStore = useEpicStore();
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

const childAgents = computed(() =>
  fleetStore.hierarchicalAgents.filter(
    (a) => a.parentSessionId === props.sessionId,
  ),
);

const epicInfo = computed(() => {
  const agent = selectedAgent.value;
  if (!agent) return null;
  const epic = epicStore.epics.find(e => e.rootSessionId === props.sessionId);
  if (!epic) return null;
  const project = projectsStore.projects.find(p => p.id === epic.projectId);
  return {
    projectName: project?.name ?? 'Unknown',
    epicTitle: epic.title,
  };
});

const elapsedTime = computed(() => {
  const agent = selectedAgent.value;
  if (!agent?.updatedAt) return '';
  const ms = Date.now() - agent.updatedAt;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
});

function getAgentMessages(agentSessionId: string): MessageRecord[] {
  return sessionsStore.getMessages(agentSessionId);
}

const timeline = computed((): TimelineItem[] => {
  const items: TimelineItem[] = [];

  for (const msg of messages.value) {
    if (msg.role === 'assistant' && msg.toolName) {
      items.push({
        type: 'orchestrator-decision',
        message: msg,
        timestamp: msg.timestamp ?? Date.now(),
      });
    } else if (msg.role === 'assistant' || msg.role === 'user') {
      items.push({
        type: 'orchestrator-message',
        message: msg,
        timestamp: msg.timestamp ?? Date.now(),
      });
    }
  }

  for (const agent of childAgents.value) {
    items.push({
      type: 'sub-agent',
      agent,
      timestamp: agent.updatedAt ?? Date.now(),
    });
  }

  items.sort((a, b) => a.timestamp - b.timestamp);
  return items;
});

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
