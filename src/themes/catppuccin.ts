/**
 * Catppuccin theme variants for Angy.
 *
 * Each variant defines CSS custom property values that get applied to :root.
 * The "mocha" variant uses Angy's custom darker backgrounds (#0f1117 base)
 * rather than standard Catppuccin mocha (#1e1e2e).
 */

export interface ThemeTokens {
  // Backgrounds
  bgBase: string;
  bgSurface: string;
  bgWindow: string;
  bgRaised: string;
  bgRaisedHover: string;

  // Borders
  borderSubtle: string;
  borderStandard: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;

  // Accents
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

export type ThemeVariant = "mocha" | "mocha-classic" | "macchiato" | "frappe" | "latte" | "cursor";

export const themes: Record<ThemeVariant, ThemeTokens> = {
  mocha: {
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
  },

  "mocha-classic": {
    // Standard Catppuccin Mocha palette (official colors, no custom darks)
    bgBase: "#11111b",      // Crust
    bgSurface: "#181825",   // Mantle
    bgWindow: "#1e1e2e",    // Base
    bgRaised: "#313244",    // Surface0
    bgRaisedHover: "#3b3e52",
    borderSubtle: "#313244", // Surface0
    borderStandard: "#45475a", // Surface1
    textPrimary: "#cdd6f4",
    textSecondary: "#a6adc8",
    textMuted: "#6c7086",
    textFaint: "#45475a",
    accentMauve: "#cba6f7",
    accentBlue: "#89b4fa",
    accentGreen: "#a6e3a1",
    accentRed: "#f38ba8",
    accentYellow: "#f9e2af",
    accentTeal: "#94e2d5",
    accentPeach: "#fab387",
    accentEmber: "#f59e0b",
    accentEmber400: "#fb923c",
    accentEmber600: "#ea580c",
    accentCyan: "#22d3ee",
    accentTeal400: "#2dd4bf",
    accentRose: "#FF6B8A",
  },

  macchiato: {
    bgBase: "#181825",
    bgSurface: "#1e1e2e",
    bgWindow: "#24273a",
    bgRaised: "#363a4f",
    bgRaisedHover: "#414762",
    borderSubtle: "#2a2d3d",
    borderStandard: "#363a4f",
    textPrimary: "#cad3f5",
    textSecondary: "#a5adcb",
    textMuted: "#6e738d",
    textFaint: "#494d64",
    accentMauve: "#c6a0f6",
    accentBlue: "#8aadf4",
    accentGreen: "#a6da95",
    accentRed: "#ed8796",
    accentYellow: "#eed49f",
    accentTeal: "#8bd5ca",
    accentPeach: "#f5a97f",
    accentEmber: "#f5a97f",
    accentEmber400: "#f5a97f",
    accentEmber600: "#d78352",
    accentCyan: "#91d7e3",
    accentTeal400: "#8bd5ca",
    accentRose: "#ee99a0",
  },

  frappe: {
    bgBase: "#232634",
    bgSurface: "#292c3c",
    bgWindow: "#303446",
    bgRaised: "#414559",
    bgRaisedHover: "#4d516b",
    borderSubtle: "#353948",
    borderStandard: "#414559",
    textPrimary: "#c6d0f5",
    textSecondary: "#a5adce",
    textMuted: "#737994",
    textFaint: "#51576d",
    accentMauve: "#ca9ee6",
    accentBlue: "#8caaee",
    accentGreen: "#a6d189",
    accentRed: "#e78284",
    accentYellow: "#e5c890",
    accentTeal: "#81c8be",
    accentPeach: "#ef9f76",
    accentEmber: "#ef9f76",
    accentEmber400: "#ef9f76",
    accentEmber600: "#cb7e55",
    accentCyan: "#85c1dc",
    accentTeal400: "#81c8be",
    accentRose: "#ea999c",
  },

  latte: {
    bgBase: "#eff1f5",
    bgSurface: "#e6e9ef",
    bgWindow: "#dce0e8",
    bgRaised: "#ccd0da",
    bgRaisedHover: "#bcc0cc",
    borderSubtle: "#dce0e8",
    borderStandard: "#ccd0da",
    textPrimary: "#4c4f69",
    textSecondary: "#5c5f77",
    textMuted: "#7c7f93",
    textFaint: "#9ca0b0",
    accentMauve: "#8839ef",
    accentBlue: "#1e66f5",
    accentGreen: "#40a02b",
    accentRed: "#d20f39",
    accentYellow: "#df8e1d",
    accentTeal: "#179299",
    accentPeach: "#fe640b",
    accentEmber: "#fe640b",
    accentEmber400: "#fe640b",
    accentEmber600: "#d44a00",
    accentCyan: "#04a5e5",
    accentTeal400: "#179299",
    accentRose: "#d20f39",
  },

  cursor: {
    bgBase: "#0a0a0a",
    bgSurface: "#111111",
    bgWindow: "#171717",
    bgRaised: "#222222",
    bgRaisedHover: "#2c2c2c",
    borderSubtle: "#1a1a1a",
    borderStandard: "#262626",
    textPrimary: "#e4e4e7",
    textSecondary: "#a1a1aa",
    textMuted: "#71717a",
    textFaint: "#3f3f46",
    accentMauve: "#a78bfa",
    accentBlue: "#60a5fa",
    accentGreen: "#4ade80",
    accentRed: "#f87171",
    accentYellow: "#fbbf24",
    accentTeal: "#2dd4bf",
    accentPeach: "#fb923c",
    accentEmber: "#fb923c",
    accentEmber400: "#fb923c",
    accentEmber600: "#ea580c",
    accentCyan: "#22d3ee",
    accentTeal400: "#2dd4bf",
    accentRose: "#f87171",
  },
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

export function applyTheme(variant: ThemeVariant): void {
  const tokens = themes[variant];
  const root = document.documentElement;

  for (const [key, cssVar] of Object.entries(tokenToCssVar)) {
    root.style.setProperty(cssVar, tokens[key as keyof ThemeTokens]);
  }
}
