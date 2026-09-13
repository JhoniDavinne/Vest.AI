"""Servico de recomendacao: resolve entradas, chama o motor e persiste a analise.

E o UNICO ponto de entrada para o motor a partir da camada HTTP, garantindo
que web, API B2B e widget usem exatamente o mesmo calculo.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..engine import BodyProfile, FitPreference, RecommendationEngine, RecommendationResult, VisualProportions
from ..engine.messages import STATUS_PT
from ..models import FitAnalysis, PhotoAnalysis, Product, SKUSize
from ..schemas import RecommendationRequest, RecommendationResponse, RegionDetail, SizeComparison
from .errors import NotFoundError, ValidationError
from .mappers import measurements_to_body, photo_to_visual, product_to_spec
from .product_service import get_product, get_sku
from .user_service import get_user, latest_measurement, latest_photo

_engine = RecommendationEngine()


def resolve_target(db: Session, payload: RecommendationRequest) -> tuple[Product, SKUSize]:
    if payload.sku:
        sku = get_sku(db, payload.sku)
        return sku.product, sku
    if payload.product_id:
        product = get_product(db, payload.product_id)
        if not product.sizes:
            raise ValidationError("Produto sem tamanhos cadastrados.")
        if payload.size:
            for s in product.sizes:
                if s.size_label.lower() == payload.size.lower():
                    return product, s
            raise NotFoundError(f"Tamanho '{payload.size}' nao existe para o produto.")
        # sem tamanho: avalia o do meio como ponto de partida (o recomendado sera calculado)
        return product, product.sizes[len(product.sizes) // 2]
    raise ValidationError("Informe 'sku' ou 'product_id'.")


def resolve_body(db: Session, payload: RecommendationRequest) -> tuple[BodyProfile, FitPreference, PhotoAnalysis | None, str | None]:
    preference_value = payload.fit_preference
    photo: PhotoAnalysis | None = None
    user_id: str | None = None

    if payload.customer is not None and any(v is not None for v in payload.customer.model_dump().values()):
        body = measurements_to_body(payload.customer)
    elif payload.user_id:
        user = get_user(db, payload.user_id)
        user_id = user.id
        body = measurements_to_body(latest_measurement(db, user.id))
        preference_value = preference_value or user.fit_preference
    else:
        raise ValidationError("Informe as medidas do consumidor ('customer') ou um 'user_id'.")

    if payload.user_id and user_id is None:
        user = get_user(db, payload.user_id)
        user_id = user.id
        preference_value = preference_value or user.fit_preference

    if payload.use_photo:
        if payload.photo_analysis_id:
            photo = db.get(PhotoAnalysis, payload.photo_analysis_id)
            if photo is None:
                raise NotFoundError("Analise de foto nao encontrada.")
        elif user_id:
            photo = latest_photo(db, user_id)

    preference = FitPreference(preference_value or "regular")
    return body, preference, photo, user_id


def run_recommendation(
    db: Session, payload: RecommendationRequest, company_id: str | None = None
) -> RecommendationResponse:
    product, sku = resolve_target(db, payload)
    body, preference, photo, user_id = resolve_body(db, payload)
    visual: VisualProportions | None = photo_to_visual(photo)

    spec = product_to_spec(product)
    result = _engine.recommend(body, spec, preference, visual=visual, evaluated_sku=sku.sku)

    analysis: FitAnalysis | None = None
    if payload.persist:
        analysis = persist_analysis(
            db,
            product=product,
            evaluated=sku,
            result=result,
            body=body,
            preference=preference,
            user_id=user_id,
            company_id=company_id,
            photo=photo,
            channel=payload.channel,
        )

    return build_response(product, sku, result, analysis)


def persist_analysis(
    db: Session,
    *,
    product: Product,
    evaluated: SKUSize,
    result: RecommendationResult,
    body: BodyProfile,
    preference: FitPreference,
    user_id: str | None,
    company_id: str | None,
    photo: PhotoAnalysis | None,
    channel: str,
    created_at: datetime | None = None,
) -> FitAnalysis:
    recommended_sku = next(s for s in product.sizes if s.sku == result.recommended_sku)
    analysis = FitAnalysis(
        user_id=user_id,
        company_id=company_id or product.company_id,
        product_id=product.id,
        evaluated_sku_id=evaluated.id,
        recommended_sku_id=recommended_sku.id,
        photo_analysis_id=photo.id if photo else None,
        evaluated_size=evaluated.size_label,
        recommended_size=result.recommended_size,
        fit_score=result.fit_score,
        confidence=result.confidence.value,
        confidence_score=result.confidence_score,
        fit_preference=preference.value,
        regional_analysis=result.regional_analysis,
        components=result.components,
        comparison=[{"size": e.size, "sku": e.sku, "fit_score": e.fit_score} for e in result.comparison],
        explanation=result.explanation,
        recommendation=result.recommendation,
        channel=channel,
        input_snapshot={
            "height": body.height,
            "weight": body.weight,
            "chest": body.chest,
            "waist": body.waist,
            "hip": body.hip,
            "shoulder": body.shoulder,
            "fit_preference": preference.value,
            "photo_used": result.visual_used,
        },
    )
    if created_at is not None:
        analysis.created_at = created_at
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def build_response(
    product: Product, sku: SKUSize, result: RecommendationResult, analysis: FitAnalysis | None
) -> RecommendationResponse:
    regions = [
        RegionDetail(
            region=r.region.value,
            status=r.status.value,
            label=STATUS_PT[r.status],
            body=r.body,
            garment=r.garment,
            ease=r.ease,
            design_ease=r.design_ease,
            deviation=r.deviation,
            score=r.score,
            note=r.note,
        )
        for r in result.evaluated.regions
    ]
    comparison = [
        SizeComparison(
            sku=e.sku,
            size=e.size,
            fit_score=e.fit_score,
            recommended=e.sku == result.recommended_sku,
            components=e.components.as_dict(),
            regional_analysis=e.regional_analysis(),
        )
        for e in result.comparison
    ]
    return RecommendationResponse(
        analysis_id=analysis.id if analysis else None,
        product_id=product.id,
        product_name=product.name,
        evaluated_sku=sku.sku,
        evaluated_size=sku.size_label,
        recommended_sku=result.recommended_sku,
        recommended_size=result.recommended_size,
        fit_score=result.fit_score,
        confidence=result.confidence.value,
        confidence_score=result.confidence_score,
        confidence_message=result.confidence_message,
        scale_label=result.scale_label,
        scale_message=result.scale_message,
        regional_analysis=result.regional_analysis,
        explanation=result.explanation,
        recommendation=result.recommendation,
        components=result.components,
        weights=result.weights,
        regions=regions,
        comparison=comparison,
        visual_used=result.visual_used,
        notes=[n for n in result.notes if not n.startswith("scale:")],
        created_at=analysis.created_at if analysis else datetime.now(timezone.utc),
    )
