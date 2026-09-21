"""Conversao entre entidades do banco e tipos do motor / schemas HTTP."""

from __future__ import annotations

from ..engine import BodyProfile, Category, GarmentSize, GarmentSpec, Modeling, VisualProportions
from ..models import PhotoAnalysis, Product, SKUSize, UserMeasurement
from .product_service import product_image_urls
from ..schemas import (
    GarmentMeasurementIn,
    MeasurementsIn,
    MeasurementsOut,
    PhotoAnalysisOut,
    ProductOut,
    ProductSummary,
    SizeOut,
    UserOut,
)


def product_to_spec(product: Product) -> GarmentSpec:
    sizes: list[GarmentSize] = []
    for sku in product.sizes:
        m = sku.measurement
        sizes.append(
            GarmentSize(
                sku=sku.sku,
                label=sku.size_label,
                sort_order=sku.sort_order,
                chest=m.chest if m else None,
                waist=m.waist if m else None,
                hip=m.hip if m else None,
                shoulder=m.shoulder if m else None,
                length=m.length if m else None,
                sleeve=m.sleeve if m else None,
                width=m.width if m else None,
            )
        )
    return GarmentSpec(
        product_id=product.id,
        name=product.name,
        category=Category(product.category),
        modeling=Modeling(product.modeling),
        elasticity_pct=product.elasticity_pct,
        fabric=product.fabric or product.composition,
        sizes=tuple(sizes),
    )


def measurements_to_body(m: UserMeasurement | MeasurementsIn | None) -> BodyProfile:
    if m is None:
        return BodyProfile()
    return BodyProfile(
        height=m.height,
        weight=m.weight,
        chest=m.chest,
        waist=m.waist,
        hip=m.hip,
        shoulder=m.shoulder,
    )


def photo_to_visual(photo: PhotoAnalysis | None) -> VisualProportions | None:
    if photo is None or photo.status != "completed":
        return None
    return VisualProportions(
        shoulder_hip_ratio=photo.shoulder_hip_ratio,
        waist_hip_ratio=photo.waist_hip_ratio,
        torso_leg_ratio=photo.torso_leg_ratio,
        quality=photo.quality,
        source=photo.source,
    )


def size_to_schema(sku: SKUSize) -> SizeOut:
    m = sku.measurement
    return SizeOut(
        id=sku.id,
        sku=sku.sku,
        size_label=sku.size_label,
        sort_order=sku.sort_order,
        stock=sku.stock,
        measurements=GarmentMeasurementIn(
            chest=m.chest if m else None,
            waist=m.waist if m else None,
            hip=m.hip if m else None,
            shoulder=m.shoulder if m else None,
            length=m.length if m else None,
            sleeve=m.sleeve if m else None,
            width=m.width if m else None,
        ),
    )


def product_to_summary(product: Product) -> ProductSummary:
    images = product_image_urls(product)
    return ProductSummary(
        id=product.id,
        slug=product.slug,
        name=product.name,
        brand=product.brand,
        category=product.category,
        audience=product.audience,
        description=product.description,
        image_url=images[0] if images else product.image_url,
        images=images,
        video_url=product.video_url or "",
        color=product.color,
        price_cents=product.price_cents,
        modeling=product.modeling,
        fabric=product.fabric,
        composition=product.composition,
        elasticity_pct=product.elasticity_pct,
        company_id=product.company_id,
        company_name=product.company.name if product.company else None,
        available_sizes=[s.size_label for s in product.sizes],
    )


def product_to_schema(product: Product) -> ProductOut:
    summary = product_to_summary(product)
    return ProductOut(
        **summary.model_dump(),
        care=product.care,
        sizes=[size_to_schema(s) for s in product.sizes],
        created_at=product.created_at,
    )


def user_to_schema(user, measurement: UserMeasurement | None, photo: PhotoAnalysis | None) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        fit_preference=user.fit_preference,
        photo_consent=user.photo_consent,
        created_at=user.created_at,
        measurements=MeasurementsOut.model_validate(measurement) if measurement else None,
        photo_analysis=PhotoAnalysisOut.model_validate(photo) if photo else None,
    )
