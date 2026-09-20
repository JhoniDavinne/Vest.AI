import type { ReactNode } from "react";
import type {
  Category,
  FitPreviewPayload,
  GarmentMeasurement,
  Modeling,
  PhotoAnalysis,
  Product,
  RecommendationResponse,
  RegionDetail,
  User,
} from "@veste-ai/contracts";
import { FIT_PREVIEW_DISCLAIMER } from "./constants";

export interface BodyScaleFactors {
  height: number;
  chest: number;
  waist: number;
  hip: number;
  shoulder: number;
  torsoLeg: number;
}

export type FitPreviewSize = "full" | "medium" | "compact";

export interface FitPreview3DProps {
  payload: FitPreviewPayload;
  size?: FitPreviewSize;
  modelsBaseUrl?: string;
  className?: string;
  fallback?: ReactNode;
  showDisclaimer?: boolean;
}

export function buildPreviewPayloadFromRecommendation(
  response: RecommendationResponse,
  product: Pick<Product, "category" | "color" | "modeling">,
  options?: {
    body?: {
      height?: number | null;
      chest?: number | null;
      waist?: number | null;
      hip?: number | null;
      shoulder?: number | null;
    };
    photo?: PhotoAnalysis | null;
    garmentMeasurements?: GarmentMeasurement;
  },
): FitPreviewPayload {
  const bodyFromRegions = Object.fromEntries(
    response.regions.filter((r) => r.body != null).map((r) => [r.region, r.body]),
  );
  const garmentFromRegions = Object.fromEntries(
    response.regions.filter((r) => r.garment != null).map((r) => [r.region, r.garment]),
  );

  return {
    body: {
      height: options?.body?.height ?? null,
      chest: options?.body?.chest ?? (bodyFromRegions.chest as number | undefined) ?? null,
      waist: options?.body?.waist ?? (bodyFromRegions.waist as number | undefined) ?? null,
      hip: options?.body?.hip ?? (bodyFromRegions.hip as number | undefined) ?? null,
      shoulder: options?.body?.shoulder ?? (bodyFromRegions.shoulder as number | undefined) ?? null,
      photoRatios: options?.photo
        ? {
            shoulder_hip_ratio: options.photo.shoulder_hip_ratio,
            waist_hip_ratio: options.photo.waist_hip_ratio,
            torso_leg_ratio: options.photo.torso_leg_ratio,
          }
        : null,
    },
    garment: {
      category: product.category,
      color: product.color,
      modeling: product.modeling,
      evaluatedSize: response.evaluated_size,
      measurements: options?.garmentMeasurements ?? {
        chest: garmentFromRegions.chest as number | undefined,
        waist: garmentFromRegions.waist as number | undefined,
        hip: garmentFromRegions.hip as number | undefined,
        shoulder: garmentFromRegions.shoulder as number | undefined,
        length: garmentFromRegions.length as number | undefined,
      },
    },
    regions: response.regions,
    disclaimer: FIT_PREVIEW_DISCLAIMER,
  };
}

export function buildPreviewPayloadFromUserAndProduct(
  user: User,
  product: Product,
  response: RecommendationResponse,
): FitPreviewPayload {
  const size = product.sizes.find((s) => s.size_label === response.evaluated_size);
  return buildPreviewPayloadFromRecommendation(response, product, {
    body: user.measurements ?? undefined,
    photo: user.photo_analysis,
    garmentMeasurements: size?.measurements,
  });
}

export function mergeFitPreviewPayload(
  response: RecommendationResponse,
  fallback?: FitPreviewPayload | null,
): FitPreviewPayload | null {
  if (response.fit_preview) return response.fit_preview;
  return fallback ?? null;
}

export type { Category, Modeling, RegionDetail, FitPreviewPayload };
