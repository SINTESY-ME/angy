<template>
  <div class="relative" ref="root">
    <button
      @click="open = !open"
      class="flex items-center gap-1 text-[var(--text-xs)] px-2 py-1 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]"
    >
      <span class="capitalize">{{ props.modelValue }}</span>
      <svg class="w-2.5 h-2.5 opacity-50" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 4L5 6.5L7.5 4"/></svg>
    </button>
    <div
      v-if="open"
      class="absolute bottom-full left-0 mb-1 bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] overflow-hidden z-10"
    >
      <div
        v-for="mode in modes"
        :key="mode.id"
        @click="select(mode.id)"
        class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/[0.05] whitespace-nowrap"
      >
        <div>
          <div class="text-xs text-[var(--text-primary)]">{{ mode.label }}</div>
          <div class="text-[var(--text-xs)] text-[var(--text-faint)]">{{ mode.desc }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const modes = [
  { id: 'agent', label: 'Agent', desc: 'Full capabilities' },
  { id: 'ask', label: 'Ask', desc: 'Read-only questions' },
  { id: 'plan', label: 'Plan', desc: 'Plan mode' },
];


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
