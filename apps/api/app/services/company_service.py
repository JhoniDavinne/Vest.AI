from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Company, FitAnalysis, IntegrationKey, Product, SKUSize
from ..schemas import CompanyDashboard, CompanyOut, IntegrationKeyOut
from .errors import NotFoundError, UnauthorizedError


def get_company(db: Session, id_or_slug: str) -> Company:
    stmt = select(Company).where((Company.id == id_or_slug) | (Company.slug == id_or_slug))
    company = db.scalars(stmt).first()
    if company is None:
        raise NotFoundError(f"Empresa '{id_or_slug}' nao encontrada.")
    return company


def authenticate_key(db: Session, key: str | None) -> IntegrationKey:
    if not key:
        raise UnauthorizedError("Informe o header X-API-Key.")
    stmt = select(IntegrationKey).where(IntegrationKey.key == key, IntegrationKey.active.is_(True))
    found = db.scalars(stmt).first()
    if found is None:
        raise UnauthorizedError("Chave de integracao invalida ou inativa.")
    found.usage_count = (found.usage_count or 0) + 1
    found.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return found


def optional_company_from_key(db: Session, key: str | None) -> Company | None:
    if not key:
        return None
    try:
        return authenticate_key(db, key).company
    except UnauthorizedError:
        return None


def dashboard(db: Session, company: Company) -> CompanyDashboard:
    products_count = db.scalar(select(func.count(Product.id)).where(Product.company_id == company.id)) or 0
    skus_count = (
        db.scalar(
            select(func.count(SKUSize.id)).join(Product).where(Product.company_id == company.id)
        )
        or 0
    )
    analyses_count = (
        db.scalar(select(func.count(FitAnalysis.id)).where(FitAnalysis.company_id == company.id)) or 0
    )
    api_calls = (
        db.scalar(
            select(func.count(FitAnalysis.id)).where(
                FitAnalysis.company_id == company.id, FitAnalysis.channel == "api"
            )
        )
        or 0
    )
    widget_calls = (
        db.scalar(
            select(func.count(FitAnalysis.id)).where(
                FitAnalysis.company_id == company.id, FitAnalysis.channel == "widget"
            )
        )
        or 0
    )
    return CompanyDashboard(
        company=CompanyOut.model_validate(company),
        integration_keys=[IntegrationKeyOut.model_validate(k) for k in company.integration_keys],
        products_count=products_count,
        skus_count=skus_count,
        analyses_count=analyses_count,
        api_calls_count=api_calls,
        widget_calls_count=widget_calls,
    )
