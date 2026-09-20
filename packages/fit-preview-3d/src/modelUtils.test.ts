import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import {
  hasMorphTargets,
  measureObject,
  metricCorrectionFactor,
  metricPlacement,
  placeMetricObject,
  REFERENCE_HEIGHT_M,
  SCENE_FLOOR_Y,
  SCENE_UNITS_PER_METER,
} from "./modelUtils";
import { SILHOUETTE_CENTER_Y, SILHOUETTE_HEIGHT } from "./silhouette";

describe("escala metrica", () => {
  it("corpo de referencia (1.75 m) ocupa a altura da silhueta existente", () => {
    expect(REFERENCE_HEIGHT_M).toBeCloseTo(1.75, 5);
    expect(REFERENCE_HEIGHT_M * SCENE_UNITS_PER_METER).toBeCloseTo(SILHOUETTE_HEIGHT, 5);
    expect(SCENE_FLOOR_Y).toBeCloseTo(SILHOUETTE_CENTER_Y - SILHOUETTE_HEIGHT / 2, 5);
  });

  it("placeMetricObject aplica escala e posiciona os pes no chao da cena", () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(0.4, 1.75, 0.3), new MeshStandardMaterial());
    body.position.y = 1.75 / 2; // pes em y=0, como no contrato dos assets
    root.add(body);
    placeMetricObject(root);
    const { scale, positionY } = metricPlacement();
    expect(root.scale.x).toBeCloseTo(scale, 5);
    expect(root.position.y).toBeCloseTo(positionY, 5);
    const bounds = measureObject(root);
    expect(bounds.minY).toBeCloseTo(SCENE_FLOOR_Y, 4);
    expect(bounds.height).toBeCloseTo(SILHOUETTE_HEIGHT, 4);
  });
});

describe("metricCorrectionFactor", () => {
  it("nao altera assets em metros plausiveis", () => {
    expect(metricCorrectionFactor(1.6)).toBe(1);
    expect(metricCorrectionFactor(2.1)).toBe(1);
  });

  it("corrige assets exportados em centimetros ou milimetros", () => {
    expect(metricCorrectionFactor(175)).toBeCloseTo(0.01, 5);
    expect(metricCorrectionFactor(1750)).toBeCloseTo(0.001, 5);
    expect(metricCorrectionFactor(0.0175)).toBeCloseTo(100, 5);
  });

  it("ignora valores invalidos", () => {
    expect(metricCorrectionFactor(0)).toBe(1);
    expect(metricCorrectionFactor(Number.NaN)).toBe(1);
  });
});

describe("hasMorphTargets", () => {
  it("detecta meshes com dicionario de morph targets", () => {
    const rigid = new Group();
    rigid.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    expect(hasMorphTargets(rigid)).toBe(false);

    const morphable = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    morphable.morphTargetDictionary = { chest_plus: 0 };
    morphable.morphTargetInfluences = [0];
    const group = new Group();
    group.add(morphable);
    expect(hasMorphTargets(group)).toBe(true);
  });
});
