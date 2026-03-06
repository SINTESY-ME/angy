<template>
  <div
    class="rounded-lg border-l-[3px] border-l-[var(--accent-yellow)] bg-[var(--bg-raised)] px-4 py-3 my-1"
    :class="answered ? 'opacity-60' : ''"
  >
    <div class="text-[9px] font-bold tracking-widest text-[var(--accent-yellow)] uppercase mb-2">
      Action Required
    </div>
    <div class="text-[13px] text-[var(--text-primary)] mb-3">{{ question }}</div>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="opt in options"
        :key="opt"
        @click="onSelect(opt)"
        class="px-3 py-1.5 text-xs rounded-md border transition-colors"
        :class="selectedOption === opt
          ? 'border-[var(--accent-yellow)] bg-[color-mix(in_srgb,var(--accent-yellow)_15%,transparent)] text-[var(--accent-yellow)]'
          : 'border-[var(--border-standard)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-window)] hover:text-[var(--text-primary)]'"
        :disabled="answered"
      >
        {{ opt }}
      </button>
    </div>
    <!-- Free-form text input (always available as "Other") -->
    <div v-if="!answered" class="flex gap-2 mt-3">
      <input
        v-model="textResponse"
        placeholder="Or type a custom response..."
        class="flex-1 text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--accent-yellow)] transition-colors"
        @keydown.enter="submitText"
      />
      <button
        @click="submitText"
        :disabled="!textResponse.trim()"
        class="text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
        :class="textResponse.trim()
          ? 'bg-[var(--accent-yellow)] text-[var(--bg-base)] hover:opacity-90'
          : 'bg-[var(--bg-surface)] text-[var(--text-faint)]'"
      >
        Submit
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  question: string;
  options: string[];
  sessionId: string;
  answered?: boolean;
}>();

const emit = defineEmits<{
  answer: [option: string];
}>();

const selectedOption = ref<string | null>(null);
const textResponse = ref('');

function onSelect(opt: string) {
  selectedOption.value = opt;
  emit('answer', opt);
}

function submitText() {
  const text = textResponse.value.trim();
  if (!text) return;
  selectedOption.value = text;
  emit('answer', text);
}
</script>
