import { onMounted, onUnmounted } from 'vue';
import { useUiStore } from '../stores/ui';

export function useKeyboard() {
  const ui = useUiStore();

  function handleKeydown(e: KeyboardEvent) {
    const meta = e.metaKey || e.ctrlKey;

    // Cmd+E: Toggle view mode
    if (meta && e.key === 'e') {
      e.preventDefault();
      ui.toggleViewMode();
    }

    // Escape: Dismiss inline preview first, then return to Manager view
    if (e.key === 'Escape') {
      if (ui.inlinePreviewFile) {
        e.preventDefault();
        ui.inlinePreviewFile = null;
      } else if (ui.viewMode === 'editor') {
        e.preventDefault();
        ui.switchToMode('manager');
      }
    }

    // Cmd+/: Toggle terminal
    if (meta && e.key === '/') {
      e.preventDefault();
      ui.toggleTerminal();
    }

    // Cmd+N: New chat (emit event via custom event)
    if (meta && e.key === 'n') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('angy:new-chat'));
    }

    // Cmd+,: Open settings
    if (meta && e.key === ',') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('angy:open-settings'));
    }
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown));
  onUnmounted(() => document.removeEventListener('keydown', handleKeydown));

  return { handleKeydown };
}
