from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import Company
from ..services.company_service import authenticate_key, optional_company_from_key

DbSession = Annotated[Session, Depends(get_db)]


def optional_company(
    db: DbSession, x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None
) -> Company | None:
    """Empresa associada a chave, se enviada. Chamadas sem chave sao permitidas (canal web)."""
    return optional_company_from_key(db, x_api_key)


def required_company(
    db: DbSession, x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None
) -> Company:
    return authenticate_key(db, x_api_key).company


OptionalCompany = Annotated[Company | None, Depends(optional_company)]
RequiredCompany = Annotated[Company, Depends(required_company)]
