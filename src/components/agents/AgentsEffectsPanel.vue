<template>
  <div class="flex flex-col h-full bg-base w-64 flex-shrink-0 border-l border-border-subtle">
    <!-- Header -->
    <div class="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-txt-muted">Effects</span>
      <div class="flex gap-1">
        <button
          v-for="s in (['session', 'all'] as const)"
          :key="s"
          class="text-[10px] px-2 py-0.5 rounded transition-colors"
          :class="scope === s ? 'text-txt-primary bg-raised' : 'text-txt-muted hover:text-txt-secondary'"
          @click="scope = s"
        >{{ s === 'session' ? 'Session' : 'All' }}</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-0 border-b border-border-subtle">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex items-center gap-1 text-[10px] px-3 py-2 transition-colors"
        :class="activeTab === tab.id
          ? 'text-txt-primary border-b-2 border-ember-500'
          : 'text-txt-muted hover:text-txt-secondary'"
        @click="activeTab = tab.id"
      >
        <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <path v-if="tab.id === 'effects'" d="M3 3h10v10H3zM6 1v4M10 1v4M1 6h14" />
          <path v-else d="M8 2v12M2 8h12M4 4l8 8M12 4l-8 8" />
        </svg>
        {{ tab.label }}
      </button>
    </div>

    <!-- Summary bar -->
    <div class="px-3 py-2 border-b border-border-subtle flex gap-3 text-[10px] text-txt-muted">
      <span>{{ fileChanges.length }} files</span>
      <span class="text-emerald-400">+{{ totalAdded }}</span>
      <span class="text-accent-red">-{{ totalRemoved }}</span>
      <span v-if="totalCost > 0" class="text-txt-faint">${{ totalCost.toFixed(2) }}</span>
    </div>

    <!-- File list (effects tab) -->
    <div v-if="activeTab === 'effects'" class="flex-1 overflow-y-auto py-2 space-y-1 px-2">
      <template v-if="fileChanges.length > 0">
        <div
          v-for="change in fileChanges"
          :key="change.filePath"
          class="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-white/[0.03] transition-colors"
          @click="$emit('file-clicked', change.filePath)"
        >
          <!-- Status badge -->
          <span
            class="text-[10px] px-1 rounded flex-shrink-0"
            :class="changeTypeBadge(change.changeType)"
          >{{ changeTypeLabel(change.changeType) }}</span>
          <!-- File path -->
          <span class="text-[11px] text-txt-secondary truncate font-mono">{{ change.filePath }}</span>
          <!-- Line counts -->
          <span class="flex-shrink-0 text-[9px] font-mono">
            <span v-if="change.linesAdded" class="text-emerald-400">+{{ change.linesAdded }}</span>
            <span v-if="change.linesRemoved" class="text-accent-red ml-0.5">-{{ change.linesRemoved }}</span>
          </span>
        </div>
      </template>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center h-full text-center px-6"
      >
        <svg class="w-6 h-6 mb-2 opacity-30 text-txt-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        <span class="text-[11px] text-txt-muted">No changes yet</span>
        <span class="text-[10px] text-txt-faint mt-1">File edits will appear as your agent works</span>
      </div>
    </div>

    <!-- Graph tab placeholder -->
    <div v-else class="flex-1 flex flex-col items-center justify-center text-center px-6">
      <svg class="w-6 h-6 mb-2 opacity-30 text-txt-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
        <circle cx="12" cy="12" r="3" />
        <circle cx="4" cy="6" r="2" />
        <circle cx="20" cy="6" r="2" />
        <circle cx="4" cy="18" r="2" />
        <circle cx="20" cy="18" r="2" />
        <path d="M9.5 10.5L5.5 7.5M14.5 10.5L18.5 7.5M9.5 13.5L5.5 16.5M14.5 13.5L18.5 16.5" />
      </svg>
      <span class="text-[11px] text-txt-muted">Agent graph coming soon</span>
    </div>

    <!-- Approve / Reject — hidden when no pending approval -->
    <div v-if="hasPendingApproval" class="px-3 py-3 border-t border-border-subtle flex gap-2 justify-end">
      <button
        class="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] text-xs text-txt-secondary rounded-lg h-8 px-3 hover:bg-white/[0.06] transition-colors"
        @click="$emit('reject')"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
        Reject
      </button>
      <button
        class="flex items-center gap-1 bg-gradient-to-r from-ember-500 to-ember-600 text-base text-xs font-medium rounded-lg h-8 px-4 transition-colors"
        @click="$emit('approve')"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 8l4 4 6-7" />
        </svg>
        Approve
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { FileChange, MessageRecord } from '../../engine/types';
import { engineBus } from '../../engine/EventBus';
import { getDatabase } from '../../stores/sessions';
import { DiffEngine } from '../../engine/DiffEngine';

const props = defineProps<{
  sessionId: string;
}>();

defineEmits<{
  'file-clicked': [filePath: string];
  approve: [];
  reject: [];
}>();

const EDIT_TOOLS = new Set(['Edit', 'Write', 'StrReplace', 'MultiEdit', 'NotebookEdit']);
const diffEngine = new DiffEngine();

const scope = ref<'session' | 'all'>('session');
const activeTab = ref<'effects' | 'graph'>('effects');
const fileChanges = ref<FileChange[]>([]);
// TODO: wire to engine — track pending tool-use approval state per session
const hasPendingApproval = ref(false);

const tabs = [
  { id: 'effects' as const, label: 'Effects' },
  { id: 'graph' as const, label: 'Graph' },
];

const totalAdded = computed(() => fileChanges.value.reduce((sum, c) => sum + c.linesAdded, 0));
const totalRemoved = computed(() => fileChanges.value.reduce((sum, c) => sum + c.linesRemoved, 0));
const totalCost = computed(() => 0); // Cost tracked at agent level, not file level

function changeTypeBadge(type: FileChange['changeType']): string {
  switch (type) {
    case 'created': return 'bg-emerald-500/10 text-emerald-400';
    case 'modified': return 'bg-yellow-400/10 text-yellow-400';
    case 'deleted': return 'bg-red-500/10 text-red-400';
  }
}

function changeTypeLabel(type: FileChange['changeType']): string {
  switch (type) {
    case 'created': return 'A';
    case 'modified': return 'M';
    case 'deleted': return 'D';
  }
}

// Compute real line counts from toolInput using DiffEngine
function computeLineCounts(filePath: string, toolName: string, toolInput?: Record<string, any>): { linesAdded: number; linesRemoved: number } {
  let linesAdded = 0;
  let linesRemoved = 0;

  if (toolInput) {
    if (toolName === 'Edit' || toolName === 'StrReplace') {
      const oldString = toolInput.old_string ?? '';
      const newString = toolInput.new_string ?? '';
      if (oldString || newString) {
        diffEngine.recordEditToolChange(filePath, oldString, newString, props.sessionId);
        linesAdded = diffEngine.linesAddedForFile(filePath);
        linesRemoved = diffEngine.linesRemovedForFile(filePath);
      }
    } else if (toolName === 'MultiEdit') {
      const edits = toolInput.edits ?? [];
      for (const edit of edits) {
        diffEngine.recordEditToolChange(filePath, edit.old_string ?? '', edit.new_string ?? '', props.sessionId);
      }
      linesAdded = diffEngine.linesAddedForFile(filePath);
      linesRemoved = diffEngine.linesRemovedForFile(filePath);
    } else if (toolName === 'Write') {
      const content = toolInput.content ?? toolInput.contents ?? '';
      if (content) {
        diffEngine.recordWriteToolChange(filePath, content, props.sessionId);
        linesAdded = diffEngine.linesAddedForFile(filePath);
        linesRemoved = diffEngine.linesRemovedForFile(filePath);
      }
    }
  }

  return { linesAdded, linesRemoved };
}

// Handle incoming file edit events
function onFileEdited(evt: { sessionId: string; filePath: string; toolName: string; toolInput?: Record<string, any> }) {
  if (scope.value === 'session' && evt.sessionId !== props.sessionId) return;

  let changeType: FileChange['changeType'];
  if (evt.toolName === 'Delete') {
    changeType = 'deleted';
  } else if (evt.toolName === 'Write') {
    changeType = diffEngine.hasFile(evt.filePath) ? 'modified' : 'created';
  } else {
    changeType = 'modified';
  }

  const { linesAdded, linesRemoved } = computeLineCounts(evt.filePath, evt.toolName, evt.toolInput);

  const existing = fileChanges.value.find((c) => c.filePath === evt.filePath);
  if (existing) {
    existing.changeType = changeType;
    existing.linesAdded = linesAdded;
    existing.linesRemoved = linesRemoved;
  } else {
    fileChanges.value.push({
      filePath: evt.filePath,
      changeType,
      linesAdded,
      linesRemoved,
    });
  }
}

// Clear and reload on session change — load historical file changes from DB
watch(() => props.sessionId, async (sessionId) => {
  fileChanges.value = [];

  if (!sessionId) return;

  const db = getDatabase();
  const dbMessages: MessageRecord[] = await db.loadMessages(sessionId);

  const byPath = new Map<string, FileChange>();
  for (const msg of dbMessages) {
    if (msg.role === 'tool' && msg.toolName && EDIT_TOOLS.has(msg.toolName)) {
      let input: Record<string, any> = {};
      try { input = JSON.parse(msg.toolInput || '{}'); } catch { /* skip */ }
      const filePath = input.file_path || input.path || '';
      if (filePath) {
        const { linesAdded, linesRemoved } = computeLineCounts(filePath, msg.toolName, input);
        byPath.set(filePath, {
          filePath,
          changeType: (msg.toolName === 'Write' ? 'created' : 'modified') as FileChange['changeType'],
          linesAdded,
          linesRemoved,
        });
      }
    }
  }

  fileChanges.value = Array.from(byPath.values());
}, { immediate: true });

onMounted(() => {
  engineBus.on('agent:fileEdited', onFileEdited);
});

onUnmounted(() => {
  engineBus.off('agent:fileEdited', onFileEdited);
});
</script>
