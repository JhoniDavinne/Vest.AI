from __future__ import annotations

from fastapi import APIRouter, Query

from ....api.deps import DbSession
from ....schemas import MetricsOut
from ....services import metrics_service

router = APIRouter()


@router.get("/dashboard", response_model=MetricsOut, summary="Indicadores (dados simulados para demonstracao)")
def dashboard(db: DbSession, company_id: str | None = Query(default=None)) -> MetricsOut:
    return metrics_service.compute_metrics(db, company_id)
