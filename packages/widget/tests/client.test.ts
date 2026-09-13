import { describe, expect, it, vi } from "vitest";
import { VesteClient } from "../src/client";

const sample = { recommended_size: "M", fit_score: 8.8, comparison: [] };

describe("VesteClient", () => {
  it("monta a requisicao com canal widget e sem foto", () => {
    const client = new VesteClient({ apiBaseUrl: "http://api.test/" });
    const request = client.buildRequest({
      sku: "CAMISETA-001-M",
      customer: { chest: 102, waist: 88, hip: 100 },
      fitPreference: "loose",
    });
    expect(request.channel).toBe("widget");
    expect(request.use_photo).toBe(false);
    expect(request.fit_preference).toBe("loose");
    expect(request.sku).toBe("CAMISETA-001-M");
  });

  it("chama POST /api/v1/recommendations com X-API-Key", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://api.test/api/v1/recommendations");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)["X-API-Key"]).toBe("chave");
      return new Response(JSON.stringify(sample), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const client = new VesteClient({ apiBaseUrl: "http://api.test", apiKey: "chave", fetchImpl });
    const result = await client.recommend({ sku: "X", customer: { chest: 1 }, fitPreference: "regular" });
    expect(result.recommended_size).toBe("M");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("propaga o detalhe de erro da API", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ detail: "SKU 'X' nao encontrado." }), { status: 404 })) as unknown as typeof fetch;
    const client = new VesteClient({ apiBaseUrl: "http://api.test", fetchImpl });
    await expect(client.recommend({ sku: "X", customer: {}, fitPreference: "regular" })).rejects.toThrow(
      "SKU 'X' nao encontrado.",
    );
  });
});
