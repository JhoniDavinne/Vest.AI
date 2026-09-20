import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearManifestCache,
  isRenderableAsset,
  joinModelUrl,
  loadModelsManifest,
  normalizeManifest,
  resolveAvatarAsset,
  resolveGarmentAsset,
} from "./manifest";

const V2 = {
  version: 2,
  avatar: {
    url: "body/avatar.glb",
    placeholder: false,
    morphTargets: { chest: { plus: "ChestWide", minus: "ChestNarrow" } },
  },
  garments: {
    tshirt: { url: "garments/tshirt.glb", placeholder: false },
    pants: { url: "garments/pants.glb", placeholder: true },
  },
  regions: ["Chest"],
  note: "ok",
};

const V1 = {
  body: "body/base-male.glb",
  garments: { tshirt: "garments/tshirt.glb" },
  regions: ["Chest"],
  note: "Placeholders low-poly.",
};

describe("normalizeManifest", () => {
  it("aceita o formato v2 preservando flags e morph targets", () => {
    const manifest = normalizeManifest(V2);
    expect(manifest).not.toBeNull();
    expect(manifest?.avatar?.url).toBe("body/avatar.glb");
    expect(manifest?.avatar?.placeholder).toBe(false);
    expect(manifest?.avatar?.morphTargets?.chest).toEqual({ plus: "ChestWide", minus: "ChestNarrow" });
    expect(manifest?.garments.tshirt?.placeholder).toBe(false);
    expect(manifest?.garments.pants?.placeholder).toBe(true);
    expect(manifest?.garments.dress).toBeUndefined();
  });

  it("converte o formato v1 tratando assets legados como placeholder", () => {
    const manifest = normalizeManifest(V1);
    expect(manifest?.version).toBe(2);
    expect(manifest?.avatar?.url).toBe("body/base-male.glb");
    expect(manifest?.avatar?.placeholder).toBe(true);
    expect(manifest?.garments.tshirt).toEqual({ url: "garments/tshirt.glb", placeholder: true });
  });

  it("rejeita conteudo invalido", () => {
    expect(normalizeManifest(null)).toBeNull();
    expect(normalizeManifest("x")).toBeNull();
    expect(normalizeManifest({ regions: [] })).toBeNull();
    expect(normalizeManifest({ version: 2, avatar: { url: "" }, garments: {} })).toBeNull();
  });

  it("aceita avatars.default e baseMeasurements sem quebrar o schema v2", () => {
    const manifest = normalizeManifest({
      version: 2,
      avatars: {
        default: {
          url: "avatar/avatar_base.glb",
          placeholder: false,
          type: "human",
          baseMeasurements: { height: 175, chest: 96, waist: 82, hips: 98, shoulders: 44, weight: 72 },
        },
      },
      garments: { tshirt: { url: "garments/tshirt.glb", placeholder: true } },
    });
    expect(manifest?.avatar?.url).toBe("avatar/avatar_base.glb");
    expect(manifest?.avatar?.placeholder).toBe(false);
    expect(manifest?.avatar?.type).toBe("human");
    expect(manifest?.avatar?.baseMeasurements).toEqual({
      height: 175,
      chest: 96,
      waist: 82,
      hips: 98,
      shoulders: 44,
      weight: 72,
    });
    expect(isRenderableAsset(resolveAvatarAsset(manifest, "/models"))).toBe(true);
  });

  it("cai para silhueta quando o avatar esta ausente ou e placeholder", () => {
    expect(isRenderableAsset(resolveAvatarAsset(null, "/models"))).toBe(false);
    const placeholder = normalizeManifest({
      version: 2,
      avatar: { url: "body/base-male.glb", placeholder: true },
      garments: {},
    });
    expect(isRenderableAsset(resolveAvatarAsset(placeholder, "/models"))).toBe(false);
    expect(isRenderableAsset(resolveAvatarAsset(placeholder, "/models"), true)).toBe(true);
  });

  it("aceita garment real com type, baseSize e baseMeasurements", () => {
    const manifest = normalizeManifest({
      version: 2,
      avatar: { url: "avatar/avatar_base.glb", placeholder: false },
      garments: {
        tshirt: {
          url: "garments/tshirt_basic.glb",
          placeholder: false,
          type: "tshirt",
          baseSize: "M",
          baseMeasurements: { chest: 111, waist: 111, length: 71 },
        },
        pants: { url: "garments/pants.glb", placeholder: true },
      },
    });
    expect(manifest?.garments.tshirt?.url).toBe("garments/tshirt_basic.glb");
    expect(manifest?.garments.tshirt?.placeholder).toBe(false);
    expect(manifest?.garments.tshirt?.type).toBe("tshirt");
    expect(manifest?.garments.tshirt?.baseSize).toBe("M");
    expect(manifest?.garments.tshirt?.baseMeasurements?.chest).toBe(111);
    expect(isRenderableAsset(resolveGarmentAsset(manifest, "tshirt", "/models"))).toBe(true);
    expect(isRenderableAsset(resolveGarmentAsset(manifest, "pants", "/models"))).toBe(false);
    expect(resolveGarmentAsset(manifest, "dress", "/models")).toBeNull();
  });
});

describe("resolucao de assets", () => {
  const manifest = normalizeManifest(V2);

  it("monta URLs a partir do modelsBaseUrl", () => {
    expect(joinModelUrl("/models", "body/avatar.glb")).toBe("/models/body/avatar.glb");
    expect(joinModelUrl("/models/", "./body/avatar.glb")).toBe("/models/body/avatar.glb");
    expect(joinModelUrl("/models", "/cdn/avatar.glb")).toBe("/cdn/avatar.glb");
    expect(joinModelUrl("/models", "https://cdn.exemplo/a.glb")).toBe("https://cdn.exemplo/a.glb");
  });

  it("resolve avatar e peca por categoria", () => {
    expect(resolveAvatarAsset(manifest, "/models")).toEqual({ url: "/models/body/avatar.glb", placeholder: false });
    expect(resolveGarmentAsset(manifest, "tshirt", "/models")).toEqual({
      url: "/models/garments/tshirt.glb",
      placeholder: false,
    });
  });

  it("retorna null quando o GLB da categoria nao existe (fallback para primitivas)", () => {
    expect(resolveGarmentAsset(manifest, "dress", "/models")).toBeNull();
    expect(resolveAvatarAsset(null, "/models")).toBeNull();
    expect(isRenderableAsset(null)).toBe(false);
  });

  it("nunca considera placeholder como renderizavel sem opt-in", () => {
    const pants = resolveGarmentAsset(manifest, "pants", "/models");
    expect(isRenderableAsset(pants)).toBe(false);
    expect(isRenderableAsset(pants, true)).toBe(true);
    expect(isRenderableAsset(resolveGarmentAsset(manifest, "tshirt", "/models"))).toBe(true);
  });
});

describe("loadModelsManifest", () => {
  beforeEach(() => clearManifestCache());

  function fakeFetch(status: number, body: unknown): typeof fetch {
    return vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body instanceof Error) throw body;
        return body;
      },
    })) as unknown as typeof fetch;
  }

  it("carrega e normaliza o manifest", async () => {
    const manifest = await loadModelsManifest("/models", { fetchImpl: fakeFetch(200, V2) });
    expect(manifest?.avatar?.url).toBe("body/avatar.glb");
  });

  it("resolve null em 404, JSON invalido ou erro de rede (nunca rejeita)", async () => {
    expect(await loadModelsManifest("/a", { fetchImpl: fakeFetch(404, null) })).toBeNull();
    expect(await loadModelsManifest("/b", { fetchImpl: fakeFetch(200, new SyntaxError("bad json")) })).toBeNull();
    const failing = vi.fn(async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    expect(await loadModelsManifest("/c", { fetchImpl: failing })).toBeNull();
  });

  it("cacheia por baseUrl para nao repetir a requisicao", async () => {
    const fetchImpl = fakeFetch(200, V2);
    await loadModelsManifest("/models", { fetchImpl });
    await loadModelsManifest("/models/", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loadModelsManifest("/models", { fetchImpl, force: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
