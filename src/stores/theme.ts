import { defineStore } from 'pinia';
import { ref } from 'vue';
import { applyTheme, type ThemeVariant } from '../themes/catppuccin';

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<ThemeVariant>('mocha');

  function setTheme(variant: ThemeVariant) {
    currentTheme.value = variant;
    applyTheme(variant);
    localStorage.setItem('angy-theme', variant);
  }

  function loadSavedTheme() {
    const saved = localStorage.getItem('angy-theme') as ThemeVariant | null;
    if (saved) setTheme(saved);
  }

  return { currentTheme, setTheme, loadSavedTheme };
});
