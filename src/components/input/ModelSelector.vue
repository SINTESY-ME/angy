<template>
  <div class="relative" ref="root">
    <button
      @click="open = !open"
      class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]"
    >
      <span>{{ shortName }}</span>
      <span class="text-[8px]">▾</span>
    </button>
    <div
      v-if="open"
      class="absolute bottom-full left-0 mb-1 bg-[var(--bg-raised)] border border-[var(--border-standard)] rounded-lg shadow-lg overflow-hidden z-10"
    >
      <div
        v-for="model in models"
        :key="model.id"
        @click="select(model.id)"
        class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/[0.05] whitespace-nowrap"
        :class="model.id === props.modelValue ? 'text-[var(--accent-mauve)]' : ''"
      >
        <div>
          <div class="text-xs text-[var(--text-primary)]">{{ model.name }}</div>
          <div class="text-[10px] text-[var(--text-faint)]">{{ model.desc }}</div>
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

const models = [
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', desc: 'Fast & capable' },
  { id: 'claude-opus-4-6', name: 'Opus 4.6', desc: 'Most powerful' },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', desc: 'Fastest' },
];

const shortName = computed(() => models.find((m) => m.id === props.modelValue)?.name || props.modelValue);

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
