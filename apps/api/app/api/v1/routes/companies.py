from __future__ import annotations

from fastapi import APIRouter

from ....api.deps import DbSession, RequiredCompany
from ....schemas import CompanyDashboard, CompanyOut
from ....services import company_service

router = APIRouter()


@router.get("/me", response_model=CompanyDashboard, summary="Dashboard da empresa autenticada (X-API-Key)")
def my_company(db: DbSession, company: RequiredCompany) -> CompanyDashboard:
    return company_service.dashboard(db, company)


@router.get("/{company_id}", response_model=CompanyOut, summary="Dados publicos da empresa (id ou slug)")
def get_company(company_id: str, db: DbSession) -> CompanyOut:
    return CompanyOut.model_validate(company_service.get_company(db, company_id))


@router.get("/{company_id}/dashboard", response_model=CompanyDashboard, summary="Dashboard da empresa (demo)")
def company_dashboard(company_id: str, db: DbSession) -> CompanyDashboard:
    return company_service.dashboard(db, company_service.get_company(db, company_id))
