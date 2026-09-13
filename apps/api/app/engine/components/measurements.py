"""Componente 1 - Compatibilidade das medidas principais (peso 40%).

Para cada regiao compara a folga real (peca - corpo) com a folga de projeto da
modelagem. Quanto mais proximo da folga prevista, maior a compatibilidade.
"""

from __future__ import annotations

import math

from ..config import EngineConfig
from ..types import BodyProfile, GarmentSize, GarmentSpec, Region, RegionResult, RegionStatus

_REGION_LABEL_PT = {
    Region.CHEST: "peito",
    Region.WAIST: "cintura",
    Region.HIP: "quadril",
    Region.SHOULDER: "ombros",
    Region.LENGTH: "comprimento",
}


def region_label(region: Region) -> str:
    return _REGION_LABEL_PT[region]


def gaussian_score(deviation: float, tolerance: float) -> float:
    """Pontuacao 0..1 decrescente com o desvio; 1.0 quando o desvio e zero."""
    if tolerance <= 0:
        return 0.0
    return math.exp(-0.5 * (deviation / tolerance) ** 2)


def expected_body_length(body: BodyProfile, spec: GarmentSpec, config: EngineConfig) -> float | None:
    if body.height is None:
        return None
    return body.height * config.expected_length_ratio[spec.category]


def evaluate_regions(
    body: BodyProfile, spec: GarmentSpec, size: GarmentSize, config: EngineConfig
) -> list[RegionResult]:
    """Calcula folga, desvio, status e score por regiao relevante para a categoria."""
    results: list[RegionResult] = []
    design = config.design_ease_cm[spec.category][spec.modeling]

    for region in config.region_weights[spec.category]:
        garment_value = size.measure(region)
        if region == Region.LENGTH:
            body_value = expected_body_length(body, spec, config)
            tolerance = config.tolerances.get(region) * config.length_tolerance_factor
        else:
            body_value = body.measure(region)
            tolerance = config.tolerances.get(region)

        if garment_value is None or body_value is None:
            results.append(
                RegionResult(
                    region=region,
                    status=RegionStatus.NOT_EVALUATED,
                    body=body_value,
                    garment=garment_value,
                    ease=None,
                    design_ease=design.get(region),
                    deviation=None,
                    score=None,
                    note="Medida nao informada.",
                )
            )
            continue

        ease = garment_value - body_value
        design_ease = design.get(region, 0.0)
        deviation = ease - design_ease
        effective_tol = tolerance * (config.tight_side_factor if deviation < 0 else 1.0)
        score = gaussian_score(deviation, effective_tol)
        status, note = _classify(region, deviation, tolerance, config)

        results.append(
            RegionResult(
                region=region,
                status=status,
                body=round(body_value, 1),
                garment=round(garment_value, 1),
                ease=round(ease, 1),
                design_ease=design_ease,
                deviation=round(deviation, 1),
                score=round(score, 4),
                note=note,
            )
        )
    return results


def _classify(
    region: Region, deviation: float, tolerance: float, config: EngineConfig
) -> tuple[RegionStatus, str]:
    label = region_label(region)
    if abs(deviation) <= tolerance * config.status_good_fraction:
        return RegionStatus.GOOD, f"Folga em {label} proxima da prevista pela modelagem."
    if deviation < -tolerance * config.status_tight_fraction:
        return (
            RegionStatus.EASE_RECOMMENDED,
            f"A peca tende a ficar mais ajustada em {label} do que a modelagem preve.",
        )
    if deviation < 0:
        return RegionStatus.ATTENTION, f"Leve ajuste em {label}; observar esta regiao."
    return RegionStatus.ATTENTION, f"Folga em {label} acima da prevista; pode sobrar tecido."


def measurements_score(regions: list[RegionResult], spec: GarmentSpec, config: EngineConfig) -> float:
    """Media ponderada (pesos por categoria) dos scores regionais disponiveis."""
    weights = config.region_weights[spec.category]
    total_weight = 0.0
    acc = 0.0
    for result in regions:
        if result.score is None:
            continue
        weight = weights.get(result.region, 0.0)
        acc += weight * result.score
        total_weight += weight
    if total_weight == 0:
        return 0.0
    return acc / total_weight
