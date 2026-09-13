import { Camera, Layers, Ruler, Scissors, SlidersHorizontal } from "lucide-react";
import type { ComponentScores } from "@veste-ai/contracts";

export const ENGINE_COMPONENTS: {
  key: keyof ComponentScores;
  label: string;
  weight: number;
  color: string;
  icon: typeof Ruler;
  description: string;
}[] = [
  {
    key: "measurements",
    label: "Medidas",
    weight: 0.4,
    color: "#141416",
    icon: Ruler,
    description: "Compara a folga real (peça − corpo) com a folga que a modelagem prevê em cada região.",
  },
  {
    key: "modeling",
    label: "Modelagem",
    weight: 0.2,
    color: "#C4623A",
    icon: Scissors,
    description: "Quanto do desvio cabe na faixa que a modelagem (slim, regular, relaxed, oversized) absorve.",
  },
  {
    key: "elasticity",
    label: "Tecido",
    weight: 0.15,
    color: "#5F7F6A",
    icon: Layers,
    description: "Capacidade do tecido de compensar regiões mais ajustadas, pela elasticidade da composição.",
  },
  {
    key: "visual_proportion",
    label: "Proporções",
    weight: 0.15,
    color: "#8A96A3",
    icon: Camera,
    description: "Ênfase regional derivada das proporções estimadas pela foto — opcional e experimental.",
  },
  {
    key: "preference",
    label: "Preferência",
    weight: 0.1,
    color: "#C99A3B",
    icon: SlidersHorizontal,
    description: "Proximidade entre a folga real e a folga que você prefere (justo, regular ou solto).",
  },
];
