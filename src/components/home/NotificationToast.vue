<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    <TransitionGroup name="toast">
      <div
        v-for="notification in ui.notifications"
        :key="notification.id"
        class="rounded-[var(--radius-md)] border px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur-sm"
        :class="{
          'bg-red-900/90 border-red-700 text-red-100': notification.type === 'error',
          'bg-yellow-900/90 border-yellow-700 text-yellow-100': notification.type === 'warning',
          'bg-blue-900/90 border-blue-700 text-blue-100': notification.type === 'info',
          'bg-green-900/90 border-green-700 text-green-100': notification.type === 'success'
        }"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm">{{ notification.title }}</div>
            <div class="text-xs mt-0.5 opacity-80 break-words">{{ notification.message }}</div>
          </div>
          <button
            @click="ui.dismissNotification(notification.id)"
            class="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(100%); }
.toast-leave-to { opacity: 0; transform: translateX(100%); }
</style>
