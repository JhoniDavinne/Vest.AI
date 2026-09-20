import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TSHIRT_GLB = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../apps/web/public/models/garments/tshirt_basic.glb",
);

interface GlbAccessor {
  min?: number[];
  max?: number[];
  count: number;
  type: string;
}

function parseGlbJson(path: string): { accessors: GlbAccessor[]; meshes: { name?: string }[] } {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
}

describe("tshirt_basic.glb", () => {
  const gltf = parseGlbJson(TSHIRT_GLB);
  const position = gltf.accessors.find((item) => item.type === "VEC3" && item.min && item.max);

  it("existe e nao e uma caixa de 8 vertices", () => {
    expect(position).toBeDefined();
    expect(position?.count ?? 0).toBeGreaterThan(24);
    expect(gltf.meshes[0]?.name).toBe("tshirt");
  });

  it("tem silhueta em T (mangas mais largas que a gola) e nao e um cubo", () => {
    const min = position?.min ?? [0, 0, 0];
    const max = position?.max ?? [0, 0, 0];
    const width = max[0] - min[0];
    const height = max[1] - min[1];
    const depth = max[2] - min[2];
    expect(width).toBeGreaterThan(0.58);
    expect(width).toBeLessThan(0.95);
    expect(height).toBeGreaterThan(0.5);
    expect(height).toBeLessThan(0.8);
    expect(depth).toBeGreaterThan(0.2);
    expect(depth).toBeLessThan(0.4);
    expect(width / depth).toBeGreaterThan(1.6);
    expect(min[1]).toBeGreaterThan(0.85);
    expect(max[1]).toBeLessThan(1.75);
  });

  it("geometria nao e degenerada", () => {
    const min = position?.min ?? [0, 0, 0];
    const max = position?.max ?? [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      expect(max[axis] - min[axis]).toBeGreaterThan(0.05);
      expect(Number.isFinite(min[axis])).toBe(true);
      expect(Number.isFinite(max[axis])).toBe(true);
    }
  });
});
