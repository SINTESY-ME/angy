<script setup lang="ts">
withDefaults(defineProps<{
  count?: number
  color?: 'ember' | 'teal'
}>(), {
  count: 5,
  color: 'ember',
})
</script>

<template>
  <div class="inline-flex items-end gap-[2px] h-3.5">
    <span
      v-for="i in count"
      :key="i"
      class="wave-bar"
      :class="color === 'teal' ? 'wave-bar-teal' : ''"
      :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
    />
  </div>
</template>
