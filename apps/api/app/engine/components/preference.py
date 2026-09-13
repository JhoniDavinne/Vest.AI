"""Componente 5 - Preferencia declarada de caimento (peso 10%).

A preferencia (justo / regular / solto) desloca a folga desejada em relacao
a folga de projeto. O componente mede a proximidade entre a folga real e a
folga preferida nas regioes de circunferencia.
"""

from __future__ import annotations

from ..config import EngineConfig
from ..types import CIRCUMFERENCE_REGIONS, FitPreference, GarmentSpec, RegionResult
from .measurements import gaussian_score


def preference_score(
    regions: list[RegionResult],
    spec: GarmentSpec,
    preference: FitPreference,
    config: EngineConfig,
) -> float:
    shift = config.preference_shift_cm[preference]
    weights = config.region_weights[spec.category]
    acc = 0.0
    total = 0.0
    for result in regions:
        if result.deviation is None or result.region not in CIRCUMFERENCE_REGIONS:
            continue
        preferred_deviation = result.deviation - shift
        weight = weights.get(result.region, 0.0)
        acc += weight * gaussian_score(preferred_deviation, config.preference_tolerance_cm)
        total += weight
    return acc / total if total else 0.5
