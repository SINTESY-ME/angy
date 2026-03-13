<template>
  <nav class="w-14 flex-shrink-0 bg-base border-r border-border-standard flex flex-col items-center py-3 gap-1">
    <!-- Logo -->
    <button
      class="w-8 h-8 rounded-lg bg-gradient-to-br from-ember-500 to-ember-600 flex items-center justify-center mb-4 hover:opacity-80 transition-opacity"
      title="Home (⌘1)"
      @click="ui.navigateHome()"
    >
      <svg class="w-4 h-4 text-[var(--bg-base)]" fill="currentColor" viewBox="0 0 24 24">
        <path fill-rule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Projects -->
    <button
      class="w-10 h-10 rounded-lg flex items-center justify-center relative transition-all duration-150 ease-in-out"
      :class="ui.viewMode === 'home' ? 'text-ember-500' : 'text-txt-muted hover:text-txt-secondary'"
      title="Projects (⌘1)"
      @click="ui.navigateHome()"
    >
      <div v-if="ui.viewMode === 'home'" class="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-[3px] bg-gradient-to-b from-[#f59e0b] to-[#ea580c]"></div>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    </button>

    <!-- Board -->
    <button
      class="w-10 h-10 rounded-lg flex items-center justify-center relative transition-all duration-150 ease-in-out"
      :class="ui.viewMode === 'kanban' ? 'text-ember-500' : 'text-txt-muted hover:text-txt-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-txt-muted'"
      :disabled="!ui.activeProjectId"
      title="Board (⌘2)"
      @click="ui.switchToMode('kanban')"
    >
      <div v-if="ui.viewMode === 'kanban'" class="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-[3px] bg-gradient-to-b from-[#f59e0b] to-[#ea580c]"></div>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    </button>

    <!-- Agents -->
    <button
      class="w-10 h-10 rounded-lg flex items-center justify-center relative transition-all duration-150 ease-in-out"
      :class="ui.viewMode === 'agents' ? 'text-ember-500' : 'text-txt-muted hover:text-txt-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-txt-muted'"
      :disabled="!ui.activeProjectId"
      title="Agents (⌘3)"
      @click="ui.switchToMode('agents')"
    >
      <div v-if="ui.viewMode === 'agents'" class="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-[3px] bg-gradient-to-b from-[#f59e0b] to-[#ea580c]"></div>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    </button>

    <!-- Code -->
    <button
      class="w-10 h-10 rounded-lg flex items-center justify-center relative transition-all duration-150 ease-in-out"
      :class="ui.viewMode === 'code' ? 'text-ember-500' : 'text-txt-muted hover:text-txt-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-txt-muted'"
      :disabled="!ui.activeProjectId"
      title="Code (⌘4)"
      @click="ui.switchToMode('code')"
    >
      <div v-if="ui.viewMode === 'code'" class="absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-[3px] bg-gradient-to-b from-[#f59e0b] to-[#ea580c]"></div>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    </button>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Search -->
    <button
      class="w-10 h-10 rounded-lg flex items-center justify-center text-txt-muted hover:text-txt-secondary transition-all duration-150 ease-in-out"
      title="Command Palette (⌘K)"
      @click="openCommandPalette"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    </button>

    <!-- Settings -->
    <button
      class="w-10 h-10 rounded-lg flex items-center justify-center text-txt-muted hover:text-txt-secondary transition-all duration-150 ease-in-out"
      title="Settings"
      @click="openSettings"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useUiStore } from '../../stores/ui';

const ui = useUiStore();

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('angy:command-palette'));
}

function openSettings() {
  window.dispatchEvent(new CustomEvent('angy:open-settings'));
}
</script>
