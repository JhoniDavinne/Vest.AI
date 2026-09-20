"""Monta o payload JSON do provador visual 3D a partir do motor e entidades."""

from __future__ import annotations

from ..engine import BodyProfile, RecommendationResult, VisualProportions
from ..models import Product, SKUSize
from ..schemas import FitPreviewPayload, RegionDetail

FIT_PREVIEW_DISCLAIMER = (
    "Silhueta estilizada com faixas de caimento estimadas. "
    "Não substitui prova física da peça nem representa o seu corpo."
)


def build_fit_preview(
    *,
    product: Product,
    sku: SKUSize,
    body: BodyProfile,
    result: RecommendationResult,
    visual: VisualProportions | None,
    regions: list[RegionDetail],
) -> FitPreviewPayload:
    m = sku.measurement
    return FitPreviewPayload(
        body={
            "height": body.height,
            "chest": body.chest,
            "waist": body.waist,
            "hip": body.hip,
            "shoulder": body.shoulder,
            "photoRatios": {
                "shoulder_hip_ratio": visual.shoulder_hip_ratio if visual else None,
                "waist_hip_ratio": visual.waist_hip_ratio if visual else None,
                "torso_leg_ratio": visual.torso_leg_ratio if visual else None,
            }
            if visual
            else None,
        },
        garment={
            "category": product.category,
            "color": product.color or "",
            "modeling": product.modeling,
            "fabric": product.fabric or product.composition or "",
            "elasticity_pct": product.elasticity_pct,
            "evaluatedSize": sku.size_label,
            "measurements": {
                "chest": m.chest if m else None,
                "waist": m.waist if m else None,
                "hip": m.hip if m else None,
                "shoulder": m.shoulder if m else None,
                "length": m.length if m else None,
                "sleeve": m.sleeve if m else None,
                "width": m.width if m else None,
            },
        },
        regions=regions,
        disclaimer=FIT_PREVIEW_DISCLAIMER,
    )
