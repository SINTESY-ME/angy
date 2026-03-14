/**
 * Angy theme — single dark theme matching the prototype pixel-for-pixel.
 *
 * Colors taken directly from mixprototype.html tailwind.config.
 */

export interface ThemeTokens {
  bgBase: string;
  bgSurface: string;
  bgWindow: string;
  bgRaised: string;
  bgRaisedHover: string;
  borderSubtle: string;
  borderStandard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accentMauve: string;
  accentBlue: string;
  accentGreen: string;
  accentRed: string;
  accentYellow: string;
  accentTeal: string;
  accentPeach: string;
  accentEmber: string;
  accentEmber400: string;
  accentEmber600: string;
  accentCyan: string;
  accentTeal400: string;
  accentRose: string;
}

export const theme: ThemeTokens = {
  bgBase: "#0f1117",
  bgSurface: "#1c1f2a",
  bgWindow: "#161922",
  bgRaised: "#252836",
  bgRaisedHover: "#2d3145",
  borderSubtle: "rgba(255,255,255,0.04)",
  borderStandard: "rgba(255,255,255,0.08)",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textFaint: "#475569",
  accentMauve: "#cba6f7",
  accentBlue: "#89b4fa",
  accentGreen: "#a6e3a1",
  accentRed: "#f38ba8",
  accentYellow: "#f9e2af",
  accentTeal: "#10b981",
  accentPeach: "#fab387",
  accentEmber: "#f59e0b",
  accentEmber400: "#fb923c",
  accentEmber600: "#ea580c",
  accentCyan: "#22d3ee",
  accentTeal400: "#2dd4bf",
  accentRose: "#FF6B8A",
};

const tokenToCssVar: Record<keyof ThemeTokens, string> = {
  bgBase: "--bg-base",
  bgSurface: "--bg-surface",
  bgWindow: "--bg-window",
  bgRaised: "--bg-raised",
  bgRaisedHover: "--bg-raised-hover",
  borderSubtle: "--border-subtle",
  borderStandard: "--border-standard",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  textFaint: "--text-faint",
  accentMauve: "--accent-mauve",
  accentBlue: "--accent-blue",
  accentGreen: "--accent-green",
  accentRed: "--accent-red",
  accentYellow: "--accent-yellow",
  accentTeal: "--accent-teal",
  accentPeach: "--accent-peach",
  accentEmber: "--accent-ember",
  accentEmber400: "--accent-ember-400",
  accentEmber600: "--accent-ember-600",
  accentCyan: "--accent-cyan",
  accentTeal400: "--accent-teal-400",
  accentRose: "--accent-rose",
};

export function applyTheme(): void {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(tokenToCssVar)) {
    root.style.setProperty(cssVar, theme[key as keyof ThemeTokens]);
  }
}
