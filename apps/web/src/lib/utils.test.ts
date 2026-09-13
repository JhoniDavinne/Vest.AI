import { describe, expect, it } from "vitest";
import { formatPercent, formatScore, scoreTone } from "./utils";

describe("formatScore", () => {
  it("usa vírgula decimal", () => {
    expect(formatScore(8.7)).toBe("8,7");
  });
});

describe("formatPercent", () => {
  it("converte fração em percentual", () => {
    expect(formatPercent(0.3)).toBe("30%");
  });
});

describe("scoreTone", () => {
  it("respeita as faixas oficiais do MVP", () => {
    expect(scoreTone(8.7)).toBe("high");
    expect(scoreTone(7.2)).toBe("good");
    expect(scoreTone(6.1)).toBe("moderate");
    expect(scoreTone(4.2)).toBe("low");
  });
});
