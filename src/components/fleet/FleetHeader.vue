<template>
  <div class="relative flex flex-col bg-[var(--bg-surface)]">
    <!-- Breadcrumb bar (when epic context is active) -->
    <div
      v-if="activeEpic"
      class="flex items-center gap-1 px-3 pt-1.5 pb-0.5 text-[10px] text-[var(--text-muted)] truncate"
    >
      <button
        class="hover:text-[var(--text-primary)] transition-colors"
        @click="ui.navigateHome()"
      >Home</button>
      <span class="opacity-50">&rsaquo;</span>
      <button
        class="hover:text-[var(--text-primary)] transition-colors truncate max-w-[80px]"
        @click="ui.navigateToKanban(ui.activeProjectId!)"
      >{{ projectName }}</button>
      <span class="opacity-50">&rsaquo;</span>
      <span class="text-[var(--text-secondary)] truncate max-w-[100px]">{{ activeEpic.title }}</span>
    </div>

    <div class="flex items-center justify-between px-3" :class="activeEpic ? 'h-8' : 'h-11'">
      <!-- Left side: back/home button or title -->
      <div class="flex items-center gap-1.5">
        <button
          v-if="activeEpic"
          class="w-[22px] h-[22px] flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
          title="Back to Kanban"
          @click="ui.navigateToKanban(ui.activeProjectId!)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          v-else-if="props.viewMode === 'manager'"
          class="w-[22px] h-[22px] flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
          title="Home"
          @click="ui.navigateHome()"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
          </svg>
        </button>
        <span class="text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">Agents</span>
      </div>

    <div class="flex gap-0.5">
      <button
        @click="toggleView"
        class="w-[26px] h-[26px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--accent-mauve)] transition-colors"
        :title="props.viewMode === 'manager' ? 'Editor View (⌘E)' : 'Manager View (⌘E)'"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
          <template v-if="props.viewMode === 'manager'">
            <rect x="1" y="1" width="12" height="12" rx="2" />
            <path d="M5 1V13" />
            <path d="M5 5H13" />
          </template>
          <template v-else>
            <rect x="1" y="1" width="12" height="12" rx="2" />
            <path d="M5 1V13" />
            <path d="M9 1V13" />
          </template>
        </svg>
      </button>
      <button
        @click="$emit('orchestrate')"
        class="w-[26px] h-[26px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--accent-mauve)] transition-colors"
        title="Start Orchestration"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="7" cy="3" r="2" />
          <circle cx="3" cy="11" r="2" />
          <circle cx="11" cy="11" r="2" />
          <path d="M7 5V8" />
          <path d="M4 9L7 8L10 9" />
        </svg>
      </button>
      <button
        @click="$emit('enter-mission-control')"
        class="w-[26px] h-[26px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--accent-teal)] transition-colors"
        title="Mission Control"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
          <rect x="1" y="1" width="12" height="12" rx="2" />
          <circle cx="5" cy="5" r="1.5" />
          <circle cx="9" cy="5" r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <path d="M5 6.5L7 8.5M9 6.5L7 8.5" />
        </svg>
      </button>
      <button
        @click="$emit('new-agent')"
        class="w-[26px] h-[26px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
        title="New Agent (Ctrl+N)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M7 2V12M2 7H12" />
        </svg>
      </button>
      <button
        ref="menuBtnRef"
        @click.stop="toggleMenu"
        class="w-[26px] h-[26px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
        title="Actions"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="3" cy="7" r="1.2" />
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="11" cy="7" r="1.2" />
        </svg>
      </button>
    </div>
    </div>

    <!-- Dropdown menu -->
    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed z-50 bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-md py-1 shadow-lg min-w-[180px]"
        :style="dropdownStyle"
      >
        <button
          class="w-full text-left px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
          @click="onAction('keep-today')"
        >
          Keep only today's chats
        </button>
        <button
          class="w-full text-left px-4 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
          @click="onAction('delete-older')"
        >
          Delete older than 1 day
        </button>
        <div class="h-px bg-[var(--border-subtle)] my-1" />
        <button
          class="w-full text-left px-4 py-1.5 text-xs text-[var(--accent-red)] hover:bg-[var(--bg-surface)]"
          @click="onAction('delete-all')"
        >
          Delete all
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useProjectsStore } from '@/stores/projects';
import { useEpicStore } from '@/stores/epics';

const ui = useUiStore();
const projectsStore = useProjectsStore();
const epicStore = useEpicStore();

const props = defineProps<{
  viewMode?: string;
}>();

const activeEpic = computed(() => {
  if (!ui.activeEpicId) return null;
  return epicStore.epicById(ui.activeEpicId) ?? null;
});

const projectName = computed(() => {
  if (!ui.activeProjectId) return '';
  return projectsStore.projectById(ui.activeProjectId)?.name ?? 'Project';
});

const emit = defineEmits<{
  'new-agent': [];
  'delete-all': [];
  'delete-older': [];
  'keep-today': [];
  'toggle-view': [];
  'orchestrate': [];
  'enter-mission-control': [];
}>();

function toggleView() {
  emit('toggle-view');
}

const menuOpen = ref(false);
const menuBtnRef = ref<HTMLElement | null>(null);
const dropdownPos = ref({ top: 0, left: 0 });

function toggleMenu() {
  if (menuOpen.value) {
    menuOpen.value = false;
    return;
  }
  // Position dropdown below the button
  if (menuBtnRef.value) {
    const rect = menuBtnRef.value.getBoundingClientRect();
    dropdownPos.value = { top: rect.bottom + 4, left: rect.right };
  }
  menuOpen.value = true;
}

const dropdownStyle = computed(() => ({
  top: dropdownPos.value.top + 'px',
  left: (dropdownPos.value.left - 180) + 'px',  // 180 = min-w-[180px], align right edge
}));

function onAction(action: 'delete-all' | 'delete-older' | 'keep-today') {
  menuOpen.value = false;
  if (action === 'delete-all') emit('delete-all');
  else if (action === 'delete-older') emit('delete-older');
  else emit('keep-today');
}

function closeMenu(e: MouseEvent) {
  if (menuOpen.value && menuBtnRef.value && !menuBtnRef.value.contains(e.target as Node)) {
    menuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});
</script>
