<template>
  <div class="flex flex-col h-full bg-[var(--bg-base)] border-t border-[var(--border-subtle)]">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 h-8 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-[var(--text-secondary)]">Terminal</span>
        <div class="flex gap-0.5">
          <button
            v-for="(term, i) in terminals"
            :key="term.id"
            @click="activeTerminal = i"
            class="text-[10px] px-2 py-0.5 rounded transition-colors"
            :class="
              i === activeTerminal
                ? 'bg-[var(--bg-raised)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            "
          >
            {{ term.title || `Terminal ${i + 1}` }}
          </button>
        </div>
      </div>
      <div class="flex gap-1">
        <button
          @click="newTerminal"
          class="text-xs p-1 rounded hover:bg-white/[0.05] text-[var(--text-muted)]"
          title="New Terminal"
        >
          +
        </button>
        <button
          @click="closeCurrentTerminal"
          class="text-xs p-1 rounded hover:bg-white/[0.05] text-[var(--text-muted)]"
          title="Close Terminal"
        >
          &times;
        </button>
      </div>
    </div>

    <!-- Terminal instances -->
    <div class="flex-1 relative">
      <div
        v-for="(term, i) in terminals"
        :key="term.id"
        v-show="i === activeTerminal"
        class="absolute inset-0"
      >
        <TerminalWidget
          :ref="(el: any) => (termRefs[i] = el)"
          :workingDirectory="workingDirectory"
          @title-changed="term.title = $event"
          @shell-finished="onShellFinished(i)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import TerminalWidget from './TerminalWidget.vue';

defineProps<{
  workingDirectory: string;
}>();

interface TerminalInstance {
  id: number;
  title: string;
}

let nextId = 1;
const terminals = reactive<TerminalInstance[]>([]);
const activeTerminal = ref(0);
const termRefs = ref<any[]>([]);

function newTerminal() {
  terminals.push({ id: nextId++, title: '' });
  activeTerminal.value = terminals.length - 1;
}

function closeCurrentTerminal() {
  if (terminals.length === 0) return;
  terminals.splice(activeTerminal.value, 1);
  if (activeTerminal.value >= terminals.length) {
    activeTerminal.value = Math.max(0, terminals.length - 1);
  }
}

function onShellFinished(index: number) {
  terminals.splice(index, 1);
  if (activeTerminal.value >= terminals.length) {
    activeTerminal.value = Math.max(0, terminals.length - 1);
  }
}

onMounted(() => {
  newTerminal();
});

defineExpose({
  newTerminal,
  closeCurrentTerminal,
  terminalCount: () => terminals.length,
});
</script>
