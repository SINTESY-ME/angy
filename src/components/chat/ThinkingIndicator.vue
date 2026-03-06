<template>
  <div class="flex items-center gap-1 px-4 py-2">
    <span class="text-xs text-[var(--text-muted)]">Thinking</span>
    <div class="flex gap-0.5">
      <div class="dot" style="animation-delay: 0ms"></div>
      <div class="dot" style="animation-delay: 150ms"></div>
      <div class="dot" style="animation-delay: 300ms"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props needed — purely visual
</script>

<style scoped>
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-mauve);
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-4px);
  }
}
</style>
