"""Entidades do MVP.

Consumer:  User, UserMeasurement, PhotoAnalysis
Product:   Product, SKUSize, GarmentMeasurement
Recomend.: FitAnalysis, Feedback
B2B:       Company, IntegrationKey
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IdMixin, TimestampMixin


# --------------------------------------------------------------------------- #
# B2B
# --------------------------------------------------------------------------- #
class Company(IdMixin, TimestampMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    segment: Mapped[str] = mapped_column(String(80), default="moda")
    website: Mapped[str | None] = mapped_column(String(200))
    plan: Mapped[str] = mapped_column(String(40), default="starter")

    products: Mapped[list["Product"]] = relationship(back_populates="company")
    integration_keys: Mapped[list["IntegrationKey"]] = relationship(back_populates="company")


class IntegrationKey(IdMixin, TimestampMixin, Base):
    __tablename__ = "integration_keys"

    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(80), default="default")
    key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column()
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

    company: Mapped[Company] = relationship(back_populates="integration_keys")


# --------------------------------------------------------------------------- #
# Consumer
# --------------------------------------------------------------------------- #
class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(160))
    fit_preference: Mapped[str] = mapped_column(String(16), default="regular")
    photo_consent: Mapped[bool] = mapped_column(Boolean, default=False)

    measurements: Mapped[list["UserMeasurement"]] = relationship(
        back_populates="user", order_by="desc(UserMeasurement.created_at)"
    )
    photo_analyses: Mapped[list["PhotoAnalysis"]] = relationship(
        back_populates="user", order_by="desc(PhotoAnalysis.created_at)"
    )


class UserMeasurement(IdMixin, TimestampMixin, Base):
    __tablename__ = "user_measurements"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    height: Mapped[float | None] = mapped_column(Float)
    weight: Mapped[float | None] = mapped_column(Float)
    chest: Mapped[float | None] = mapped_column(Float)
    waist: Mapped[float | None] = mapped_column(Float)
    hip: Mapped[float | None] = mapped_column(Float)
    shoulder: Mapped[float | None] = mapped_column(Float)

    user: Mapped[User] = relationship(back_populates="measurements")


class PhotoAnalysis(IdMixin, TimestampMixin, Base):
    """Somente proporcoes derivadas sao persistidas; a imagem nunca e armazenada."""

    __tablename__ = "photo_analyses"

    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="completed")  # completed | unavailable
    source: Mapped[str] = mapped_column(String(24), default="unavailable")  # mediapipe | heuristic | unavailable
    quality: Mapped[float] = mapped_column(Float, default=0.0)
    shoulder_hip_ratio: Mapped[float | None] = mapped_column(Float)
    waist_hip_ratio: Mapped[float | None] = mapped_column(Float)
    torso_leg_ratio: Mapped[float | None] = mapped_column(Float)
    image_width: Mapped[int | None] = mapped_column(Integer)
    image_height: Mapped[int | None] = mapped_column(Integer)
    message: Mapped[str] = mapped_column(Text, default="")
    consent: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User | None] = relationship(back_populates="photo_analyses")


# --------------------------------------------------------------------------- #
# Product
# --------------------------------------------------------------------------- #
class Product(IdMixin, TimestampMixin, Base):
    __tablename__ = "products"

    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id"), index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    brand: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    audience: Mapped[str] = mapped_column(String(24), default="unissex")
    description: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(String(400), default="")
    video_url: Mapped[str] = mapped_column(String(400), default="")
    color: Mapped[str] = mapped_column(String(40), default="")
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    modeling: Mapped[str] = mapped_column(String(24), nullable=False)
    fabric: Mapped[str] = mapped_column(String(120), default="")
    composition: Mapped[str] = mapped_column(String(200), default="")
    elasticity_pct: Mapped[float] = mapped_column(Float, default=3.0)
    care: Mapped[str] = mapped_column(String(200), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    company: Mapped[Company | None] = relationship(back_populates="products")
    sizes: Mapped[list["SKUSize"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="SKUSize.sort_order"
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.sort_order"
    )


class ProductImage(IdMixin, Base):
    __tablename__ = "product_images"

    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(400), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="images")


class SKUSize(IdMixin, TimestampMixin, Base):
    __tablename__ = "sku_sizes"
    __table_args__ = (UniqueConstraint("product_id", "size_label", name="uq_product_size"),)

    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    size_label: Mapped[str] = mapped_column(String(12), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    stock: Mapped[int] = mapped_column(Integer, default=10)

    product: Mapped[Product] = relationship(back_populates="sizes")
    measurement: Mapped["GarmentMeasurement | None"] = relationship(
        back_populates="sku_size", uselist=False, cascade="all, delete-orphan"
    )


class GarmentMeasurement(IdMixin, Base):
    """Medidas tecnicas da peca (cm). Circunferencias para peito/cintura/quadril."""

    __tablename__ = "garment_measurements"

    sku_size_id: Mapped[str] = mapped_column(ForeignKey("sku_sizes.id"), unique=True, nullable=False)
    chest: Mapped[float | None] = mapped_column(Float)
    waist: Mapped[float | None] = mapped_column(Float)
    hip: Mapped[float | None] = mapped_column(Float)
    shoulder: Mapped[float | None] = mapped_column(Float)
    length: Mapped[float | None] = mapped_column(Float)
    sleeve: Mapped[float | None] = mapped_column(Float)
    width: Mapped[float | None] = mapped_column(Float)

    sku_size: Mapped[SKUSize] = relationship(back_populates="measurement")


# --------------------------------------------------------------------------- #
# Recommendation
# --------------------------------------------------------------------------- #
class FitAnalysis(IdMixin, TimestampMixin, Base):
    __tablename__ = "fit_analyses"

    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    evaluated_sku_id: Mapped[str] = mapped_column(ForeignKey("sku_sizes.id"), nullable=False)
    recommended_sku_id: Mapped[str] = mapped_column(ForeignKey("sku_sizes.id"), nullable=False)
    photo_analysis_id: Mapped[str | None] = mapped_column(ForeignKey("photo_analyses.id"))

    evaluated_size: Mapped[str] = mapped_column(String(12), nullable=False)
    recommended_size: Mapped[str] = mapped_column(String(12), nullable=False)
    fit_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[str] = mapped_column(String(12), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    fit_preference: Mapped[str] = mapped_column(String(16), default="regular")
    regional_analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    components: Mapped[dict] = mapped_column(JSON, default=dict)
    comparison: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(Text, default="")
    channel: Mapped[str] = mapped_column(String(16), default="web")  # web | api | widget | seed
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)

    feedback: Mapped["Feedback | None"] = relationship(back_populates="analysis", uselist=False)


class Feedback(IdMixin, TimestampMixin, Base):
    __tablename__ = "feedbacks"

    fit_analysis_id: Mapped[str] = mapped_column(ForeignKey("fit_analyses.id"), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    purchased_size: Mapped[str | None] = mapped_column(String(12))
    fit_rating: Mapped[str] = mapped_column(String(16), nullable=False)  # too_tight | good | too_loose
    followed_recommendation: Mapped[bool] = mapped_column(Boolean, default=True)
    returned: Mapped[bool] = mapped_column(Boolean, default=False)
    return_reason: Mapped[str | None] = mapped_column(String(120))
    comment: Mapped[str | None] = mapped_column(Text)

    analysis: Mapped[FitAnalysis] = relationship(back_populates="feedback")
