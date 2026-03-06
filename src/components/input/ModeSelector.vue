<template>
  <div class="relative" ref="root">
    <button
      @click="open = !open"
      class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]"
    >
      <span>{{ modeIcon }}</span>
      <span class="capitalize">{{ props.modelValue }}</span>
      <span class="text-[8px]">▾</span>
    </button>
    <div
      v-if="open"
      class="absolute bottom-full left-0 mb-1 bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-lg shadow-lg overflow-hidden z-10"
    >
      <div
        v-for="mode in modes"
        :key="mode.id"
        @click="select(mode.id)"
        class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/[0.05] whitespace-nowrap"
      >
        <span class="text-xs">{{ mode.icon }}</span>
        <div>
          <div class="text-xs text-[var(--text-primary)]">{{ mode.label }}</div>
          <div class="text-[10px] text-[var(--text-faint)]">{{ mode.desc }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const modes = [
  { id: 'agent', label: 'Agent', icon: '🤖', desc: 'Full capabilities' },
  { id: 'ask', label: 'Ask', icon: '💬', desc: 'Read-only questions' },
  { id: 'plan', label: 'Plan', icon: '📋', desc: 'Plan mode' },
];

const modeIcon = computed(() => modes.find((m) => m.id === props.modelValue)?.icon || '🤖');

function select(id: string) {
  emit('update:modelValue', id);
  open.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));
</script>
