import { describe, expect, it } from "vitest";
import { Group, Mesh, MeshStandardMaterial, BoxGeometry } from "three";
import {
  classifyBone,
  computeAvatarDeformationProfile,
  dampedBoneScale,
  DEFAULT_BASE_MEASUREMENTS,
  DEFORMATION_LIMITS,
  profilesDifferVisually,
  selectAdapterKind,
} from "./avatarDeformation";
import { applyAvatarDeformation, applySkeletonAdapter, detectAdapterKind, inspectAvatarCapabilities } from "./avatarAdapters";
import { REFERENCE_BODY } from "./constants";

describe("computeAvatarDeformationProfile", () => {
  it("corpo-base produz escalas 1", () => {
    const profile = computeAvatarDeformationProfile({
      height: REFERENCE_BODY.height,
      chest: REFERENCE_BODY.chest,
      waist: REFERENCE_BODY.waist,
      hip: REFERENCE_BODY.hip,
      shoulder: REFERENCE_BODY.shoulder,
      weight: REFERENCE_BODY.weight,
    });
    expect(profile.heightScale).toBeCloseTo(1, 5);
    expect(profile.chestScale).toBeCloseTo(1, 5);
    expect(profile.waistScale).toBeCloseTo(1, 5);
    expect(profile.hipScale).toBeCloseTo(1, 5);
    expect(profile.shoulderScale).toBeCloseTo(1, 5);
    expect(profile.bodyMassScale).toBeCloseTo(1, 5);
  });

  it("respeita limites antropometricos mesmo com medidas extremas", () => {
    const huge = computeAvatarDeformationProfile({ height: 220, chest: 140, waist: 140, hip: 140, shoulder: 70, weight: 140 });
    const tiny = computeAvatarDeformationProfile({ height: 140, chest: 70, waist: 55, hip: 70, shoulder: 32, weight: 42 });
    expect(huge.heightScale).toBeLessThanOrEqual(DEFORMATION_LIMITS.height.max);
    expect(huge.chestScale).toBeLessThanOrEqual(DEFORMATION_LIMITS.xz.max);
    expect(huge.bodyMassScale).toBeLessThanOrEqual(DEFORMATION_LIMITS.mass.max);
    expect(tiny.heightScale).toBeGreaterThanOrEqual(DEFORMATION_LIMITS.height.min);
    expect(tiny.waistScale).toBeGreaterThanOrEqual(DEFORMATION_LIMITS.xz.min);
  });

  it("perfil A e B (especificacao) diferem de forma visivel e plausivel", () => {
    const a = computeAvatarDeformationProfile({ height: 165, chest: 86, waist: 70, hips: 92, shoulders: 40 });
    const b = computeAvatarDeformationProfile({ height: 185, chest: 112, waist: 100, hips: 110, shoulders: 50 });
    expect(profilesDifferVisually(a, b)).toBe(true);
    expect(b.heightScale).toBeGreaterThan(a.heightScale);
    expect(b.chestScale).toBeGreaterThan(a.chestScale);
    expect(b.shoulderScale).toBeGreaterThan(a.shoulderScale);
  });

  it("aceita baseMeasurements do manifest", () => {
    const base = { ...DEFAULT_BASE_MEASUREMENTS, chest: 100 };
    const profile = computeAvatarDeformationProfile({ chest: 100 }, base);
    expect(profile.chestScale).toBeCloseTo(1, 5);
  });

  it("medidas ausentes nao distorcem o eixo", () => {
    const profile = computeAvatarDeformationProfile({});
    expect(profile.heightScale).toBe(1);
    expect(profile.bodyMassScale).toBe(1);
  });
});

describe("classifyBone / selectAdapterKind", () => {
  it("classifica Rigify (spine/shoulder) e protege cabeca/maos/pes", () => {
    expect(classifyBone("shoulder.L")).toBe("shoulder");
    expect(classifyBone("spine.003")).toBe("chest");
    expect(classifyBone("spine.001")).toBe("waist");
    expect(classifyBone("spine")).toBe("hip");
    expect(classifyBone("spine.005")).toBe("protected");
    expect(classifyBone("hand.L")).toBe("protected");
    expect(classifyBone("foot.R")).toBe("protected");
    expect(classifyBone("f_index.01.L")).toBe("protected");
  });

  it("aceita nomes sanitizados pelo GLTFLoader (sem ponto)", () => {
    expect(classifyBone("shoulderL")).toBe("shoulder");
    expect(classifyBone("spine003")).toBe("chest");
    expect(classifyBone("spine002")).toBe("chest");
    expect(classifyBone("spine001")).toBe("waist");
    expect(classifyBone("spine004")).toBe("protected");
    expect(classifyBone("spine005")).toBe("protected");
    expect(classifyBone("pelvisL")).toBe("hip");
    expect(classifyBone("handL")).toBe("protected");
  });

  it("escolhe morph > skeleton > regional > global", () => {
    expect(selectAdapterKind({ hasMorphs: true, torsoBoneCount: 6, namedRegionMeshes: 4 })).toBe("morph");
    expect(selectAdapterKind({ hasMorphs: false, torsoBoneCount: 6, namedRegionMeshes: 0 })).toBe("skeleton");
    expect(selectAdapterKind({ hasMorphs: false, torsoBoneCount: 0, namedRegionMeshes: 4 })).toBe("regional");
    expect(selectAdapterKind({ hasMorphs: false, torsoBoneCount: 0, namedRegionMeshes: 0 })).toBe("global");
  });
});

describe("SkeletonAdapter", () => {
  it("aplica escala XZ nos ombros e nao nas maos", () => {
    const root = new Group();
    const shoulder = new Group();
    shoulder.name = "shoulder.L";
    const hand = new Group();
    hand.name = "hand.L";
    root.add(shoulder);
    root.add(hand);
    const rest = new Map();
    const profile = computeAvatarDeformationProfile({ shoulder: 52, height: 175, chest: 96, waist: 82, hip: 98 });
    applySkeletonAdapter(root, profile, rest);
    expect(shoulder.scale.x).toBeGreaterThan(1);
    expect(hand.scale.x).toBe(1);
    expect(dampedBoneScale("protected", profile)).toBeNull();
  });

  it("detecta skeleton no grafo Rigify minimo", () => {
    const root = new Group();
    for (const name of ["spine", "spine.001", "spine.003", "shoulder.L", "shoulder.R"]) {
      const n = new Group();
      n.name = name;
      root.add(n);
    }
    expect(detectAdapterKind(root)).toBe("skeleton");
    expect(inspectAvatarCapabilities(root).torsoBoneCount).toBeGreaterThanOrEqual(3);
  });

  it("detecta skeleton com nomes sanitizados do GLB real", () => {
    const root = new Group();
    for (const name of ["spine", "spine001", "spine002", "spine003", "shoulderL", "shoulderR", "pelvisL"]) {
      const n = new Group();
      n.name = name;
      root.add(n);
    }
    expect(detectAdapterKind(root)).toBe("skeleton");
    expect(inspectAvatarCapabilities(root).torsoBoneCount).toBeGreaterThanOrEqual(3);
  });

  it("detecta morph quando o mesh declara alvos", () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    mesh.morphTargetDictionary = { chest_plus: 0 };
    mesh.morphTargetInfluences = [0];
    const root = new Group();
    root.add(mesh);
    expect(detectAdapterKind(root)).toBe("morph");
  });

  it("adapter global nao altera ossos/meshes", () => {
    const root = new Group();
    const child = new Group();
    child.name = "hand.L";
    child.scale.set(1, 1, 1);
    root.add(child);
    const profile = computeAvatarDeformationProfile({ chest: 120 });
    const rest = new Map();
    const result = applyAvatarDeformation(root, "global", profile, { height: 1, chest: 1, waist: 1, hip: 1, shoulder: 1, torsoLeg: 1 }, rest);
    expect(result.kind).toBe("global");
    expect(child.scale.x).toBe(1);
    expect(rest.size).toBe(0);
  });
});
