/**
 * Identidade visual VESTE.AI.
 *
 * Direcao: editorial fashion + SaaS moderno. Base neutra quente (marfim/grafite),
 * um acento "terracota" para acoes e um acento "salvia" para estados positivos.
 */
export const brand = {
  name: "VESTE.AI",
  tagline: "Dados para vestir melhor.",
  colors: {
    ink: "#141416",        // grafite profundo - texto e superficies escuras
    ink2: "#2A2A2E",
    stone: "#6F6B66",      // texto secundario
    mist: "#E9E5DF",       // bordas / divisores
    ivory: "#F7F4EF",      // fundo principal
    paper: "#FFFFFF",
    terracotta: "#C4623A", // acento primario (acoes)
    terracottaDark: "#A24E2C",
    sage: "#5F7F6A",       // positivo / compativel
    amber: "#C99A3B",      // atencao
    clay: "#B4553F",       // folga recomendada
    slate: "#8A96A3",      // neutro / nao avaliado
  },
  fonts: {
    display: '"Literata", Georgia, serif',
    sans: '"Sora", system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
  },
  radii: { sm: "8px", md: "14px", lg: "22px", xl: "32px", pill: "999px" },
  shadows: {
    soft: "0 1px 2px rgba(20,20,22,0.04), 0 8px 24px -12px rgba(20,20,22,0.18)",
    lift: "0 12px 40px -16px rgba(20,20,22,0.28)",
  },
} as const;

export type RegionStatusKey = "good" | "attention" | "ease_recommended" | "not_evaluated";

export const regionStatusColor: Record<RegionStatusKey, string> = {
  good: brand.colors.sage,
  attention: brand.colors.amber,
  ease_recommended: brand.colors.clay,
  not_evaluated: brand.colors.slate,
};

export function scoreColor(score: number): string {
  if (score >= 8.5) return brand.colors.sage;
  if (score >= 7) return "#7C9A6A";
  if (score >= 5) return brand.colors.amber;
  return brand.colors.clay;
}

export function formatScore(score: number): string {
  return score.toFixed(1).replace(".", ",");
}
