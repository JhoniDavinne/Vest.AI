import { describe, expect, it } from "vitest";
import { describeRegionFit, fitDirection, legendLine, regionIntensity, STATUS_DEFAULT_INTENSITY } from "./regionLegend";

describe("describeRegionFit", () => {
  it("mapeia os RegionStatus reais do motor para rotulos legiveis", () => {
    expect(describeRegionFit({ status: "good", deviation: 0.3 })).toBe("Compatível");
    expect(describeRegionFit({ status: "ease_recommended", deviation: -6 })).toBe("Mais ajustado");
    expect(describeRegionFit({ status: "attention", deviation: -2 })).toBe("Levemente mais ajustado");
    expect(describeRegionFit({ status: "attention", deviation: 5 })).toBe("Levemente mais folgado");
    expect(describeRegionFit({ status: "attention", deviation: null })).toBe("Atenção");
    expect(describeRegionFit({ status: "not_evaluated", deviation: null })).toBe("Não avaliado");
  });

  it("gera linha de legenda com o nome da regiao", () => {
    expect(legendLine({ region: "chest", status: "good", deviation: 0 })).toBe("Peito — Compatível");
    expect(legendLine({ region: "hip", status: "attention", deviation: 4 })).toBe("Quadril — Levemente mais folgado");
    expect(legendLine({ region: "sleeve", status: "not_evaluated", deviation: null })).toBe("Manga — Não avaliado");
  });
});

describe("fitDirection", () => {
  it("usa apenas o sinal de deviation", () => {
    expect(fitDirection({ deviation: -1 })).toBe("tight");
    expect(fitDirection({ deviation: 2 })).toBe("loose");
    expect(fitDirection({ deviation: 0 })).toBe("neutral");
    expect(fitDirection({ deviation: null })).toBe("unknown");
  });
});

describe("regionIntensity", () => {
  it("deriva de 1 - score quando o motor devolve score", () => {
    expect(regionIntensity({ status: "good", score: 0.98 })).toBeCloseTo(0.02, 5);
    expect(regionIntensity({ status: "attention", score: 0.3 })).toBeCloseTo(0.7, 5);
    expect(regionIntensity({ status: "ease_recommended", score: 0 })).toBe(1);
  });

  it("usa padrao por status sem score e ignora not_evaluated", () => {
    expect(regionIntensity({ status: "attention", score: null })).toBe(STATUS_DEFAULT_INTENSITY.attention);
    expect(regionIntensity({ status: "not_evaluated", score: 0.1 })).toBe(STATUS_DEFAULT_INTENSITY.not_evaluated);
  });
});
