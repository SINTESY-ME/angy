<template>
  <!-- User message -->
  <div v-if="role === 'user'" class="user-card select-none">
    <div class="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed select-text">
      {{ content }}
    </div>
    <div v-if="images?.length" class="flex flex-wrap gap-2 mt-3">
      <div
        v-for="(img, i) in images"
        :key="i"
        class="rounded-md border border-[var(--border-standard)] overflow-hidden"
      >
        <img :src="img" class="max-w-[200px] max-h-[200px] object-contain block" />
      </div>
    </div>
    <div class="flex items-center justify-end gap-2 mt-2.5">
      <span v-if="relativeTime" class="text-[var(--text-xs)] text-[var(--text-faint)]">{{ relativeTime }}</span>
      <button
        v-if="turnId > 0"
        class="text-[var(--text-xs)] px-2 py-0.5 rounded text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
        @click="$emit('revert', turnId)"
      >
        Revert
      </button>
    </div>
  </div>

  <!-- Assistant message -->
  <div v-else-if="role === 'assistant'" class="py-2">
    <ThinkingBlock
      v-if="thinkingContent"
      :content="thinkingContent"
      :elapsed-ms="thinkingElapsedMs"
      :is-streaming="thinkingStreaming"
    />
    <div class="flex items-center gap-2 mb-2 select-none">
      <div class="claude-avatar">C</div>
      <span class="text-[var(--text-xs)] font-medium text-[var(--text-secondary)]">Claude</span>
      <span v-if="relativeTime" class="text-[var(--text-xs)] text-[var(--text-faint)]">{{ relativeTime }}</span>
    </div>
    <div
      class="message-content select-text"
      v-html="renderedHtml"
      @click="handleContentClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import MarkdownIt from 'markdown-it';
import { highlighter, initShiki } from './shiki';
import ThinkingBlock from './ThinkingBlock.vue';

const props = defineProps<{
  role: 'user' | 'assistant' | 'tool';
  content: string;
  turnId: number;
  toolName?: string;
  timestamp?: number;
  images?: string[];
  thinkingContent?: string;
  thinkingElapsedMs?: number;
  thinkingStreaming?: boolean;
}>();

const emit = defineEmits<{
  navigate: [payload: { filePath: string; line?: number }];
  revert: [turnId: number];
  'apply-code': [payload: { code: string; language: string }];
}>();

onMounted(() => initShiki());

// ── Markdown renderer ─────────────────────────────────────────────────────

const md = new MarkdownIt({
  html: true,      // allow inline HTML so Claude's code-review output renders correctly
  linkify: true,
  breaks: false,   // Claude uses standard markdown paragraphs; single \n = continuation
  typographer: false,
});

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.info.trim() || 'text';
  const code = token.content;
  if (highlighter.value) {
    try {
      return highlighter.value.codeToHtml(code, { lang, theme: 'catppuccin-mocha' });
    } catch { /* fallthrough */ }
  }
  return `<pre class="shiki"><code>${md.utils.escapeHtml(code)}</code></pre>`;
};

// Make file paths clickable (only matches absolute paths not already inside href/src)
function linkifyFilePaths(html: string): string {
  return html.replace(
    /(?<![="'`])((?:\/[\w.@()\[\]-]+){2,}(?:\.[\w]+)?)(?::(\d+))?(?=[\s<,;)"']|$)/g,
    (match, filePath, line) => {
      const lineParam = line ? `&line=${line}` : '';
      return `<a href="angy://open?file=${encodeURIComponent(filePath)}${lineParam}" class="file-link">${match}</a>`;
    },
  );
}

const renderedHtml = computed(() => {
  if (props.role !== 'assistant') return '';
  let html = md.render(props.content || '');
  html = linkifyFilePaths(html);
  return html;
});

// ── Relative time ─────────────────────────────────────────────────────────

const relativeTime = computed(() => {
  if (!props.timestamp) return '';
  // Normalize: timestamps < 1e12 are in seconds (from DB), convert to ms
  const tsMs = props.timestamp < 1e12 ? props.timestamp * 1000 : props.timestamp;
  const diff = Date.now() - tsMs;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
});

// ── Click handler (file links) ────────────────────────────────────────────

function handleContentClick(e: MouseEvent) {
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href) return;
  e.preventDefault();
  try {
    const url = new URL(href);
    if (url.protocol === 'angy:' && url.hostname === 'open') {
      const filePath = url.searchParams.get('file');
      const line = url.searchParams.get('line');
      if (filePath) emit('navigate', { filePath, line: line ? parseInt(line, 10) : undefined });
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      window.open(href, '_blank');
    }
  } catch { /* ignore */ }
}
</script>

<style scoped>
/* ── User message card ──────────────────────────────────────────────────── */
.user-card {
  background: var(--bg-raised);
  border-left: 2px solid var(--accent-mauve);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

/* ── Claude avatar ──────────────────────────────────────────────────────── */
.claude-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-raised);
  border: 1px solid var(--border-standard);
  color: var(--accent-mauve);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── Markdown content ───────────────────────────────────────────────────── */
.message-content {
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-primary);
}

/* Paragraphs */
.message-content :deep(p) {
  margin-bottom: 0.65em;
}
.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

/* Headings */
.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4),
.message-content :deep(h5),
.message-content :deep(h6) {
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.1em;
  margin-bottom: 0.35em;
}
.message-content :deep(h1:first-child),
.message-content :deep(h2:first-child),
.message-content :deep(h3:first-child) {
  margin-top: 0;
}
.message-content :deep(h1) { font-size: 1.3em; color: var(--text-primary); }
.message-content :deep(h2) { font-size: 1.15em; color: var(--accent-mauve); }
.message-content :deep(h3) { font-size: 1.05em; color: var(--text-primary); }
.message-content :deep(h4) { font-size: 1em;    color: var(--text-secondary); }
.message-content :deep(h5) { font-size: 0.95em; color: var(--text-secondary); }
.message-content :deep(h6) { font-size: 0.9em;  color: var(--text-muted); }

/* Inline emphasis */
.message-content :deep(strong) {
  font-weight: 600;
  color: var(--text-primary);
}
.message-content :deep(em) {
  font-style: italic;
  color: var(--text-secondary);
}

/* Inline code */
.message-content :deep(:not(pre) > code) {
  font-family: var(--font-mono);
  font-size: 0.87em;
  background: var(--bg-raised);
  border: 1px solid var(--border-standard);
  border-radius: 4px;
  padding: 1px 5px;
}

/* Code blocks */
.message-content :deep(pre) {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  overflow-x: auto;
  margin: 10px 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
}
.message-content :deep(pre code) {
  font-family: var(--font-mono);
  font-size: 12px;
  background: transparent;
  border: none;
  padding: 0;
  border-radius: 0;
}

/* Shiki blocks */
.message-content :deep(.shiki) {
  background: var(--bg-base) !important;
  border: 1px solid var(--border-subtle) !important;
  border-radius: 8px;
  padding: 12px 14px;
  overflow-x: auto;
  margin: 10px 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
}
.message-content :deep(.shiki code) {
  font-family: var(--font-mono);
  font-size: 12px;
  background: transparent;
  border: none;
  padding: 0;
}
.message-content :deep(.shiki .line) {
  display: block;
}

/* Lists */
.message-content :deep(ul),
.message-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.4em 0 0.65em;
}
.message-content :deep(li) {
  margin: 0.25em 0;
  line-height: 1.55;
}
.message-content :deep(li > ul),
.message-content :deep(li > ol) {
  margin: 0.15em 0;
}
.message-content :deep(ul > li) { list-style-type: disc; }
.message-content :deep(ul > li > ul > li) { list-style-type: circle; }
.message-content :deep(ol > li) { list-style-type: decimal; }

/* Blockquote */
.message-content :deep(blockquote) {
  border-left: 3px solid var(--accent-mauve);
  padding: 4px 12px;
  margin: 10px 0;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--accent-mauve) 5%, transparent);
  border-radius: 0 6px 6px 0;
}
.message-content :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

/* Horizontal rule */
.message-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: 14px 0;
}

/* Tables */
.message-content :deep(table) {
  border-collapse: collapse;
  margin: 10px 0;
  width: 100%;
  font-size: var(--text-sm);
}
.message-content :deep(th),
.message-content :deep(td) {
  border: 1px solid var(--border-standard);
  padding: 5px 10px;
  text-align: left;
}
.message-content :deep(th) {
  background: var(--bg-raised);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 0.03em;
}
.message-content :deep(tr:nth-child(even) > td) {
  background: color-mix(in srgb, var(--bg-raised) 40%, transparent);
}

/* Links */
.message-content :deep(a) {
  color: var(--accent-blue);
  text-decoration: none;
}
.message-content :deep(a:hover) {
  text-decoration: underline;
}
.message-content :deep(a.file-link) {
  color: var(--accent-teal);
  font-family: var(--font-mono);
  font-size: 0.87em;
}
</style>
