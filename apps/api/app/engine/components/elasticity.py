"""Componente 3 - Elasticidade / composicao do tecido (peso 15%).

Quando a peca fica mais justa que o previsto, o tecido pode compensar parte
da diferenca. A capacidade de compensacao e estimada como uma fracao
"confortavel" do alongamento nominal informado para o tecido.
"""

from __future__ import annotations

from ..config import EngineConfig
from ..types import CIRCUMFERENCE_REGIONS, GarmentSpec, RegionResult


def stretch_capacity_cm(garment_value: float, elasticity_pct: float, config: EngineConfig) -> float:
    return garment_value * (elasticity_pct / 100.0) * config.elastic_comfort_factor


def elasticity_score(regions: list[RegionResult], spec: GarmentSpec, config: EngineConfig) -> float:
    weights = config.region_weights[spec.category]
    acc = 0.0
    total = 0.0
    for result in regions:
        if result.deviation is None or result.region not in CIRCUMFERENCE_REGIONS:
            continue
        weight = weights.get(result.region, 0.0)
        if result.deviation >= 0:
            coverage = 1.0  # nao precisa de alongamento
        else:
            needed = abs(result.deviation)
            capacity = stretch_capacity_cm(result.garment or 0.0, spec.elasticity_pct, config)
            coverage = min(1.0, capacity / needed) if needed > 0 else 1.0
            # Tecido rigido com peca justa: pequena penalidade extra
            if spec.elasticity_pct < 3 and coverage < 1.0:
                coverage *= 0.85
        acc += weight * coverage
        total += weight
    return acc / total if total else 1.0
