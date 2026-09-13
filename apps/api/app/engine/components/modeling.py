"""Componente 2 - Tolerancia da modelagem (peso 20%).

Cada modelagem (slim, regular, relaxed, oversized) absorve uma faixa de
diferenca em centimetros sem alterar a percepcao de caimento. O componente
mede quanto do desvio de cada regiao cabe dentro dessa faixa.
"""

from __future__ import annotations

from ..config import EngineConfig
from ..types import GarmentSpec, RegionResult


def absorbed_fraction(deviation: float, band: float) -> float:
    """1.0 se |desvio| <= band/2; 0.0 se |desvio| >= 2*band; linear no meio."""
    magnitude = abs(deviation)
    lower = band * 0.5
    upper = band * 2.0
    if magnitude <= lower:
        return 1.0
    if magnitude >= upper:
        return 0.0
    return 1.0 - (magnitude - lower) / (upper - lower)


def modeling_score(regions: list[RegionResult], spec: GarmentSpec, config: EngineConfig) -> float:
    band = config.modeling_band_cm[spec.modeling]
    weights = config.region_weights[spec.category]
    acc = 0.0
    total = 0.0
    for result in regions:
        if result.deviation is None:
            continue
        weight = weights.get(result.region, 0.0)
        acc += weight * absorbed_fraction(result.deviation, band)
        total += weight
    return acc / total if total else 0.0
