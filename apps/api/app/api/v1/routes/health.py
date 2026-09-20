from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from ....api.deps import DbSession
from ....core.config import get_settings
from ....core.database import active_database_url
from ....models import FitAnalysis, Product
from ....services.tryon import service as tryon_service
from ....services.tryon.provider import VirtualTryOnProvider
from ....vision import mediapipe_available

router = APIRouter()


@router.get("/health", summary="Status da API e do banco")
def health(
    db: DbSession, provider: Annotated[VirtualTryOnProvider, Depends(tryon_service.get_provider)]
) -> dict:
    settings = get_settings()
    url = active_database_url()
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
        "database": "sqlite" if url.startswith("sqlite") else "postgresql",
        "products": db.scalar(select(func.count(Product.id))) or 0,
        "analyses": db.scalar(select(func.count(FitAnalysis.id))) or 0,
        "vision": {
            "enabled": settings.vision_enabled,
            "mediapipe": mediapipe_available(),
            "mode": "mediapipe" if mediapipe_available() else "heuristic-fallback",
            "note": "Analise visual experimental.",
        },
        # Provador com foto: somente enabled/provider/available (sem caminhos, cache ou GPU).
        "tryon": tryon_service.tryon_status(provider, settings).model_dump(),
    }
