<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="bg-[var(--bg-window)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-[480px] max-w-[480px] max-h-[80vh] flex flex-col" style="box-shadow: var(--shadow-lg)">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 class="text-sm font-semibold text-[var(--text-primary)]">Scheduler Configuration</h2>
          <button
            class="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            @click="$emit('close')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <!-- Auto-schedule toggle -->
          <div class="flex items-center justify-between">
            <label class="text-sm text-[var(--text-primary)]">Auto-schedule</label>
            <button
              class="relative w-9 h-5 rounded-full transition-colors"
              :class="config.enabled ? 'bg-[var(--accent-green)]' : 'bg-[var(--bg-raised)]'"
              @click="config.enabled = !config.enabled"
            >
              <span
                class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                :class="config.enabled ? 'left-[18px]' : 'left-0.5'"
              />
            </button>
          </div>

          <!-- Max concurrent epics -->
          <div>
            <label class="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Max Concurrent Epics</label>
            <input
              v-model.number="config.maxConcurrentEpics"
              type="number"
              min="1"
              max="10"
              class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-[var(--border-subtle)]
                     bg-[var(--bg-raised)] text-[var(--text-primary)]
                     focus:outline-none focus:border-[var(--accent-mauve)] transition-colors"
            />
          </div>

          <!-- Tick interval -->
          <div>
            <label class="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Tick Interval (seconds)</label>
            <input
              v-model.number="tickSeconds"
              type="number"
              min="5"
              max="3600"
              class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-[var(--border-subtle)]
                     bg-[var(--bg-raised)] text-[var(--text-primary)]
                     focus:outline-none focus:border-[var(--accent-mauve)] transition-colors"
            />
          </div>

          <!-- Daily cost budget -->
          <div>
            <label class="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Daily Cost Budget ($)</label>
            <input
              v-model.number="config.dailyCostBudget"
              type="number"
              min="0"
              step="0.5"
              class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-[var(--border-subtle)]
                     bg-[var(--bg-raised)] text-[var(--text-primary)]
                     focus:outline-none focus:border-[var(--accent-mauve)] transition-colors"
            />
          </div>

          <!-- Priority weights -->
          <div>
            <label class="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
              Priority Weights
              <span class="text-[var(--text-muted)] font-normal ml-1">(sum: {{ weightSum.toFixed(2) }})</span>
            </label>
            <div class="space-y-2">
              <div v-for="(label, key) in weightLabels" :key="key" class="flex items-center gap-2">
                <span class="text-xs text-[var(--text-secondary)] w-28 shrink-0">{{ label }}</span>
                <input
                  v-model.number="config.weights[key]"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="flex-1 accent-[var(--accent-mauve)]"
                />
                <span class="text-[10px] text-[var(--text-muted)] w-8 text-right">{{ config.weights[key].toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button
            class="text-xs px-3 py-1.5 rounded border border-[var(--border-subtle)]
                   text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                   hover:border-[var(--border-standard)] transition-colors"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            class="text-xs px-3 py-1.5 rounded bg-[var(--accent-mauve)] text-[var(--bg-base)] font-medium
                   hover:opacity-90 transition-opacity"
            @click="save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue';
import type { SchedulerConfig } from '@/engine/KosTypes';
import { Scheduler } from '@/engine/Scheduler';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  close: [];
  save: [config: SchedulerConfig];
}>();

const defaultConfig: SchedulerConfig = {
  enabled: false,
  tickIntervalMs: 30000,
  maxConcurrentEpics: 2,
  dailyCostBudget: 10,
  weights: {
    manualHint: 0.3,
    dependencyDepth: 0.2,
    age: 0.2,
    complexity: 0.15,
    rejectionPenalty: 0.15,
  },
};

const config = ref<SchedulerConfig>(structuredClone(defaultConfig));
const tickSeconds = ref(config.value.tickIntervalMs / 1000);

watch(() => props.visible, async (v) => {
  if (v) {
    try {
      config.value = await Scheduler.getInstance().loadConfig();
    } catch {
      config.value = structuredClone(defaultConfig);
    }
    tickSeconds.value = config.value.tickIntervalMs / 1000;
  }
});

const weightLabels: Record<keyof SchedulerConfig['weights'], string> = {
  manualHint: 'Manual hint',
  dependencyDepth: 'Dependency depth',
  age: 'Age',
  complexity: 'Complexity',
  rejectionPenalty: 'Rejection penalty',
};

const weightSum = computed(() =>
  Object.values(config.value.weights).reduce((s, v) => s + v, 0),
);

function save() {
  config.value.tickIntervalMs = tickSeconds.value * 1000;
  // toRaw strips the Vue reactive Proxy — structuredClone can't clone Proxies in WebKit
  const raw = toRaw(config.value);
  raw.weights = toRaw(raw.weights);
  emit('save', JSON.parse(JSON.stringify(raw)));
  emit('close');
}
</script>
