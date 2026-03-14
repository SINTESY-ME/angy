<template>
  <div
    class="w-10 flex flex-col items-center justify-start pt-3 bg-base border-l border-border-subtle hover:bg-surface cursor-pointer transition-colors flex-shrink-0"
    @click="fleetStore.effectsExpanded = true"
  >
    <svg class="w-4 h-4 text-txt-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
    <span class="text-[9px] text-txt-faint mt-1" style="writing-mode: vertical-lr">Effects</span>
  </div>
</template>

<script setup lang="ts">
import { useFleetStore } from '../../stores/fleet';

const fleetStore = useFleetStore();
</script>
