import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  return score.toFixed(1).replace(".", ",");
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits).replace(".", ",")}%`;
}

export function formatCm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm`;
}

export function scoreTone(score: number): "high" | "good" | "moderate" | "low" {
  if (score >= 8.5) return "high";
  if (score >= 7) return "good";
  if (score >= 5) return "moderate";
  return "low";
}

export const SCORE_TONE_COLOR: Record<ReturnType<typeof scoreTone>, string> = {
  high: "var(--sage)",
  good: "#7C9A6A",
  moderate: "var(--amber)",
  low: "var(--clay)",
};

export const SCORE_TONE_LABEL: Record<ReturnType<typeof scoreTone>, string> = {
  high: "Alta compatibilidade",
  good: "Boa compatibilidade",
  moderate: "Compatibilidade moderada",
  low: "Baixa compatibilidade",
};
