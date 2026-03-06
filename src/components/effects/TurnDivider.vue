<template>
  <div
    class="flex items-center gap-2 px-3 py-1 cursor-pointer"
    :class="highlighted ? 'bg-[color-mix(in_srgb,var(--accent-teal)_10%,transparent)] border-l-2 border-[var(--accent-teal)]' : ''"
    @click="$emit('click', turnId)"
  >
    <div
      class="text-[10px] font-semibold uppercase tracking-wider"
      :class="highlighted ? 'text-[var(--accent-teal)]' : 'text-[var(--text-faint)]'"
    >
      Turn {{ turnId }}
    </div>
    <div v-if="relativeTime" class="text-[10px] text-[var(--text-faint)]">
      {{ relativeTime }}
    </div>
    <div class="flex-1 border-b border-[var(--border-subtle)]"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  turnId: number;
  highlighted: boolean;
  relativeTime?: string;
}>();

defineEmits<{
  click: [turnId: number];
}>();
</script>
