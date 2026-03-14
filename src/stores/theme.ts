import { defineStore } from 'pinia';
import { applyTheme } from '../themes/catppuccin';

export const useThemeStore = defineStore('theme', () => {
  function loadSavedTheme() {
    applyTheme();
  }

  return { loadSavedTheme };
});
