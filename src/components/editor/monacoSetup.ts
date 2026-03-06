import type * as monaco from 'monaco-editor';

// ── Catppuccin Mocha Theme for Monaco ─────────────────────────────────────

export function getMonacoTheme(): monaco.editor.IStandaloneThemeData {
  return {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'cdd6f4', background: '0e0e0e' },
      { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'cba6f7' },
      { token: 'string', foreground: 'a6e3a1' },
      { token: 'number', foreground: 'fab387' },
      { token: 'type', foreground: '89b4fa' },
      { token: 'type.identifier', foreground: '89b4fa' },
      { token: 'function', foreground: '89b4fa' },
      { token: 'variable', foreground: 'cdd6f4' },
      { token: 'constant', foreground: 'fab387' },
      { token: 'operator', foreground: '89dceb' },
      { token: 'delimiter', foreground: '9399b2' },
      { token: 'tag', foreground: 'cba6f7' },
      { token: 'attribute.name', foreground: '89b4fa' },
      { token: 'attribute.value', foreground: 'a6e3a1' },
      { token: 'regexp', foreground: 'f38ba8' },
    ],
    colors: {
      'editor.background': '#0e0e0e',
      'editor.foreground': '#cdd6f4',
      'editor.lineHighlightBackground': '#141414',
      'editor.selectionBackground': '#45475a66',
      'editor.inactiveSelectionBackground': '#45475a33',
      'editorCursor.foreground': '#cba6f7',
      'editorLineNumber.foreground': '#45475a',
      'editorLineNumber.activeForeground': '#a6adc8',
      'editorIndentGuide.background': '#1e1e1e',
      'editorIndentGuide.activeBackground': '#2a2a2a',
      'editorBracketMatch.background': '#45475a44',
      'editorBracketMatch.border': '#cba6f766',
      'editor.findMatchBackground': '#cba6f733',
      'editor.findMatchHighlightBackground': '#cba6f722',
      'editorWidget.background': '#141414',
      'editorWidget.border': '#2a2a2a',
      'editorSuggestWidget.background': '#141414',
      'editorSuggestWidget.border': '#2a2a2a',
      'editorSuggestWidget.selectedBackground': '#252525',
      'scrollbarSlider.background': '#45475a33',
      'scrollbarSlider.hoverBackground': '#45475a55',
      'scrollbarSlider.activeBackground': '#45475a77',
      'editorOverviewRuler.border': '#1e1e1e',
      'diffEditor.insertedTextBackground': '#a6e3a11a',
      'diffEditor.removedTextBackground': '#f38ba81a',
    },
  };
}

// ── Language Detection ────────────────────────────────────────────────────

const extensionMap: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.vue': 'html',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'c',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.json': 'json',
  '.jsonc': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.svg': 'xml',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'ini',
  '.ini': 'ini',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.php': 'php',
  '.lua': 'lua',
  '.r': 'r',
  '.R': 'r',
  '.dart': 'dart',
  '.dockerfile': 'dockerfile',
  '.tf': 'hcl',
};

const filenameMap: Record<string, string> = {
  'Dockerfile': 'dockerfile',
  'Makefile': 'makefile',
  'CMakeLists.txt': 'cmake',
  '.gitignore': 'ini',
  '.env': 'ini',
  '.editorconfig': 'ini',
};

export function detectLanguage(filePath: string): string {
  if (!filePath) return 'plaintext';

  // Check full filename first
  const fileName = filePath.split('/').pop() ?? '';
  if (filenameMap[fileName]) return filenameMap[fileName];

  // Check extension
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot >= 0) {
    const ext = fileName.slice(lastDot);
    if (extensionMap[ext]) return extensionMap[ext];
  }

  return 'plaintext';
}
