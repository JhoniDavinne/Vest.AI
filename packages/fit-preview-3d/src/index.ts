export { FitPreview3D } from "./FitPreview3D";
export { AvatarScene } from "./AvatarScene";
export { AvatarBody } from "./AvatarBody";
export { GarmentMesh } from "./GarmentMesh";
export { GarmentPrimitive } from "./GarmentPrimitive";
export { StylizedSilhouette } from "./StylizedSilhouette";
export { ModelErrorBoundary } from "./ModelErrorBoundary";
export { FitPreviewControls } from "./FitPreviewControls";
export { SizeSelector3D } from "./SizeSelector3D";
export type { SizeSelector3DProps } from "./SizeSelector3D";
export { FitLegend } from "./FitLegend";
export { RegionalOverlay } from "./RegionalOverlay";

// Integracao com o motor (estado visual normalizado)
export {
  createFitVisualizationState,
  createFitVisualizationStateForSize,
  createFitVisualizationStateFromComparison,
  createFitVisualizationStateFromPayload,
  applyFitStateToPayload,
  fitStateToRegionDetails,
  listSizeOptions,
  buildRegions,
  toRegionVisual,
  FIT_REGION_KEYS,
} from "./fitVisualization";
export type {
  FitVisualizationState,
  FitRegionVisual,
  FitRegionKey,
  FitVisualizationSource,
  SizeOption,
} from "./fitVisualization";
export { describeRegionFit, legendLine, fitDirection, regionIntensity, REGION_LABEL_PT } from "./regionLegend";
export type { FitDirection } from "./regionLegend";
export {
  buildPreviewPayloadFromRecommendation,
  buildPreviewPayloadFromUserAndProduct,
  mergeFitPreviewPayload,
} from "./types";
export type { FitPreview3DProps, FitPreviewPayload, FitPreviewSize, BodyScaleFactors } from "./types";
export { FIT_PREVIEW_DISCLAIMER, FIT_PREVIEW_DISCLAIMER_REAL, FIT_PREVIEW_DISCLAIMER_SILHOUETTE, resolvePreviewDisclaimer, STATUS_COLOR_HEX, DEFAULT_MODELS_BASE, REFERENCE_BODY } from "./constants";
export type { PreviewRendererKind } from "./constants";
export { computeBodyScale, parseGarmentColor, garmentScale } from "./scaleBody";
export { useWebGLAvailable, useFitPreviewCanvasHeight, useResponsiveCanvasHeight, usePrefersReducedMotion } from "./useFitPreview";
export { ensureFitPreviewStyles, FIT_PREVIEW_CSS } from "./styles";

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
export type { ModelsManifest, ManifestAsset, AvatarManifestAsset, GarmentManifestAsset, ResolvedAsset } from "./manifest";
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
export { computeAvatarDeformationProfile, classifyBone, selectAdapterKind, dampedBoneScale, profilesDifferVisually } from "./avatarDeformation";
export type { AvatarDeformationProfile, AdapterKind, AvatarBaseMeasurements } from "./avatarDeformation";
export {
  detectAdapterKind,
  applySkeletonAdapter,
  applyRegionalScaleAdapter,
  applyMorphTargetAdapter,
  applyAvatarDeformation,
} from "./avatarAdapters";
export { useAvatarModel, preloadAvatarModel } from "./useAvatarModel";
export type { AvatarModel } from "./useAvatarModel";

// Peca
export { computeGarmentVisualState, inferMaterial, MODELING_VOLUME } from "./garmentVisual";
export type { GarmentVisualState } from "./garmentVisual";
export { computeGarmentTransformProfile, sizeVisualScale, regionFitScale } from "./garmentTransform";
export type { GarmentTransformProfile } from "./garmentTransform";
export { useGarmentModel, preloadGarmentModel } from "./useGarmentModel";
export type { GarmentModel } from "./useGarmentModel";

// Cena / camera
export { metricPlacement, SCENE_UNITS_PER_METER, SCENE_FLOOR_Y, metricCorrectionFactor, orientTPoseToCamera, isSceneDebugEnabled } from "./modelUtils";
export { CAMERA_VIEWS, VIEW_AZIMUTH, stepDistance, clampDistance, poseForView, sphericalToPosition } from "./cameraViews";
export type { CameraView } from "./cameraViews";
export type { CameraCommand } from "./CameraRig";
export { computeCameraFraming, radiusForHeight, defaultCameraFraming, framingBoundsFromAvatar } from "./cameraFraming";
export type { CameraFraming } from "./cameraFraming";
export { regionLayoutFromBounds, defaultRegionLayout } from "./regionLayout";
