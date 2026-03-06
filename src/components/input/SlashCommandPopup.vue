<template>
  <div
    ref="popupEl"
    class="absolute bottom-full left-4 mb-1 w-72 bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-lg shadow-lg overflow-hidden z-50"
  >
    <div
      v-for="(cmd, i) in filteredCommands"
      :key="cmd.name"
      class="px-3 py-2 cursor-pointer hover:bg-white/[0.05]"
      :class="i === selectedIndex ? 'bg-white/[0.05]' : ''"
      @click="$emit('select', cmd.name)"
    >
      <div class="text-xs font-medium text-[var(--accent-mauve)]">/{{ cmd.name }}</div>
      <div class="text-[10px] text-[var(--text-muted)]">{{ cmd.description }}</div>
    </div>
    <div
      v-if="filteredCommands.length === 0"
      class="px-3 py-2 text-xs text-[var(--text-faint)]"
    >
      No commands found
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

interface SlashCommand {
  name: string;
  description: string;
}

const props = defineProps<{
  query: string;
}>();

const emit = defineEmits<{
  select: [commandName: string];
  close: [];
}>();

const popupEl = ref<HTMLElement | null>(null);
const selectedIndex = ref(0);

const commands: SlashCommand[] = [
  { name: 'orchestrate', description: 'Start multi-agent orchestration' },
  { name: 'pipeline', description: 'Run a pipeline workflow' },
  { name: 'plan', description: 'Switch to plan mode' },
  { name: 'clear', description: 'Clear current chat' },
  { name: 'export', description: 'Export chat as JSON' },
];

const filteredCommands = computed(() => {
  const q = props.query.toLowerCase();
  return q
    ? commands.filter((c) => c.name.toLowerCase().includes(q))
    : commands;
});

watch(
  () => filteredCommands.value.length,
  () => {
    selectedIndex.value = 0;
  },
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredCommands.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filteredCommands.value[selectedIndex.value]) {
      emit('select', filteredCommands.value[selectedIndex.value].name);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

function onClickOutside(e: MouseEvent) {
  if (popupEl.value && !popupEl.value.contains(e.target as Node)) {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});

defineExpose({ onKeydown });
</script>
