"""Textos explicaveis do motor (portugues), sem julgamento corporal.

A linguagem descreve como a PECA tende a vestir - nunca avalia o corpo.
"""

from __future__ import annotations

from .components.measurements import region_label
from .config import EngineConfig
from .types import FitPreference, Modeling, RegionResult, RegionStatus, SizeEvaluation

MODELING_PT = {
    Modeling.SLIM: "slim",
    Modeling.REGULAR: "regular",
    Modeling.RELAXED: "relaxed",
    Modeling.OVERSIZED: "oversized",
}

PREFERENCE_PT = {
    FitPreference.TIGHT: "justo",
    FitPreference.REGULAR: "regular",
    FitPreference.LOOSE: "solto",
}

STATUS_PT = {
    RegionStatus.GOOD: "Compativel",
    RegionStatus.ATTENTION: "Atencao",
    RegionStatus.EASE_RECOMMENDED: "Folga recomendada",
    RegionStatus.NOT_EVALUATED: "Nao avaliado",
}


def scale_band(score: float, config: EngineConfig) -> tuple[str, str, str]:
    """Retorna (codigo, rotulo, mensagem) da escala de caimento."""
    if score >= config.scale_high:
        return (
            "high",
            "Alta compatibilidade",
            "A peca tende a apresentar bom ajuste nas medidas informadas.",
        )
    if score >= config.scale_good:
        return (
            "good",
            "Boa compatibilidade",
            "Boa opcao; pode haver pequena diferenca em uma regiao especifica.",
        )
    if score >= config.scale_moderate:
        return (
            "moderate",
            "Compatibilidade moderada",
            "O tamanho pode servir, mas recomendamos observar algumas regioes.",
        )
    return (
        "low",
        "Baixa compatibilidade",
        "Outro tamanho ou modelagem tende a oferecer ajuste mais proximo da preferencia informada.",
    )


def _join_pt(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " e " + items[-1]


def build_explanation(
    evaluation: SizeEvaluation,
    modeling: Modeling,
    fabric: str,
    elasticity_pct: float,
    preference: FitPreference,
    visual_used: bool,
) -> str:
    regions = [r for r in evaluation.regions if r.status != RegionStatus.NOT_EVALUATED]
    good = [region_label(r.region) for r in regions if r.status == RegionStatus.GOOD]
    tight = [region_label(r.region) for r in regions if r.status == RegionStatus.EASE_RECOMMENDED]
    attention = [r for r in regions if r.status == RegionStatus.ATTENTION]

    parts: list[str] = []
    if len(good) == len(regions) and regions:
        parts.append(
            f"A modelagem {MODELING_PT[modeling]} apresenta boa compatibilidade com as medidas informadas "
            f"em todas as regioes analisadas."
        )
    elif good:
        parts.append(
            f"A modelagem {MODELING_PT[modeling]} apresenta boa compatibilidade em {_join_pt(good)}."
        )

    if tight:
        parts.append(
            f"Na regiao de {_join_pt(tight)} a peca tende a ficar mais ajustada do que a modelagem preve; "
            f"se voce prefere caimento mais solto, considere o tamanho seguinte."
        )
    loose_attention = [region_label(r.region) for r in attention if (r.deviation or 0) > 0]
    tight_attention = [region_label(r.region) for r in attention if (r.deviation or 0) <= 0]
    if loose_attention:
        parts.append(f"Em {_join_pt(loose_attention)} pode sobrar um pouco de tecido.")
    if tight_attention:
        parts.append(f"Em {_join_pt(tight_attention)} o ajuste tende a ser levemente mais proximo do corpo.")

    if elasticity_pct >= 8 and tight:
        parts.append(f"O tecido ({fabric}) possui elasticidade que compensa parte dessa diferenca.")
    elif elasticity_pct < 3 and (tight or tight_attention):
        parts.append(f"O tecido ({fabric}) tem pouca elasticidade, por isso a diferenca foi considerada integralmente.")

    parts.append(f"Preferencia declarada: caimento {PREFERENCE_PT[preference]}.")
    if visual_used:
        parts.append("Proporcoes estimadas pela foto foram usadas apenas como enriquecimento da estimativa.")
    return " ".join(parts)


def build_recommendation(
    evaluated: SizeEvaluation,
    recommended: SizeEvaluation,
    preference: FitPreference,
) -> str:
    if evaluated.size == recommended.size:
        return (
            f"O tamanho {recommended.size} apresenta o melhor equilibrio entre as regioes analisadas."
        )
    diff = evaluated.fit_score - recommended.fit_score
    direction = _direction_hint(evaluated.regions)
    return (
        f"O tamanho {evaluated.size} tende a ficar {direction} do que a preferencia informada "
        f"({PREFERENCE_PT[preference]}); o tamanho {recommended.size} apresenta melhor equilibrio "
        f"({recommended.fit_score:.1f} vs {evaluated.fit_score:.1f}, diferenca de {abs(diff):.1f} pontos)."
    )


def _direction_hint(regions: list[RegionResult]) -> str:
    deviations = [r.deviation for r in regions if r.deviation is not None]
    if not deviations:
        return "diferente"
    mean = sum(deviations) / len(deviations)
    if mean > 1.0:
        return "mais solto"
    if mean < -1.0:
        return "mais ajustado"
    return "ligeiramente diferente"
