from __future__ import annotations

import re
import unicodedata

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..models import Company, GarmentMeasurement, Product, SKUSize
from ..schemas import ProductCreate
from .errors import NotFoundError, ValidationError

DEMO_COMPANY_SLUG = "loja-parceira"


def db_demo_company(db: Session) -> Company | None:
    return db.scalars(select(Company).where(Company.slug == DEMO_COMPANY_SLUG)).first()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return normalized or "produto"


def _base_query():
    return select(Product).options(
        selectinload(Product.sizes).selectinload(SKUSize.measurement), selectinload(Product.company)
    )


def list_products(db: Session, category: str | None = None, company_id: str | None = None) -> list[Product]:
    stmt = _base_query().where(Product.active.is_(True))
    if category:
        stmt = stmt.where(Product.category == category)
    if company_id:
        stmt = stmt.where(Product.company_id == company_id)
    stmt = stmt.order_by(Product.created_at.asc())
    return list(db.scalars(stmt).all())


def get_product(db: Session, id_or_slug: str) -> Product:
    stmt = _base_query().where(or_(Product.id == id_or_slug, Product.slug == id_or_slug))
    product = db.scalars(stmt).first()
    if product is None:
        raise NotFoundError(f"Produto '{id_or_slug}' nao encontrado.")
    return product


def get_sku(db: Session, sku: str) -> SKUSize:
    stmt = (
        select(SKUSize)
        .options(
            selectinload(SKUSize.measurement),
            selectinload(SKUSize.product).selectinload(Product.sizes).selectinload(SKUSize.measurement),
            selectinload(SKUSize.product).selectinload(Product.company),
        )
        .where(SKUSize.sku == sku)
    )
    found = db.scalars(stmt).first()
    if found is None:
        raise NotFoundError(f"SKU '{sku}' nao encontrado.")
    return found


def create_product(db: Session, payload: ProductCreate, company_id: str | None) -> Product:
    slug = payload.slug or slugify(f"{payload.brand}-{payload.name}")
    if db.scalars(select(Product).where(Product.slug == slug)).first():
        raise ValidationError(f"Ja existe um produto com o slug '{slug}'.")

    product = Product(
        company_id=company_id,
        slug=slug,
        name=payload.name,
        brand=payload.brand,
        category=payload.category,
        audience=payload.audience,
        description=payload.description,
        image_url=payload.image_url or f"/products/placeholder-{payload.category}.svg",
        color=payload.color,
        price_cents=payload.price_cents,
        modeling=payload.modeling,
        fabric=payload.fabric,
        composition=payload.composition,
        elasticity_pct=payload.elasticity_pct,
        care=payload.care,
    )
    prefix = slugify(payload.name).upper().replace("-", "")[:12] or "PROD"
    seen: set[str] = set()
    for index, size in enumerate(payload.sizes):
        sku_code = size.sku or f"{prefix}-{slug[-3:].upper()}-{size.size_label}"
        if sku_code in seen or db.scalars(select(SKUSize).where(SKUSize.sku == sku_code)).first():
            raise ValidationError(f"SKU duplicado: {sku_code}")
        seen.add(sku_code)
        sku = SKUSize(sku=sku_code, size_label=size.size_label, sort_order=index, stock=size.stock)
        sku.measurement = GarmentMeasurement(**size.measurements.model_dump())
        product.sizes.append(sku)

    db.add(product)
    db.commit()
    return get_product(db, product.id)
