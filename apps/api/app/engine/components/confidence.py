"""Nivel de confianca da estimativa.

A confianca reflete quantidade e qualidade dos dados disponiveis - nunca a
"qualidade do corpo". Regras do MVP:

* medidas incompletas para a categoria  -> baixa
* medidas completas, sem foto           -> media
* medidas completas + foto utilizavel   -> alta

Um score numerico (0..1) acompanha o nivel para transparencia.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..config import EngineConfig
from ..types import BodyProfile, Confidence, GarmentSpec, Region, VisualProportions


@dataclass
class ConfidenceResult:
    level: Confidence
    score: float
    message: str
    missing_measures: list[str]
    photo_used: bool
    factors: dict[str, float]


def required_regions(spec: GarmentSpec, config: EngineConfig) -> list[Region]:
    return [r for r in config.region_weights[spec.category] if r != Region.LENGTH]


def compute_confidence(
    body: BodyProfile,
    spec: GarmentSpec,
    visual: VisualProportions | None,
    visual_consistency: float | None,
    garment_coverage: float,
    margin_points: float,
    config: EngineConfig,
) -> ConfidenceResult:
    required = required_regions(spec, config)
    missing = [r.value for r in required if body.measure(r) is None]
    measures_factor = (len(required) - len(missing)) / len(required) if required else 1.0
    # altura e peso enriquecem, mas nao sao obrigatorios
    extras = sum(1 for v in (body.height, body.weight) if v is not None) / 2
    measures_factor = 0.85 * measures_factor + 0.15 * extras

    photo_used = bool(visual and visual.available)
    photo_factor = 0.0
    if photo_used and visual is not None:
        photo_factor = visual.quality
        if visual_consistency is not None:
            photo_factor *= 0.5 + 0.5 * visual_consistency

    margin_factor = min(1.0, margin_points / config.clear_margin_points)

    w = config.confidence_weights
    score = (
        w["measurements"] * measures_factor
        + w["photo"] * photo_factor
        + w["garment_coverage"] * garment_coverage
        + w["margin"] * margin_factor
    )
    score = round(min(1.0, max(0.0, score)), 3)

    if missing:
        level = Confidence.LOW
        message = "Confianca baixa - faltam informacoes para uma estimativa mais precisa."
    elif photo_used and score >= config.confidence_high_threshold:
        level = Confidence.HIGH
        message = "Confianca alta - medidas completas e analise visual disponivel."
    elif score >= config.confidence_medium_threshold:
        level = Confidence.MEDIUM
        message = "Confianca media - baseada nas medidas informadas."
    else:
        level = Confidence.LOW
        message = "Confianca baixa - faltam informacoes para uma estimativa mais precisa."

    return ConfidenceResult(
        level=level,
        score=score,
        message=message,
        missing_measures=missing,
        photo_used=photo_used,
        factors={
            "measurements": round(measures_factor, 3),
            "photo": round(photo_factor, 3),
            "garment_coverage": round(garment_coverage, 3),
            "margin": round(margin_factor, 3),
        },
    )
