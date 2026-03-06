import { ref } from 'vue';
import { createHighlighter, type Highlighter } from 'shiki';

// True module-level singleton — shared across all ChatMessage instances.
export const highlighter = ref<Highlighter | null>(null);
let initPromise: Promise<void> | null = null;

export function initShiki(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = createHighlighter({
    themes: ['catppuccin-mocha'],
    langs: [
      'typescript', 'javascript', 'python', 'rust', 'cpp', 'c', 'bash', 'sh',
      'json', 'html', 'css', 'sql', 'yaml', 'markdown', 'go',
      'java', 'ruby', 'php', 'swift', 'kotlin', 'diff', 'cmake',
    ],
  }).then(h => {
    highlighter.value = h;
  }).catch(e => {
    console.warn('Shiki init failed:', e);
    initPromise = null; // allow retry
  });
  return initPromise;
}
