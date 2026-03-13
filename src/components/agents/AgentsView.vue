<template>
  <div class="flex flex-col h-full">
    <AgentsHeader
      @new-agent="onNewAgent"
      @enter-mission-control="emit('enter-mission-control')"
    />
    <div class="flex flex-1 min-h-0">
      <FleetSidebar @agent-selected="onAgentSelected" />
      <OrchestratorChat
        v-if="selectedAgentId"
        :sessionId="selectedAgentId"
        @file-clicked="(path: string) => emit('file-clicked', path)"
        @send="onSend"
        @stop="onStop"
      />
      <div
        v-else
        class="flex-1 flex flex-col items-center justify-center text-center px-6"
      >
        <svg class="w-6 h-6 mb-2 opacity-30 text-txt-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
        <span class="text-[11px] text-txt-muted">Select an agent to view conversation</span>
        <span class="text-[10px] text-txt-faint mt-1">Or press +New Agent to get started</span>
      </div>
      <AgentsEffectsPanel
        v-if="selectedAgentId"
        :sessionId="selectedAgentId"
        @file-clicked="(path: string) => emit('file-clicked', path)"
        @approve="onApprove"
        @reject="onReject"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useFleetStore } from '../../stores/fleet';
import { useSessionsStore } from '../../stores/sessions';
import { useUiStore } from '../../stores/ui';
import { cancelProcess } from '../../composables/useEngine';
import AgentsHeader from './AgentsHeader.vue';
import FleetSidebar from './FleetSidebar.vue';
import OrchestratorChat from './OrchestratorChat.vue';
import AgentsEffectsPanel from './AgentsEffectsPanel.vue';

const fleetStore = useFleetStore();
const sessionsStore = useSessionsStore();
const ui = useUiStore();

const emit = defineEmits<{
  'file-clicked': [filePath: string];
  'enter-mission-control': [];
}>();

const selectedAgentId = computed(() => fleetStore.selectedAgentId);

function onAgentSelected(sessionId: string) {
  fleetStore.selectAgent(sessionId);
}

async function onNewAgent() {
  const workspace = ui.workspacePath;
  if (!workspace) return;
  const sessionId = await sessionsStore.createSession(workspace);
  fleetStore.rebuildFromSessions();
  fleetStore.selectAgent(sessionId);
}

function onSend(_message: string) {
  // TODO: wire to engine — send message to the selected agent's ClaudeProcess via
  // sendMessageToEngine(selectedAgentId.value, message, handle, { workingDir, mode, model })
  // Requires building an AgentHandle adapter for OrchestratorChat's streaming callbacks.
  ui.addNotification('warning', 'Send not wired', 'Message sending is not yet connected to the engine.');
}

function onStop() {
  const sid = selectedAgentId.value;
  if (sid) {
    cancelProcess(sid);
  }
}

function onApprove() {
  // TODO: wire to engine — approve pending tool use for the selected agent
}

function onReject() {
  // TODO: wire to engine — reject pending tool use for the selected agent
}
</script>
