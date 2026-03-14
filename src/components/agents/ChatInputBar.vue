<template>
  <div class="flex items-end gap-2 px-4 py-3 bg-base border-t border-border-subtle">
    <!-- Agent picker placeholder -->
    <button
      class="text-xs text-txt-muted hover:text-txt-secondary px-2 py-1 rounded-md hover:bg-raised transition-colors flex items-center gap-1 flex-shrink-0"
      title="Select agent"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
        <circle cx="8" cy="5" r="3" />
        <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
      <span class="text-[10px]">Agent</span>
    </button>

    <!-- Text input -->
    <input
      ref="inputRef"
      type="text"
      v-model="draft"
      @keydown.enter.prevent="sendMessage"
      placeholder="Send a message..."
      class="flex-1 bg-transparent text-[13px] text-txt-primary placeholder:text-txt-faint outline-none min-h-[32px]"
    />

    <!-- Model selector -->
    <ModelSelector v-model="selectedModel" />

    <!-- Stop / Send button -->
    <button
      v-if="processing"
      class="text-xs text-txt-faint hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors flex-shrink-0 flex items-center gap-1"
      @click="$emit('stop')"
      title="Stop"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
        <rect x="3" y="3" width="10" height="10" rx="1" />
      </svg>
    </button>
    <button
      v-else
      class="bg-gradient-to-r from-ember-500 to-ember-600 text-base text-xs font-medium rounded-lg h-8 px-4 flex items-center gap-1 flex-shrink-0 transition-colors"
      :class="!draft.trim() ? 'opacity-40 cursor-not-allowed' : ''"
      :disabled="!draft.trim()"
      @click="sendMessage"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 8h12M10 4l4 4-4 4" />
      </svg>
      Send
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ModelSelector from '../input/ModelSelector.vue';

defineProps<{
  processing: boolean;
}>();

const emit = defineEmits<{
  send: [message: string];
  stop: [];
}>();

const draft = ref('');
const selectedModel = ref('claude-sonnet-4-6');
const inputRef = ref<HTMLInputElement | null>(null);

function sendMessage() {
  const text = draft.value.trim();
  if (!text) return;
  emit('send', text);
  draft.value = '';
}
</script>
