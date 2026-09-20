export { FitPreview3D } from "./FitPreview3D";
export { AvatarScene } from "./AvatarScene";
export { AvatarBody } from "./AvatarBody";
export { GarmentMesh } from "./GarmentMesh";
export { GarmentPrimitive } from "./GarmentPrimitive";
export { StylizedSilhouette } from "./StylizedSilhouette";
export { ModelErrorBoundary } from "./ModelErrorBoundary";
export { FitPreviewControls } from "./FitPreviewControls";
export {
  buildPreviewPayloadFromRecommendation,
  buildPreviewPayloadFromUserAndProduct,
  mergeFitPreviewPayload,
} from "./types";
export type { FitPreview3DProps, FitPreviewPayload, FitPreviewSize, BodyScaleFactors } from "./types";
export { FIT_PREVIEW_DISCLAIMER, STATUS_COLOR_HEX, DEFAULT_MODELS_BASE, REFERENCE_BODY } from "./constants";
export { computeBodyScale, parseGarmentColor, garmentScale } from "./scaleBody";
export { useWebGLAvailable, useFitPreviewCanvasHeight } from "./useFitPreview";

// Assets / manifest
export {
  normalizeManifest,
  loadModelsManifest,
  clearManifestCache,
  resolveAvatarAsset,
  resolveGarmentAsset,
  isRenderableAsset,
  joinModelUrl,
} from "./manifest";
export type { ModelsManifest, ManifestAsset, AvatarManifestAsset, ResolvedAsset } from "./manifest";
export { useModelsManifest } from "./useModelsManifest";
export type { ManifestStatus, ModelsManifestState } from "./useModelsManifest";

// Avatar parametrico
export {
  computeAvatarMorphState,
  applyMorphState,
  factorToMorph,
  mergeMorphMapping,
  DEFAULT_MORPH_TARGET_MAPPING,
  MORPH_AXES,
} from "./avatarMorph";
export type { AvatarMorphState, MorphAxis, MorphTargetMapping, MorphTargetNames } from "./avatarMorph";
export { useAvatarModel } from "./useAvatarModel";
export type { AvatarModel } from "./useAvatarModel";

// Peca
export { computeGarmentVisualState, inferMaterial, MODELING_VOLUME } from "./garmentVisual";
export type { GarmentVisualState } from "./garmentVisual";
export { useGarmentModel } from "./useGarmentModel";
export type { GarmentModel } from "./useGarmentModel";

// Cena / camera
export { metricPlacement, SCENE_UNITS_PER_METER, SCENE_FLOOR_Y, metricCorrectionFactor } from "./modelUtils";
export { CAMERA_VIEWS, VIEW_AZIMUTH, stepDistance, clampDistance, poseForView, sphericalToPosition } from "./cameraViews";
export type { CameraView } from "./cameraViews";
export type { CameraCommand } from "./CameraRig";
