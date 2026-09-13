from __future__ import annotations

from fastapi import APIRouter, Query, status

from ....api.deps import DbSession, OptionalCompany
from ....schemas import ProductCreate, ProductOut, ProductSummary, SizeOut
from ....services import product_service
from ....services.mappers import product_to_schema, product_to_summary, size_to_schema

router = APIRouter()


@router.get("", response_model=list[ProductSummary], summary="Listar catalogo")
def list_products(
    db: DbSession,
    category: str | None = Query(default=None, description="Filtrar por categoria"),
    company_id: str | None = Query(default=None),
) -> list[ProductSummary]:
    return [product_to_summary(p) for p in product_service.list_products(db, category, company_id)]


@router.get("/{product_id}", response_model=ProductOut, summary="Detalhe do produto (id ou slug)")
def get_product(product_id: str, db: DbSession) -> ProductOut:
    return product_to_schema(product_service.get_product(db, product_id))


@router.get("/{product_id}/sizes", response_model=list[SizeOut], summary="SKUs e medidas tecnicas por tamanho")
def get_sizes(product_id: str, db: DbSession) -> list[SizeOut]:
    product = product_service.get_product(db, product_id)
    return [size_to_schema(s) for s in product.sizes]


@router.post(
    "",
    response_model=ProductOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar produto com SKUs e medidas (Studio / B2B)",
)
def create_product(payload: ProductCreate, db: DbSession, company: OptionalCompany) -> ProductOut:
    company_id = company.id if company else None
    if company_id is None:
        # Sem chave: associa a empresa demo para manter a demonstracao coesa.
        demo = product_service.db_demo_company(db)
        company_id = demo.id if demo else None
    return product_to_schema(product_service.create_product(db, payload, company_id))
