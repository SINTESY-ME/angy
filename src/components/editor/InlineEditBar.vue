<template>
  <div class="border-t border-[var(--border-standard)] bg-[var(--bg-surface)] px-4 py-3">
    <!-- State 1: Input -->
    <div v-if="state === 'input'" class="flex flex-col gap-2">
      <div class="text-xs text-[var(--text-muted)]">
        {{ displayFileName }}:{{ startLine }}-{{ endLine }} ({{ lineCount }} lines)
      </div>
      <div class="flex gap-2">
        <select v-model="modelId"
                class="text-xs bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border-standard)] rounded px-2 py-1">
          <optgroup v-for="group in MODEL_GROUPS" :key="group.category" :label="group.category">
            <option v-for="m in group.items" :key="m.id" :value="m.id">{{ m.name }}</option>
          </optgroup>
        </select>
        <input v-model="instruction" ref="instructionInput"
               @keydown.enter="submit" @keydown.escape="$emit('cancelled')"
               placeholder="Describe your edit..."
               class="flex-1 text-sm bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded px-3 py-1.5 outline-none focus:border-[var(--accent-mauve)]" />
        <button @click="submit" :disabled="!instruction.trim()"
                class="text-xs px-3 py-1 rounded bg-[var(--accent-mauve)] text-[var(--bg-base)] font-medium disabled:opacity-40">
          Submit
        </button>
        <button @click="$emit('cancelled')"
                class="text-xs px-3 py-1 rounded bg-[var(--bg-raised)] text-[var(--text-muted)]">
          Cancel
        </button>
      </div>
    </div>

    <!-- State 2: Processing -->
    <div v-else-if="state === 'processing'" class="flex items-center gap-3">
      <span class="text-sm text-[var(--text-secondary)]">Claude is editing{{ dots }}</span>
      <button @click="$emit('cancel-requested')"
              class="text-xs px-3 py-1 rounded bg-[var(--bg-raised)] text-[var(--text-muted)]">
        Cancel
      </button>
    </div>

    <!-- State 3: Review -->
    <div v-else-if="state === 'review'" class="flex items-center gap-3">
      <span class="text-sm text-[var(--text-secondary)]">Review changes</span>
      <button @click="$emit('accept-all', filePath)"
              class="text-xs px-3 py-1 rounded bg-[color-mix(in_srgb,var(--accent-green)_20%,transparent)] text-[var(--accent-green)]">
        Accept All
      </button>
      <button @click="$emit('reject-all', filePath)"
              class="text-xs px-3 py-1 rounded bg-[color-mix(in_srgb,var(--accent-red)_20%,transparent)] text-[var(--accent-red)]">
        Reject All
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue';
import { MODEL_GROUPS, DEFAULT_MODEL_ID } from '@/constants/models';

// ── Props & Emits ─────────────────────────────────────────────────────────

const props = defineProps<{
  filePath: string;
  selectedCode: string;
  startLine: number;
  endLine: number;
}>();

const emit = defineEmits<{
  submitted: [filePath: string, selectedCode: string, instruction: string, startLine: number, endLine: number, modelId: string];
  cancelled: [];
  'cancel-requested': [];
  'accept-all': [filePath: string];
  'reject-all': [filePath: string];
}>();

// ── State ─────────────────────────────────────────────────────────────────

type EditBarState = 'input' | 'processing' | 'review';

const state = ref<EditBarState>('input');
const instruction = ref('');
const modelId = ref(DEFAULT_MODEL_ID);
const instructionInput = ref<HTMLInputElement | null>(null);
let dotsTimer: ReturnType<typeof setInterval> | null = null;
const dotCount = ref(0);

// ── Computed ──────────────────────────────────────────────────────────────

const displayFileName = computed(() => {
  const parts = props.filePath.split('/');
  return parts[parts.length - 1] || props.filePath;
});

const lineCount = computed(() => Math.max(1, props.endLine - props.startLine + 1));

const dots = computed(() => '.'.repeat((dotCount.value % 3) + 1));

// ── Methods ───────────────────────────────────────────────────────────────

function submit() {
  if (!instruction.value.trim()) return;
  emit('submitted', props.filePath, props.selectedCode, instruction.value, props.startLine, props.endLine, modelId.value);
}

function setProcessing() {
  state.value = 'processing';
  dotCount.value = 0;
  dotsTimer = setInterval(() => { dotCount.value++; }, 400);
}

function setReviewMode() {
  stopDotsTimer();
  state.value = 'review';
}

function clear() {
  stopDotsTimer();
  state.value = 'input';
  instruction.value = '';
}

function focusInput() {
  nextTick(() => instructionInput.value?.focus());
}

function stopDotsTimer() {
  if (dotsTimer !== null) {
    clearInterval(dotsTimer);
    dotsTimer = null;
  }
}

onUnmounted(() => stopDotsTimer());

// ── Expose ────────────────────────────────────────────────────────────────

defineExpose({ setProcessing, setReviewMode, clear, focusInput });
</script>
