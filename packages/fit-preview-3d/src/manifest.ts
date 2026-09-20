/**
 * Manifest de assets 3D (`apps/web/public/models/manifest.json`).
 *
 * E a unica fonte para localizar o avatar e as pecas por categoria.
 * Aceita dois formatos:
 *  - v1 (legado): `{ body: string, garments: Record<category, string> }`
 *  - v2:          `{ version: 2, avatar: { url, placeholder, morphTargets }, garments: Record<category, { url, placeholder }> }`
 *
 * Assets marcados como `placeholder: true` existem apenas para validar o
 * pipeline de carregamento e NUNCA sao exibidos como avatar/peca final:
 * a cena cai para a representacao estilizada existente.
 */
import type { Category } from "@veste-ai/contracts";
import type { MorphTargetMapping } from "./avatarMorph";
import type { AvatarBaseMeasurements } from "./avatarDeformation";

export interface ManifestAsset {
  /** URL relativa ao `modelsBaseUrl` (ex.: `body/base.glb`). */
  url: string;
  /** `true` = geometria provisoria (cubos); nao representa o corpo/peca. */
  placeholder: boolean;
}

export interface GarmentBaseMeasurements {
  chest?: number;
  waist?: number;
  length?: number;
  shoulder?: number;
  hip?: number;
}

export interface GarmentManifestAsset extends ManifestAsset {
  /** Categoria visual (`tshirt`, etc.) ou `placeholder`. */
  type?: Category | "placeholder";
  /** Tamanho de referencia do GLB (ex.: `M`). */
  baseSize?: string;
  /** Medidas da peca-base do GLB (cm). Transformacao visual e relativa a este perfil. */
  baseMeasurements?: GarmentBaseMeasurements;
}

export interface AvatarManifestAsset extends ManifestAsset {
  /** Nomes dos morph targets do GLB por eixo corporal (opcional). */
  morphTargets?: Partial<MorphTargetMapping>;
  /** `human` = avatar antropomorfo; omitido nos placeholders. */
  type?: "human" | "placeholder";
  /** Medidas do corpo-base do GLB (cm). Deformacao visual e relativa a este perfil. */
  baseMeasurements?: AvatarBaseMeasurements;
}

export interface ModelsManifest {
  version: 2;
  avatar: AvatarManifestAsset | null;
  garments: Partial<Record<Category, GarmentManifestAsset>>;
  regions: string[];
  note: string;
}

export interface ResolvedAsset {
  url: string;
  placeholder: boolean;
}

const CATEGORIES: readonly Category[] = [
  "tshirt",
  "shirt",
  "polo",
  "hoodie",
  "jacket",
  "dress",
  "pants",
  "shorts",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asAsset(value: unknown, defaultPlaceholder: boolean): ManifestAsset | null {
  if (typeof value === "string" && value.trim()) {
    return { url: value.trim(), placeholder: defaultPlaceholder };
  }
  if (isRecord(value) && typeof value.url === "string" && value.url.trim()) {
    return {
      url: value.url.trim(),
      placeholder: typeof value.placeholder === "boolean" ? value.placeholder : defaultPlaceholder,
    };
  }
  return null;
}

function asBaseMeasurements(value: unknown): AvatarBaseMeasurements | undefined {
  if (!isRecord(value)) return undefined;
  const num = (key: string, alt?: string): number | undefined => {
    const raw = value[key] ?? (alt ? value[alt] : undefined);
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : undefined;
  };
  const height = num("height");
  const chest = num("chest");
  const waist = num("waist");
  const hips = num("hips", "hip");
  const shoulders = num("shoulders", "shoulder");
  if (!height || !chest || !waist || !hips || !shoulders) return undefined;
  const weight = num("weight");
  return { height, chest, waist, hips, shoulders, ...(weight ? { weight } : {}) };
}

function asGarmentMeasurements(value: unknown): GarmentBaseMeasurements | undefined {
  if (!isRecord(value)) return undefined;
  const num = (key: string, alt?: string): number | undefined => {
    const raw = value[key] ?? (alt ? value[alt] : undefined);
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : undefined;
  };
  const out: GarmentBaseMeasurements = {
    chest: num("chest"),
    waist: num("waist"),
    length: num("length"),
    shoulder: num("shoulder", "shoulders"),
    hip: num("hip", "hips"),
  };
  return Object.values(out).some((v) => v != null) ? out : undefined;
}

function asGarmentAsset(value: unknown, defaultPlaceholder: boolean): GarmentManifestAsset | null {
  const base = asAsset(value, defaultPlaceholder);
  if (!base) return null;
  if (!isRecord(value)) return base;
  const type = value.type;
  const knownType = typeof type === "string" && (CATEGORIES as readonly string[]).includes(type) ? (type as Category) : undefined;
  return {
    ...base,
    type: type === "placeholder" ? "placeholder" : knownType,
    baseSize: typeof value.baseSize === "string" && value.baseSize.trim() ? value.baseSize.trim() : undefined,
    baseMeasurements: asGarmentMeasurements(value.baseMeasurements),
  };
}

function asMorphMapping(value: unknown): Partial<MorphTargetMapping> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Partial<MorphTargetMapping> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const entry: { plus?: string; minus?: string; single?: string } = {};
    if (typeof raw.plus === "string") entry.plus = raw.plus;
    if (typeof raw.minus === "string") entry.minus = raw.minus;
    if (typeof raw.single === "string") entry.single = raw.single;
    if (entry.plus || entry.minus || entry.single) {
      (out as Record<string, typeof entry>)[key] = entry;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Normaliza qualquer formato aceito para `ModelsManifest` (v2).
 * Retorna `null` quando o conteudo nao e um manifest reconhecivel.
 *
 * No formato v1 nao existe a flag `placeholder`; por seguranca os assets
 * legados sao tratados como placeholder (a nota do manifest original os
 * descreve como "Placeholders low-poly").
 */
export function normalizeManifest(raw: unknown): ModelsManifest | null {
  if (!isRecord(raw)) return null;

  const isV2 = raw.version === 2 || isRecord(raw.avatar) || isRecord(raw.avatars);
  const legacyDefault = !isV2;

  let avatar: AvatarManifestAsset | null = null;
  const nestedDefault = isRecord(raw.avatars) ? raw.avatars.default : undefined;
  const avatarSource = isV2 ? (raw.avatar ?? nestedDefault) : raw.body;
  const avatarAsset = asAsset(avatarSource, legacyDefault);
  if (avatarAsset) {
    const sourceRecord = isRecord(avatarSource) ? avatarSource : null;
    avatar = {
      ...avatarAsset,
      morphTargets: sourceRecord ? asMorphMapping(sourceRecord.morphTargets) : undefined,
      type: sourceRecord?.type === "human" || sourceRecord?.type === "placeholder" ? sourceRecord.type : undefined,
      baseMeasurements: sourceRecord ? asBaseMeasurements(sourceRecord.baseMeasurements) : undefined,
    };
  }

  const garments: Partial<Record<Category, GarmentManifestAsset>> = {};
  if (isRecord(raw.garments)) {
    for (const category of CATEGORIES) {
      const asset = asGarmentAsset(raw.garments[category], legacyDefault);
      if (asset) garments[category] = asset;
    }
  }

  if (!avatar && Object.keys(garments).length === 0) return null;

  return {
    version: 2,
    avatar,
    garments,
    regions: Array.isArray(raw.regions) ? raw.regions.filter((r): r is string => typeof r === "string") : [],
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

export function joinModelUrl(baseUrl: string, relative: string): string {
  if (/^(https?:)?\/\//.test(relative) || relative.startsWith("/")) return relative;
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/${relative.replace(/^\.?\//, "")}`;
}

export function resolveAvatarAsset(manifest: ModelsManifest | null, baseUrl: string): ResolvedAsset | null {
  if (!manifest?.avatar) return null;
  return { url: joinModelUrl(baseUrl, manifest.avatar.url), placeholder: manifest.avatar.placeholder };
}

export function resolveGarmentAsset(
  manifest: ModelsManifest | null,
  category: Category,
  baseUrl: string,
): ResolvedAsset | null {
  const asset = manifest?.garments[category];
  if (!asset) return null;
  return { url: joinModelUrl(baseUrl, asset.url), placeholder: asset.placeholder };
}

/** Um asset e "renderizavel" quando existe e nao e placeholder (salvo opt-in explicito). */
export function isRenderableAsset(asset: ResolvedAsset | null, renderPlaceholders = false): asset is ResolvedAsset {
  if (!asset) return false;
  return renderPlaceholders || !asset.placeholder;
}

const manifestCache = new Map<string, Promise<ModelsManifest | null>>();

export interface LoadManifestOptions {
  fetchImpl?: typeof fetch;
  /** Ignora o cache em memoria (testes). */
  force?: boolean;
}

/**
 * Carrega e normaliza `${baseUrl}/manifest.json`. Nunca rejeita: qualquer
 * falha (rede, 404, JSON invalido) resolve para `null` e a cena usa fallback.
 * O resultado fica cacheado por `baseUrl` para evitar requisicoes repetidas.
 */
export function loadModelsManifest(baseUrl: string, options: LoadManifestOptions = {}): Promise<ModelsManifest | null> {
  const key = baseUrl.replace(/\/$/, "");
  const cached = manifestCache.get(key);
  if (cached && !options.force) return cached;

  const fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? fetch.bind(globalThis) : null);
  if (!fetchImpl) return Promise.resolve(null);

  const promise = fetchImpl(`${key}/manifest.json`, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) return null;
      return normalizeManifest(await response.json());
    })
    .catch(() => null);

  manifestCache.set(key, promise);
  return promise;
}

export function clearManifestCache(): void {
  manifestCache.clear();
}
