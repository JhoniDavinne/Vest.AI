"""Testes unitarios do motor (puro, sem HTTP/banco)."""

from __future__ import annotations

import pytest

from app.engine import (
    BodyProfile,
    Category,
    Confidence,
    FitPreference,
    GarmentSize,
    GarmentSpec,
    Modeling,
    RecommendationEngine,
    VisualProportions,
)
from app.engine.components.measurements import gaussian_score
from app.engine.components.modeling import absorbed_fraction
from app.engine.config import EngineConfig, Weights
from app.seed.catalog import build_catalog

DEMO_BODY = BodyProfile(height=180, weight=78, chest=102, waist=88, hip=100, shoulder=45)


def spec_from_catalog(slug: str) -> GarmentSpec:
    item = next(p for p in build_catalog() if p["slug"] == slug)
    sizes = tuple(
        GarmentSize(
            sku=f"{item['sku_prefix']}-{s['size_label']}",
            label=s["size_label"],
            sort_order=i,
            **s["measurements"],
        )
        for i, s in enumerate(item["sizes"])
    )
    return GarmentSpec(
        product_id=item["slug"],
        name=item["name"],
        category=Category(item["category"]),
        modeling=Modeling(item["modeling"]),
        elasticity_pct=item["elasticity_pct"],
        fabric=item["fabric"],
        sizes=sizes,
    )


@pytest.fixture
def engine() -> RecommendationEngine:
    return RecommendationEngine()


def test_weights_sum_to_one():
    w = Weights()
    assert abs(sum(w.as_dict().values()) - 1.0) < 1e-9
    redistributed = w.without_visual()
    assert redistributed["visual_proportion"] == 0.0
    assert abs(sum(redistributed.values()) - 1.0) < 1e-9


def test_weights_validation_rejects_bad_sum():
    with pytest.raises(ValueError):
        Weights(measurements=0.5, modeling=0.5, elasticity=0.5, visual_proportion=0.0, preference=0.0)


def test_gaussian_score_monotonic():
    assert gaussian_score(0, 5) == 1.0
    assert gaussian_score(2, 5) > gaussian_score(4, 5) > gaussian_score(8, 5) > 0


def test_absorbed_fraction_bounds():
    assert absorbed_fraction(1.0, 5.0) == 1.0
    assert absorbed_fraction(10.0, 5.0) == 0.0
    assert 0 < absorbed_fraction(5.0, 5.0) < 1


def test_demo_tshirt_recommends_M_with_expected_curve(engine: RecommendationEngine):
    spec = spec_from_catalog("camiseta-essential-algodao")
    result = engine.recommend(DEMO_BODY, spec, FitPreference.REGULAR)
    scores = {e.size: e.fit_score for e in result.comparison}

    assert result.recommended_size == "M"
    assert 8.5 <= scores["M"] <= 9.0
    assert scores["L"] < scores["M"]
    assert scores["S"] < scores["L"]
    assert scores["XL"] < scores["L"]
    assert result.confidence == Confidence.MEDIUM  # medidas completas, sem foto
    assert set(result.regional_analysis) == {"chest", "shoulder", "waist", "hip", "length"}


def test_score_changes_when_evaluating_other_size(engine: RecommendationEngine):
    spec = spec_from_catalog("camiseta-essential-algodao")
    m = engine.recommend(DEMO_BODY, spec, FitPreference.REGULAR, evaluated_sku="CAMISETA-001-M")
    xl = engine.recommend(DEMO_BODY, spec, FitPreference.REGULAR, evaluated_sku="CAMISETA-001-XL")
    assert m.fit_score != xl.fit_score
    assert m.recommended_size == xl.recommended_size == "M"
    assert "melhor equilibrio" in xl.recommendation


def test_recommendation_changes_with_body(engine: RecommendationEngine):
    spec = spec_from_catalog("camiseta-essential-algodao")
    small = BodyProfile(height=165, weight=58, chest=88, waist=74, hip=90, shoulder=40)
    large = BodyProfile(height=188, weight=98, chest=116, waist=104, hip=112, shoulder=50)
    assert engine.recommend(small, spec).recommended_size in {"S", "M"}
    assert engine.recommend(large, spec).recommended_size in {"L", "XL"}
    assert engine.recommend(small, spec).recommended_size != engine.recommend(large, spec).recommended_size


def test_preference_shifts_scores(engine: RecommendationEngine):
    spec = spec_from_catalog("camiseta-essential-algodao")
    tight = engine.recommend(DEMO_BODY, spec, FitPreference.TIGHT)
    loose = engine.recommend(DEMO_BODY, spec, FitPreference.LOOSE)
    tight_scores = {e.size: e.fit_score for e in tight.comparison}
    loose_scores = {e.size: e.fit_score for e in loose.comparison}
    # Preferencia solta favorece tamanhos maiores em relacao a preferencia justa.
    assert loose_scores["L"] - tight_scores["L"] > 0
    assert tight_scores["S"] - loose_scores["S"] > 0


def test_photo_raises_confidence_to_high(engine: RecommendationEngine):
    spec = spec_from_catalog("camiseta-essential-algodao")
    visual = VisualProportions(shoulder_hip_ratio=1.15, waist_hip_ratio=0.88, torso_leg_ratio=0.8, quality=0.85, source="mediapipe")
    result = engine.recommend(DEMO_BODY, spec, FitPreference.REGULAR, visual=visual)
    assert result.visual_used is True
    assert result.confidence == Confidence.HIGH
    assert result.weights["visual_proportion"] == 0.15


def test_missing_measures_lower_confidence(engine: RecommendationEngine):
    spec = spec_from_catalog("camiseta-essential-algodao")
    partial = BodyProfile(height=180, chest=102)
    result = engine.recommend(partial, spec)
    assert result.confidence == Confidence.LOW
    assert result.regional_analysis["waist"] == "not_evaluated"


def test_deterministic(engine: RecommendationEngine):
    spec = spec_from_catalog("calca-alfaiataria-regular")
    a = engine.recommend(DEMO_BODY, spec)
    b = engine.recommend(DEMO_BODY, spec)
    assert a.fit_score == b.fit_score
    assert a.recommended_size == b.recommended_size
    assert a.explanation == b.explanation


def test_pants_use_waist_hip_length(engine: RecommendationEngine):
    spec = spec_from_catalog("calca-alfaiataria-regular")
    result = engine.recommend(DEMO_BODY, spec)
    assert set(result.regional_analysis) == {"waist", "hip", "length"}
    assert result.recommended_size == "42"


def test_elastic_fabric_tolerates_tightness():
    rigid = EngineConfig()
    engine = RecommendationEngine(rigid)
    body = BodyProfile(height=170, chest=96, waist=84, hip=104, shoulder=42)
    base = spec_from_catalog("calca-jeans-skinny-stretch")
    stiff = GarmentSpec(**{**base.__dict__, "elasticity_pct": 1})
    elastic_result = engine.recommend(body, base)
    stiff_result = engine.recommend(body, stiff)
    assert elastic_result.components["elasticity"] >= stiff_result.components["elasticity"]


def test_all_catalog_products_have_consistent_output(engine: RecommendationEngine):
    for item in build_catalog():
        spec = spec_from_catalog(item["slug"])
        result = engine.recommend(DEMO_BODY, spec)
        assert 0 <= result.fit_score <= 10
        assert result.recommended_size in {s.label for s in spec.sizes}
        assert len(result.comparison) == len(spec.sizes)
        assert result.explanation
