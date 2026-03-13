<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] shadow-[var(--shadow-md)] border max-w-sm"
        :class="toastClass(toast.type)"
      >
        <span class="text-xs">{{ toastIcon(toast.type) }}</span>
        <span class="text-xs flex-1">{{ toast.message }}</span>
        <button @click="removeToast(toast.id)" class="text-xs opacity-50 hover:opacity-100">×</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timeout: number;
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

function addToast(message: string, type: Toast['type'] = 'info', timeout = 4000) {
  const id = nextId++;
  toasts.value.push({ id, message, type, timeout });
  if (timeout > 0) {
    setTimeout(() => removeToast(id), timeout);
  }
}

function removeToast(id: number) {
  const idx = toasts.value.findIndex((t) => t.id === id);
  if (idx >= 0) toasts.value.splice(idx, 1);
}

function toastClass(type: Toast['type']) {
  switch (type) {
    case 'success':
      return 'bg-[var(--bg-raised)] border-[color-mix(in_srgb,var(--accent-green)_30%,transparent)] text-[var(--accent-green)]';
    case 'error':
      return 'bg-[var(--bg-raised)] border-[color-mix(in_srgb,var(--accent-red)_30%,transparent)] text-[var(--accent-red)]';
    case 'warning':
      return 'bg-[var(--bg-raised)] border-[color-mix(in_srgb,var(--accent-yellow)_30%,transparent)] text-[var(--accent-yellow)]';
    default:
      return 'bg-[var(--bg-raised)] border-[var(--border-standard)] text-[var(--text-secondary)]';
  }
}

function toastIcon(type: Toast['type']) {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    default:
      return 'ℹ';
  }
}

defineExpose({ addToast, removeToast });
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
