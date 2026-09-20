"""Schemas Pydantic (contratos HTTP) da API v1."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FitPreferenceLiteral = Literal["tight", "regular", "loose"]
ModelingLiteral = Literal["slim", "regular", "relaxed", "oversized"]
CategoryLiteral = Literal["tshirt", "shirt", "polo", "hoodie", "jacket", "dress", "pants", "shorts"]
ConfidenceLiteral = Literal["high", "medium", "low"]


# --------------------------------------------------------------------------- #
# Medidas
# --------------------------------------------------------------------------- #
class MeasurementsIn(BaseModel):
    height: float | None = Field(default=None, ge=100, le=230, description="Altura em cm")
    weight: float | None = Field(default=None, ge=30, le=250, description="Peso em kg")
    chest: float | None = Field(default=None, ge=60, le=180, description="Peito/torax (circunferencia, cm)")
    waist: float | None = Field(default=None, ge=50, le=180, description="Cintura (circunferencia, cm)")
    hip: float | None = Field(default=None, ge=60, le=190, description="Quadril (circunferencia, cm)")
    shoulder: float | None = Field(default=None, ge=30, le=70, description="Largura de ombro a ombro (cm)")


class MeasurementsOut(MeasurementsIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


# --------------------------------------------------------------------------- #
# Usuario
# --------------------------------------------------------------------------- #
class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str | None = None
    fit_preference: FitPreferenceLiteral = "regular"
    photo_consent: bool = False
    measurements: MeasurementsIn


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    fit_preference: FitPreferenceLiteral | None = None
    photo_consent: bool | None = None


class PhotoAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    source: str
    quality: float
    shoulder_hip_ratio: float | None
    waist_hip_ratio: float | None
    torso_leg_ratio: float | None
    message: str
    created_at: datetime


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str | None
    fit_preference: str
    photo_consent: bool
    created_at: datetime
    measurements: MeasurementsOut | None = None
    photo_analysis: PhotoAnalysisOut | None = None


# --------------------------------------------------------------------------- #
# Produto
# --------------------------------------------------------------------------- #
class GarmentMeasurementIn(BaseModel):
    chest: float | None = None
    waist: float | None = None
    hip: float | None = None
    shoulder: float | None = None
    length: float | None = None
    sleeve: float | None = None
    width: float | None = None


class SizeIn(BaseModel):
    size_label: str = Field(min_length=1, max_length=12)
    sku: str | None = None
    stock: int = 10
    measurements: GarmentMeasurementIn


class SizeOut(BaseModel):
    id: str
    sku: str
    size_label: str
    sort_order: int
    stock: int
    measurements: GarmentMeasurementIn


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    brand: str = Field(min_length=1, max_length=80)
    category: CategoryLiteral
    audience: str = "unissex"
    description: str = ""
    image_url: str = ""
    color: str = ""
    price_cents: int = 0
    modeling: ModelingLiteral
    fabric: str = ""
    composition: str = ""
    elasticity_pct: float = Field(default=3.0, ge=0, le=40)
    care: str = ""
    slug: str | None = None
    sizes: list[SizeIn] = Field(min_length=1)


class ProductSummary(BaseModel):
    id: str
    slug: str
    name: str
    brand: str
    category: str
    audience: str
    description: str
    image_url: str
    color: str
    price_cents: int
    modeling: str
    fabric: str
    composition: str
    elasticity_pct: float
    company_id: str | None
    company_name: str | None = None
    available_sizes: list[str]


class ProductOut(ProductSummary):
    care: str
    sizes: list[SizeOut]
    created_at: datetime


# --------------------------------------------------------------------------- #
# Recomendacao
# --------------------------------------------------------------------------- #
class CustomerIn(MeasurementsIn):
    """Medidas do consumidor enviadas diretamente (canal B2B/widget)."""


class RecommendationRequest(BaseModel):
    sku: str | None = Field(default=None, description="SKU avaliado (ex.: CAMISETA-001-M)")
    product_id: str | None = Field(default=None, description="Alternativa ao SKU: id ou slug do produto")
    size: str | None = Field(default=None, description="Tamanho a avaliar quando product_id e usado")
    user_id: str | None = Field(default=None, description="Perfil autorizado (usa medidas persistidas)")
    customer: CustomerIn | None = Field(default=None, description="Medidas informadas diretamente")
    fit_preference: FitPreferenceLiteral | None = None
    photo_analysis_id: str | None = None
    use_photo: bool = True
    channel: Literal["web", "api", "widget"] = "api"
    persist: bool = True

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "sku": "CAMISETA-001-M",
                    "customer": {"height": 180, "chest": 102, "waist": 88, "hip": 100, "shoulder": 45},
                    "fit_preference": "regular",
                }
            ]
        }
    )


class RegionDetail(BaseModel):
    region: str
    status: str
    label: str
    body: float | None
    garment: float | None
    ease: float | None
    design_ease: float | None
    deviation: float | None
    score: float | None
    note: str


class FitPreviewBodyPayload(BaseModel):
    height: float | None = None
    chest: float | None = None
    waist: float | None = None
    hip: float | None = None
    shoulder: float | None = None
    photoRatios: dict[str, float | None] | None = None


class FitPreviewGarmentPayload(BaseModel):
    category: CategoryLiteral
    color: str = ""
    modeling: ModelingLiteral
    fabric: str = ""  # aparencia do material 3D; nao altera o caimento
    elasticity_pct: float | None = None
    evaluatedSize: str
    measurements: GarmentMeasurementIn


class FitPreviewPayload(BaseModel):
    body: FitPreviewBodyPayload
    garment: FitPreviewGarmentPayload
    regions: list[RegionDetail]
    disclaimer: str


class SizeComparison(BaseModel):
    sku: str
    size: str
    fit_score: float
    recommended: bool
    components: dict[str, float | None]
    regional_analysis: dict[str, str]


class RecommendationResponse(BaseModel):
    analysis_id: str | None
    product_id: str
    product_name: str
    evaluated_sku: str
    evaluated_size: str
    recommended_sku: str
    recommended_size: str
    fit_score: float
    confidence: ConfidenceLiteral
    confidence_score: float
    confidence_message: str
    scale_label: str
    scale_message: str
    regional_analysis: dict[str, str]
    explanation: str
    recommendation: str
    components: dict[str, float | None]
    weights: dict[str, float]
    regions: list[RegionDetail]
    comparison: list[SizeComparison]
    visual_used: bool
    notes: list[str]
    fit_preview: FitPreviewPayload | None = None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Feedback
# --------------------------------------------------------------------------- #
class FeedbackCreate(BaseModel):
    analysis_id: str
    fit_rating: Literal["too_tight", "good", "too_loose"]
    purchased_size: str | None = None
    followed_recommendation: bool = True
    returned: bool = False
    return_reason: str | None = None
    comment: str | None = Field(default=None, max_length=500)


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    fit_analysis_id: str
    fit_rating: str
    purchased_size: str | None
    followed_recommendation: bool
    returned: bool
    created_at: datetime


# --------------------------------------------------------------------------- #
# B2B
# --------------------------------------------------------------------------- #
class IntegrationKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    key: str
    active: bool
    usage_count: int
    created_at: datetime


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    segment: str
    website: str | None
    plan: str
    created_at: datetime


class CompanyDashboard(BaseModel):
    company: CompanyOut
    integration_keys: list[IntegrationKeyOut]
    products_count: int
    skus_count: int
    analyses_count: int
    api_calls_count: int
    widget_calls_count: int


# --------------------------------------------------------------------------- #
# Metricas
# --------------------------------------------------------------------------- #
class MetricsOut(BaseModel):
    disclaimer: str
    total_analyses: int
    recommendation_rate: float
    most_recommended_size: str | None
    average_score: float
    average_confidence: float
    confidence_distribution: dict[str, int]
    size_distribution: dict[str, int]
    score_distribution: list[dict]
    category_distribution: list[dict]
    channel_distribution: dict[str, int]
    daily_series: list[dict]
    feedback_summary: dict
    return_reduction_potential: dict
