"""Componente 4 - Proporcoes estimadas pela foto (peso 15%, experimental).

A foto NAO e usada para classificar aparencia. Ela fornece apenas relacoes
geometricas aproximadas (ombro/quadril, cintura/quadril, tronco/pernas).

Uso no motor:
1. As proporcoes definem uma ENFASE regional: a regiao proporcionalmente
   maior recebe mais peso, pois tende a ser a que mais precisa de folga.
2. O score visual e a media dos scores regionais ponderada por essa enfase.
3. A consistencia entre foto e medidas informadas alimenta a CONFIANCA,
   nunca o julgamento do corpo.
"""

from __future__ import annotations

import math

from ..config import EngineConfig
from ..types import BodyProfile, GarmentSpec, Region, RegionResult, VisualProportions

# Relacao aproximada entre circunferencia e largura frontal em silhueta 2D.
_WIDTH_FROM_CIRCUMFERENCE = 1.0 / 2.6


def regional_emphasis(visual: VisualProportions, spec: GarmentSpec, config: EngineConfig) -> dict[Region, float]:
    """Deriva pesos regionais a partir das proporcoes da silhueta."""
    base = dict(config.region_weights[spec.category])
    shr = visual.shoulder_hip_ratio
    whr = visual.waist_hip_ratio
    emphasis = dict(base)

    if shr is not None:
        # Silhueta de referencia ~1.0 (ombros e quadril de largura similar).
        delta = max(-0.3, min(0.3, shr - 1.0))
        if Region.SHOULDER in emphasis:
            emphasis[Region.SHOULDER] *= 1.0 + max(0.0, delta) * 2.0
        if Region.CHEST in emphasis:
            emphasis[Region.CHEST] *= 1.0 + max(0.0, delta) * 1.0
        if Region.HIP in emphasis:
            emphasis[Region.HIP] *= 1.0 + max(0.0, -delta) * 2.0
    if whr is not None and Region.WAIST in emphasis:
        delta = max(-0.3, min(0.3, whr - 0.85))
        emphasis[Region.WAIST] *= 1.0 + max(0.0, delta) * 1.5

    total = sum(emphasis.values())
    return {k: v / total for k, v in emphasis.items()}


def visual_score(
    regions: list[RegionResult],
    visual: VisualProportions | None,
    spec: GarmentSpec,
    config: EngineConfig,
) -> float | None:
    if visual is None or not visual.available:
        return None
    emphasis = regional_emphasis(visual, spec, config)
    acc = 0.0
    total = 0.0
    for result in regions:
        if result.score is None:
            continue
        weight = emphasis.get(result.region, 0.0)
        acc += weight * result.score
        total += weight
    if total == 0:
        return None
    # Qualidade baixa da deteccao aproxima o componente de um valor neutro.
    raw = acc / total
    neutral = 0.7
    return visual.quality * raw + (1 - visual.quality) * neutral


def visual_consistency(body: BodyProfile, visual: VisualProportions | None) -> float | None:
    """0..1: coerencia entre proporcoes da foto e medidas informadas."""
    if visual is None or not visual.available:
        return None
    checks: list[float] = []
    if visual.shoulder_hip_ratio is not None and body.shoulder and body.hip:
        estimated = body.shoulder / (body.hip * _WIDTH_FROM_CIRCUMFERENCE)
        checks.append(math.exp(-0.5 * ((visual.shoulder_hip_ratio - estimated) / 0.15) ** 2))
    if visual.waist_hip_ratio is not None and body.waist and body.hip:
        estimated = body.waist / body.hip
        checks.append(math.exp(-0.5 * ((visual.waist_hip_ratio - estimated) / 0.12) ** 2))
    if not checks:
        return None
    return sum(checks) / len(checks)
