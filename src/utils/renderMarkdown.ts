import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

md.renderer.rules.code_inline = (tokens, idx) => {
  const content = md.utils.escapeHtml(tokens[idx].content);
  return `<code class="agent-code">${content}</code>`;
};

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = md.utils.escapeHtml(token.info.trim() || '');
  const code = md.utils.escapeHtml(token.content);
  return `<pre class="agent-pre"><code data-lang="${lang}">${code}</code></pre>`;
};

export function renderMarkdown(text: string): string {
  if (!text) return '';
  return md.render(text);
}

export function renderInline(text: string): string {
  if (!text) return '';
  return md.renderInline(text);
}
