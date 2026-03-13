# 00 — Design System

> Pixel reference: [screenshots/01-projects-view.png](screenshots/01-projects-view.png), [screenshots/02-nav-rail.png](screenshots/02-nav-rail.png), [screenshots/12-projects-header.png](screenshots/12-projects-header.png)

---

## 1. Color Token Map

The prototype uses a custom dark palette. Below is the mapping from **prototype Tailwind tokens** to the **existing `main.css` CSS variables**, plus tokens that must be **added**.

### Backgrounds

| Prototype Tailwind | Hex | CSS Variable | Status |
|---|---|---|---|
| `bg-base` | `#0f1117` | `--bg-base` | **Update** from `#0e0e0e` |
| `bg-surface` | `#1c1f2a` | `--bg-surface` | **Update** from `#141414` |
| `bg-window` | `#161922` | `--bg-window` | **Update** from `#1a1a1a` |
| `bg-raised` | `#252836` | `--bg-raised` | **Update** from `#252525` |
| `bg-raised-hover` | `#2d3145` | `--bg-raised-hover` | **Add** |

### Borders

| Prototype Tailwind | Value | CSS Variable | Status |
|---|---|---|---|
| `border-subtle` | `rgba(255,255,255,0.04)` | `--border-subtle` | **Update** from `#1e1e1e` |
| `border-standard` | `rgba(255,255,255,0.08)` | `--border-standard` | **Update** from `#2a2a2a` |

### Text

| Prototype Tailwind | Hex | CSS Variable | Status |
|---|---|---|---|
| `txt-primary` | `#e2e8f0` | `--text-primary` | **Update** from `#cdd6f4` |
| `txt-secondary` | `#94a3b8` | `--text-secondary` | **Update** from `#a6adc8` |
| `txt-muted` | `#64748b` | `--text-muted` | **Update** from `#6c7086` |
| `txt-faint` | `#475569` | `--text-faint` | **Update** from `#45475a` |

### Accent Colors

| Prototype Tailwind | Hex | CSS Variable | Status |
|---|---|---|---|
| `ember-400` | `#fb923c` | `--accent-ember-400` | **Add** |
| `ember-500` / `ember` | `#f59e0b` | `--accent-ember` | **Add** (primary brand) |
| `ember-600` | `#ea580c` | `--accent-ember-600` | **Add** |
| `cyan-400` / `cyan` | `#22d3ee` | `--accent-cyan` | **Add** |
| `cyan-500` | `#06b6d4` | — | Available via Tailwind |
| `teal` (DEFAULT) | `#10b981` | `--accent-teal` | Keep (`#94e2d5` → `#10b981`) |
| `teal-400` | `#2dd4bf` | `--accent-teal-400` | **Add** |
| `rose-400` | `#FF6B8A` | `--accent-rose` | **Add** |
| `rose-500` | `#EF4466` | — | Available via Tailwind |
| `purple-400` | via Tailwind | `--accent-mauve` | Keep existing |

### Semantic Colors (keep existing, update values)

| Token | Maps to |
|---|---|
| `--color-primary` | `--accent-ember` (was mauve) |
| `--color-success` | `--accent-teal` |
| `--color-warning` | `--accent-ember-400` |
| `--color-error` | Tailwind `red-400` / `#f87171` |
| `--color-info` | `--accent-cyan` |

### Theme Integration

Update `src/themes/catppuccin.ts` `ThemeTokens` interface to include:
- `accentEmber`, `accentEmber400`, `accentEmber600`
- `accentCyan`
- `bgRaisedHover`

Update the `mocha` variant values to match the prototype palette. The `applyTheme()` function and `tokenToCssVar` map must be extended.

---

## 2. Typography

| Role | Font | Size | Weight | Line-height | Usage |
|---|---|---|---|---|---|
| Body default | Inter | 13px | 400 | 1.5 | Keep existing `main.css` |
| View title | Inter | 14px (`text-sm`) | 600 | 1.5 | "Projects", "Board", "Agents", "Code" in headers |
| Page heading | Inter | 24px (`text-2xl`) | 700 | 1.2 | "Good afternoon" greeting |
| Card title | Inter | 16px (`text-base`) | 600 | 1.4 | Project card names, epic titles |
| Card description | Inter | 12px (`text-xs`) | 400 | 1.5 | Project descriptions |
| Stat / badge | Inter | 10px (`text-[10px]`) | 500 | 1.3 | Status badges, agent counts, costs |
| Micro label | Inter | 9px (`text-[9px]`) | 500 | 1.2 | Section headers, turn counts |
| Code / mono | JetBrains Mono | 12px | 400 | 1.67 (20px) | Editor, file names, epic IDs |
| Code inline | JetBrains Mono | 11px | 400 | — | `<code>` in chat messages |

### Font Loading

Keep existing Google Fonts import. Add weight `300` and `800` to Inter to match prototype:

```
Inter:wght@300;400;500;600;700;800
```

---

## 3. Spacing Scale

The prototype uses Tailwind's default spacing scale. Key values extracted:

| Token | Value | Usage |
|---|---|---|
| `p-3` | 12px | Card inner padding (small cards) |
| `p-4` | 16px | Active card padding, board column gaps |
| `p-5` | 20px | Project card padding, header `px` |
| `p-8` | 32px | Projects view outer padding |
| `gap-1.5` | 6px | Avatar stacks, chip rows |
| `gap-2` | 8px | Filter chip row, agent rows |
| `gap-3` | 12px | Board columns gap, header items |
| `gap-4` | 16px | Project grid gap, board scrollable area |
| `gap-5` | 20px | — |

---

## 4. Border Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | 2px | Wave bars |
| `rounded` | 4px | Priority badges, inline code |
| `rounded-md` | 6px | Agent avatars, quick action buttons |
| `rounded-lg` | 8px | Rail buttons, search inputs, chips, popover rows |
| `rounded-xl` | 12px | Epic cards, popover panels, editor tabs border |
| `rounded-2xl` | 16px | Project cards, New Project card |
| `rounded-full` | 9999px | Status dots, filter chips, avatar dots |

---

## 5. Shadows

| Name | Value | Usage |
|---|---|---|
| Card lift hover | `0 8px 24px rgba(0,0,0,0.3)` | `.card-lift:hover` |
| Active card glow (teal) | `0 0 24px -6px rgba(16,185,129,0.10)` | Active epic cards |
| Review card glow (orange) | `0 0 16px -6px rgba(251,146,60,0.10)` | Review epic cards |
| Popover drop | `shadow-2xl shadow-black/40` | All popovers |

---

## 6. Tailwind Config Extensions

Add to `tailwind.config.ts` (or Vue's Tailwind config):

```ts
theme: {
  extend: {
    colors: {
      base: 'var(--bg-base)',
      surface: 'var(--bg-surface)',
      window: 'var(--bg-window)',
      raised: 'var(--bg-raised)',
      'raised-hover': 'var(--bg-raised-hover)',
      ember: {
        400: 'var(--accent-ember-400)',
        500: 'var(--accent-ember)',
        600: 'var(--accent-ember-600)',
        DEFAULT: 'var(--accent-ember)',
      },
      cyan: {
        400: 'var(--accent-cyan)',
        DEFAULT: 'var(--accent-cyan)',
      },
      teal: {
        400: 'var(--accent-teal-400)',
        DEFAULT: 'var(--accent-teal)',
      },
      txt: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
      },
      border: {
        subtle: 'var(--border-subtle)',
        standard: 'var(--border-standard)',
      },
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
  },
}
```

---

## 7. Migration Checklist

1. Update `:root` in `main.css` with new hex values from prototype
2. Add new tokens: `--bg-raised-hover`, `--accent-ember*`, `--accent-cyan`, `--accent-teal-400`, `--accent-rose`
3. Update `ThemeTokens` interface in `catppuccin.ts`
4. Update all theme variant objects with new token keys
5. Extend `tokenToCssVar` mapping
6. Configure Tailwind to use CSS variable references
7. Replace `--accent-mauve` as `--color-primary` with `--accent-ember`
8. Update scrollbar thumb from teal to `rgba(255,255,255,0.08)` / `rgba(255,255,255,0.14)` on hover
