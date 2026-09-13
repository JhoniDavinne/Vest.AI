"""Indicadores do dashboard, calculados com Pandas sobre as analises persistidas.

Os numeros derivam de dados SEED simulados (gerados pelo proprio motor sobre
perfis sinteticos) e devem ser apresentados como "Dados simulados para demonstracao".
"""

from __future__ import annotations

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Feedback, FitAnalysis, Product
from ..schemas import MetricsOut

DISCLAIMER = "Dados simulados para demonstração."
BASELINE_RETURN_RATE = 0.30  # hipotese de mercado usada apenas para ilustrar o potencial

_CONF_VALUE = {"high": 1.0, "medium": 0.6, "low": 0.25}


def _analyses_frame(db: Session, company_id: str | None) -> pd.DataFrame:
    stmt = select(
        FitAnalysis.id,
        FitAnalysis.created_at,
        FitAnalysis.fit_score,
        FitAnalysis.confidence,
        FitAnalysis.confidence_score,
        FitAnalysis.recommended_size,
        FitAnalysis.evaluated_size,
        FitAnalysis.channel,
        FitAnalysis.company_id,
        Product.category,
        Product.name.label("product_name"),
    ).join(Product, Product.id == FitAnalysis.product_id)
    if company_id:
        stmt = stmt.where(FitAnalysis.company_id == company_id)
    rows = db.execute(stmt).all()
    frame = pd.DataFrame(
        rows,
        columns=[
            "id", "created_at", "fit_score", "confidence", "confidence_score", "recommended_size",
            "evaluated_size", "channel", "company_id", "category", "product_name",
        ],
    )
    if not frame.empty:
        frame["created_at"] = pd.to_datetime(frame["created_at"], utc=True)
    return frame


def _feedback_frame(db: Session, analysis_ids: list[str]) -> pd.DataFrame:
    if not analysis_ids:
        return pd.DataFrame(columns=["fit_analysis_id", "fit_rating", "followed_recommendation", "returned"])
    stmt = select(
        Feedback.fit_analysis_id, Feedback.fit_rating, Feedback.followed_recommendation, Feedback.returned
    ).where(Feedback.fit_analysis_id.in_(analysis_ids))
    rows = db.execute(stmt).all()
    return pd.DataFrame(rows, columns=["fit_analysis_id", "fit_rating", "followed_recommendation", "returned"])


def compute_metrics(db: Session, company_id: str | None = None) -> MetricsOut:
    analyses = _analyses_frame(db, company_id)
    if analyses.empty:
        return MetricsOut(
            disclaimer=DISCLAIMER,
            total_analyses=0,
            recommendation_rate=0.0,
            most_recommended_size=None,
            average_score=0.0,
            average_confidence=0.0,
            confidence_distribution={},
            size_distribution={},
            score_distribution=[],
            category_distribution=[],
            channel_distribution={},
            daily_series=[],
            feedback_summary={"total": 0},
            return_reduction_potential={},
        )

    feedback = _feedback_frame(db, analyses["id"].tolist())

    total = int(len(analyses))
    # Taxa de recomendacao: analises em que o motor sugeriu um tamanho com score >= 7.0
    recommendation_rate = float((analyses["fit_score"] >= 7.0).mean())
    most_recommended = analyses["recommended_size"].mode()
    average_score = float(analyses["fit_score"].mean())
    average_confidence = float(analyses["confidence"].map(_CONF_VALUE).fillna(0.5).mean())

    bins = [0, 5, 7, 8.5, 10.01]
    labels = ["0-4.9", "5.0-6.9", "7.0-8.4", "8.5-10"]
    score_hist = pd.cut(analyses["fit_score"], bins=bins, labels=labels, right=False).value_counts().sort_index()

    daily = (
        analyses.set_index("created_at")
        .sort_index()
        .resample("D")
        .agg(analyses=("id", "count"), avg_score=("fit_score", "mean"))
        .fillna(0)
        .tail(30)
    )

    category = (
        analyses.groupby("category")
        .agg(analyses=("id", "count"), avg_score=("fit_score", "mean"))
        .reset_index()
        .sort_values("analyses", ascending=False)
    )

    fb_total = int(len(feedback))
    if fb_total:
        followed = feedback[feedback["followed_recommendation"] == True]  # noqa: E712
        not_followed = feedback[feedback["followed_recommendation"] == False]  # noqa: E712
        return_rate_followed = float(followed["returned"].mean()) if len(followed) else 0.0
        return_rate_not_followed = (
            float(not_followed["returned"].mean()) if len(not_followed) else BASELINE_RETURN_RATE
        )
        good_fit_rate = float((feedback["fit_rating"] == "good").mean())
    else:
        return_rate_followed = 0.0
        return_rate_not_followed = BASELINE_RETURN_RATE
        good_fit_rate = 0.0

    reduction = max(0.0, return_rate_not_followed - return_rate_followed)
    relative_reduction = reduction / return_rate_not_followed if return_rate_not_followed else 0.0

    return MetricsOut(
        disclaimer=DISCLAIMER,
        total_analyses=total,
        recommendation_rate=round(recommendation_rate, 4),
        most_recommended_size=str(most_recommended.iloc[0]) if not most_recommended.empty else None,
        average_score=round(average_score, 2),
        average_confidence=round(average_confidence, 3),
        confidence_distribution={k: int(v) for k, v in analyses["confidence"].value_counts().items()},
        size_distribution={str(k): int(v) for k, v in analyses["recommended_size"].value_counts().items()},
        score_distribution=[{"range": str(k), "count": int(v)} for k, v in score_hist.items()],
        category_distribution=[
            {"category": row.category, "analyses": int(row.analyses), "avg_score": round(float(row.avg_score), 2)}
            for row in category.itertuples()
        ],
        channel_distribution={str(k): int(v) for k, v in analyses["channel"].value_counts().items()},
        daily_series=[
            {"date": idx.strftime("%Y-%m-%d"), "analyses": int(row.analyses), "avg_score": round(float(row.avg_score), 2)}
            for idx, row in daily.iterrows()
        ],
        feedback_summary={
            "total": fb_total,
            "good_fit_rate": round(good_fit_rate, 4),
            "rating_distribution": {k: int(v) for k, v in feedback["fit_rating"].value_counts().items()}
            if fb_total
            else {},
            "return_rate_followed": round(return_rate_followed, 4),
            "return_rate_not_followed": round(return_rate_not_followed, 4),
        },
        return_reduction_potential={
            "baseline_return_rate": BASELINE_RETURN_RATE,
            "return_rate_with_recommendation": round(return_rate_followed, 4),
            "absolute_reduction": round(reduction, 4),
            "relative_reduction": round(relative_reduction, 4),
            "note": "Hipotese ilustrativa baseada em feedback simulado; nao representa dados reais de mercado.",
        },
    )
