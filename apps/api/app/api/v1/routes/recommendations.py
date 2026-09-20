from __future__ import annotations

from fastapi import APIRouter, Query, status

from ....api.deps import DbSession, OptionalCompany
from ....models import FitAnalysis
from ....schemas import RecommendationRequest, RecommendationResponse
from ....services import recommendation_service
from ....services.errors import NotFoundError
from ....services.product_service import get_product

router = APIRouter()


@router.post(
    "",
    response_model=RecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calcular tamanho recomendado e score de caimento",
    description=(
        "Motor unico da VESTE.AI. Aceita medidas diretas (canal B2B/widget) ou um perfil "
        "autorizado (user_id). Envie o header X-API-Key para atribuir a chamada a uma empresa."
    ),
)
def create_recommendation(
    payload: RecommendationRequest, db: DbSession, company: OptionalCompany
) -> RecommendationResponse:
    if company is not None and payload.channel == "web":
        payload.channel = "api"
    return recommendation_service.run_recommendation(db, payload, company.id if company else None)


@router.get(
    "/{analysis_id}",
    response_model=RecommendationResponse,
    summary="Recuperar analise persistida",
    description=(
        "Recalcula de forma deterministica a partir do snapshot persistido (mesmo motor, mesma saida). "
        "Com `size`, avalia outro tamanho do mesmo produto usando exatamente as mesmas medidas da analise "
        "original, sem persistir nova analise."
    ),
)
def get_recommendation(
    analysis_id: str,
    db: DbSession,
    size: str | None = Query(default=None, description="Tamanho a avaliar (ex.: L); padrao = tamanho da analise"),
) -> RecommendationResponse:
    analysis = db.get(FitAnalysis, analysis_id)
    if analysis is None:
        raise NotFoundError("Analise nao encontrada.")
    # Recalcula de forma deterministica a partir do snapshot persistido (mesmo motor, mesma saida).
    product = get_product(db, analysis.product_id)
    if size:
        evaluated = next((s for s in product.sizes if s.size_label.lower() == size.lower()), None)
        if evaluated is None:
            raise NotFoundError(f"Tamanho '{size}' nao existe para o produto.")
    else:
        evaluated = next(s for s in product.sizes if s.id == analysis.evaluated_sku_id)
    snapshot = analysis.input_snapshot or {}
    payload = RecommendationRequest(
        sku=evaluated.sku,
        customer={
            k: snapshot.get(k) for k in ("height", "weight", "chest", "waist", "hip", "shoulder")
        },
        fit_preference=snapshot.get("fit_preference", analysis.fit_preference),
        photo_analysis_id=analysis.photo_analysis_id,
        use_photo=bool(snapshot.get("photo_used")),
        persist=False,
        channel="web",
    )
    response = recommendation_service.run_recommendation(db, payload, analysis.company_id)
    # Avaliacao de outro tamanho e derivada (nao persistida): mantem o vinculo com a analise,
    # mas nao altera o tamanho avaliado registrado.
    response.analysis_id = analysis.id
    response.created_at = analysis.created_at
    return response
