from __future__ import annotations

import re
import unicodedata

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..models import Company, GarmentMeasurement, Product, ProductImage, SKUSize
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
        selectinload(Product.sizes).selectinload(SKUSize.measurement),
        selectinload(Product.company),
        selectinload(Product.images),
    )


def product_image_urls(product: Product) -> list[str]:
    if product.images:
        return [img.url for img in sorted(product.images, key=lambda row: row.sort_order)]
    if product.image_url:
        return [product.image_url]
    return []


def _normalize_image_urls(images: list[str] | None, image_url: str, category: str) -> list[str]:
    urls = [url.strip() for url in (images or []) if url and url.strip()]
    if not urls and image_url.strip():
        urls = [image_url.strip()]
    if not urls:
        urls = [f"/products/placeholder-{category}.svg"]
    return urls


def _set_product_images(product: Product, urls: list[str]) -> None:
    product.image_url = urls[0]
    product.images.clear()
    for index, url in enumerate(urls):
        product.images.append(ProductImage(url=url, sort_order=index))


def list_products(db: Session, category: str | None = None, company_id: str | None = None) -> list[Product]:
    stmt = _base_query().where(Product.active.is_(True))
    if category:
        stmt = stmt.where(Product.category == category)
    if company_id:
        stmt = stmt.where(Product.company_id == company_id)
    stmt = stmt.order_by(Product.created_at.asc())
    return list(db.scalars(stmt).all())


def get_product(db: Session, id_or_slug: str, *, active_only: bool = True) -> Product:
    stmt = _base_query().where(or_(Product.id == id_or_slug, Product.slug == id_or_slug))
    product = db.scalars(stmt).first()
    if product is None or (active_only and not product.active):
        raise NotFoundError(f"Produto '{id_or_slug}' nao encontrado.")
    return product


def get_sku(db: Session, sku: str) -> SKUSize:
    stmt = (
        select(SKUSize)
        .options(
            selectinload(SKUSize.measurement),
            selectinload(SKUSize.product).selectinload(Product.sizes).selectinload(SKUSize.measurement),
            selectinload(SKUSize.product).selectinload(Product.company),
            selectinload(SKUSize.product).selectinload(Product.images),
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

    image_urls = _normalize_image_urls(payload.images, payload.image_url, payload.category)
    product = Product(
        company_id=company_id,
        slug=slug,
        name=payload.name,
        brand=payload.brand,
        category=payload.category,
        audience=payload.audience,
        description=payload.description,
        image_url=image_urls[0],
        color=payload.color,
        price_cents=payload.price_cents,
        modeling=payload.modeling,
        fabric=payload.fabric,
        composition=payload.composition,
        elasticity_pct=payload.elasticity_pct,
        care=payload.care,
    )
    _set_product_images(product, image_urls)

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


def update_product_images(db: Session, id_or_slug: str, images: list[str]) -> Product:
    product = get_product(db, id_or_slug)
    urls = _normalize_image_urls(images, "", product.category)
    _set_product_images(product, urls)
    db.commit()
    return get_product(db, product.id)


def update_product_image(db: Session, id_or_slug: str, image_url: str) -> Product:
    return update_product_images(db, id_or_slug, [image_url])


def delete_product(db: Session, id_or_slug: str) -> None:
    product = get_product(db, id_or_slug)
    product.active = False
    db.commit()
