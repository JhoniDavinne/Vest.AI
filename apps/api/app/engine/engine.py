"""Motor de recomendacao VESTE.AI - orquestracao dos componentes.

score = 0.40 * measurements
      + 0.20 * modeling
      + 0.15 * elasticity
      + 0.15 * visual_proportion   (redistribuido quando nao ha foto)
      + 0.10 * preference

O resultado e deterministico: mesmas entradas -> mesma saida.
"""

from __future__ import annotations

from .components.confidence import compute_confidence
from .components.elasticity import elasticity_score
from .components.measurements import evaluate_regions, measurements_score
from .components.modeling import modeling_score
from .components.preference import preference_score
from .components.visual import visual_consistency, visual_score
from .config import EngineConfig, get_engine_config
from .messages import build_explanation, build_recommendation, scale_band
from .types import (
    BodyProfile,
    ComponentScores,
    FitPreference,
    GarmentSize,
    GarmentSpec,
    RecommendationResult,
    Region,
    SizeEvaluation,
    VisualProportions,
)


class RecommendationEngine:
    def __init__(self, config: EngineConfig | None = None) -> None:
        self.config = config or get_engine_config()

    # ------------------------------------------------------------------ #
    # Avaliacao de um unico tamanho
    # ------------------------------------------------------------------ #
    def evaluate_size(
        self,
        body: BodyProfile,
        spec: GarmentSpec,
        size: GarmentSize,
        preference: FitPreference,
        visual: VisualProportions | None = None,
    ) -> SizeEvaluation:
        cfg = self.config
        regions = evaluate_regions(body, spec, size, cfg)

        c_measurements = measurements_score(regions, spec, cfg)
        c_modeling = modeling_score(regions, spec, cfg)
        c_elasticity = elasticity_score(regions, spec, cfg)
        c_visual = visual_score(regions, visual, spec, cfg)
        c_preference = preference_score(regions, spec, preference, cfg)

        weights = cfg.weights.as_dict() if c_visual is not None else cfg.weights.without_visual()
        raw = (
            weights["measurements"] * c_measurements
            + weights["modeling"] * c_modeling
            + weights["elasticity"] * c_elasticity
            + weights["visual_proportion"] * (c_visual or 0.0)
            + weights["preference"] * c_preference
        )
        fit_score = round(max(0.0, min(10.0, raw * 10.0)), 1)

        return SizeEvaluation(
            sku=size.sku,
            size=size.label,
            fit_score=fit_score,
            components=ComponentScores(
                measurements=c_measurements,
                modeling=c_modeling,
                elasticity=c_elasticity,
                visual_proportion=c_visual,
                preference=c_preference,
            ),
            weights_used={k: round(v, 4) for k, v in weights.items()},
            regions=regions,
        )

    # ------------------------------------------------------------------ #
    # Recomendacao completa (todos os tamanhos + escolha + explicacao)
    # ------------------------------------------------------------------ #
    def recommend(
        self,
        body: BodyProfile,
        spec: GarmentSpec,
        preference: FitPreference = FitPreference.REGULAR,
        visual: VisualProportions | None = None,
        evaluated_sku: str | None = None,
    ) -> RecommendationResult:
        if not spec.sizes:
            raise ValueError("A peca nao possui tamanhos cadastrados.")

        ordered = sorted(spec.sizes, key=lambda s: s.sort_order)
        evaluations = [self.evaluate_size(body, spec, s, preference, visual) for s in ordered]

        # Melhor score; empate -> tamanho mais proximo da preferencia (menor desvio medio).
        best = max(
            evaluations,
            key=lambda e: (e.fit_score, -abs(_mean_deviation(e, self.config, preference))),
        )
        evaluated = best
        if evaluated_sku:
            for e in evaluations:
                if e.sku == evaluated_sku:
                    evaluated = e
                    break

        sorted_scores = sorted((e.fit_score for e in evaluations), reverse=True)
        margin = sorted_scores[0] - sorted_scores[1] if len(sorted_scores) > 1 else 10.0

        coverage = _garment_coverage(spec, ordered[0], self.config)
        consistency = visual_consistency(body, visual)
        conf = compute_confidence(
            body=body,
            spec=spec,
            visual=visual,
            visual_consistency=consistency,
            garment_coverage=coverage,
            margin_points=margin,
            config=self.config,
        )

        code, label, message = scale_band(evaluated.fit_score, self.config)
        visual_used = evaluated.components.visual_proportion is not None
        explanation = build_explanation(
            evaluated, spec.modeling, spec.fabric, spec.elasticity_pct, preference, visual_used
        )
        recommendation = build_recommendation(evaluated, best, preference)

        notes = [
            "Estimativa de compatibilidade entre pessoa e peca; nao e uma avaliacao do corpo.",
            "Parametros heuristicos do MVP, nao validados cientificamente.",
        ]
        if visual is not None and visual.source != "unavailable":
            notes.append("Analise visual experimental.")
        if not visual_used:
            notes.append("Sem foto: o peso das proporcoes visuais foi redistribuido entre os demais componentes.")
        if conf.missing_measures:
            notes.append("Medidas ausentes: " + ", ".join(conf.missing_measures) + ".")
        if consistency is not None and consistency < 0.5:
            notes.append(
                "As proporcoes da foto divergem das medidas informadas; a confianca foi reduzida."
            )

        return RecommendationResult(
            product_id=spec.product_id,
            recommended_size=best.size,
            recommended_sku=best.sku,
            fit_score=evaluated.fit_score,
            confidence=conf.level,
            confidence_score=conf.score,
            confidence_message=conf.message,
            scale_label=label,
            scale_message=message,
            explanation=explanation,
            recommendation=recommendation,
            regional_analysis=evaluated.regional_analysis(),
            components=evaluated.components.as_dict(),
            weights=evaluated.weights_used,
            evaluated=evaluated,
            comparison=evaluations,
            visual_used=visual_used,
            notes=notes + [f"scale:{code}"],
        )


def _mean_deviation(evaluation: SizeEvaluation, config: EngineConfig, preference: FitPreference) -> float:
    shift = config.preference_shift_cm[preference]
    values = [r.deviation - shift for r in evaluation.regions if r.deviation is not None]
    return sum(values) / len(values) if values else 0.0


def _garment_coverage(spec: GarmentSpec, sample: GarmentSize, config: EngineConfig) -> float:
    regions = list(config.region_weights[spec.category])
    present = sum(1 for r in regions if sample.measure(r) is not None)
    return present / len(regions) if regions else 1.0


__all__ = ["RecommendationEngine", "Region"]
