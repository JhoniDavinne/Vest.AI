import { describe, expect, it } from "vitest";
import {
  FIT_PREVIEW_DISCLAIMER_REAL,
  FIT_PREVIEW_DISCLAIMER_SILHOUETTE,
  resolvePreviewDisclaimer,
} from "./constants";

describe("resolvePreviewDisclaimer", () => {
  it("usa o texto do avatar real quando o GLB humano esta ativo", () => {
    expect(resolvePreviewDisclaimer("human")).toBe(FIT_PREVIEW_DISCLAIMER_REAL);
    expect(resolvePreviewDisclaimer("human")).toContain("Visualização 3D estimada");
    expect(resolvePreviewDisclaimer("human")).not.toContain("Silhueta estilizada");
  });

  it("mantem o texto da silhueta no fallback StylizedSilhouette", () => {
    expect(resolvePreviewDisclaimer("silhouette")).toBe(FIT_PREVIEW_DISCLAIMER_SILHOUETTE);
    expect(resolvePreviewDisclaimer("silhouette")).toContain("Silhueta estilizada");
  });
});
