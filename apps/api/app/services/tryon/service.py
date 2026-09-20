"""Servico do provador com foto (virtual try-on).

Fluxo de `create_tryon`:
    consentimento -> analise -> tamanho (recomendado ou selecao valida) -> produto -> imagem flat
    -> validacao da foto (em memoria) -> cache -> provider.submit -> TryOnJob (somente metadados)

Regras invariaveis:
  * O tamanho/SKU vem do RecommendationEngine (analise persistida) ou de um tamanho existente
    escolhido pelo usuario. O provider (CatVTON) NUNCA determina tamanho, score ou confianca.
  * A foto nunca e persistida nem logada; os bytes sao descartados apos a chamada ao provider.
  * A imagem da peca vem de `Product.flat_image_url` (dados internos), nunca do usuario.
"""

from __future__ import annotations

import hashlib
import io
import logging
import time
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.config import Settings, get_settings
from ...models import FitAnalysis, TryOnJob
from ...schemas import TryOnJobOut, TryOnStatusOut
from ..errors import NotFoundError
from ..product_service import get_product
from .catvton_provider import CatVTONProvider
from .errors import (
    ConsentRequiredError,
    FlatImageUnavailableError,
    InvalidPhotoError,
    InvalidSizeError,
    PhotoTooLargeError,
    ProviderError,
    ProviderUnavailableError,
    ResultExpiredError,
    ResultNotFoundError,
    TryOnDisabledError,
    UnsupportedPhotoTypeError,
)
from .garment_images import load_garment_image
from .provider import ClothType, ProviderHealth, VirtualTryOnProvider

logger = logging.getLogger("veste.tryon")

ALLOWED_PHOTO_MIME = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_PHOTO_FORMATS = {"JPEG", "PNG", "WEBP"}
MIN_PHOTO_SIDE = 256
MAX_PHOTO_SIDE = 4096

# Categoria do catalogo -> regiao de mascara do provider (parametro de visualizacao, nao de tamanho).
CATEGORY_TO_CLOTH_TYPE: dict[str, ClothType] = {
    "tshirt": "upper",
    "shirt": "upper",
    "polo": "upper",
    "hoodie": "upper",
    "jacket": "upper",
    "dress": "overall",
    "pants": "lower",
    "shorts": "lower",
}

_HEALTH_CACHE_SECONDS = 10.0


# --------------------------------------------------------------------------- #
# Provider (injetavel nos testes)
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def _default_provider() -> VirtualTryOnProvider:
    settings = get_settings()
    if settings.tryon_provider != "catvton":
        raise RuntimeError(f"Provider de try-on desconhecido: {settings.tryon_provider}")
    return CatVTONProvider(
        settings.tryon_url,
        timeout_s=settings.tryon_timeout_s,
        health_timeout_s=settings.tryon_health_timeout_s,
    )


def get_provider() -> VirtualTryOnProvider:
    return _default_provider()


class _HealthCache:
    def __init__(self) -> None:
        self.value: ProviderHealth | None = None
        self.at = 0.0

    def get(self, provider: VirtualTryOnProvider) -> ProviderHealth:
        now = time.monotonic()
        if self.value is None or now - self.at > _HEALTH_CACHE_SECONDS:
            self.value = provider.health()
            self.at = now
        return self.value

    def reset(self) -> None:
        self.value = None
        self.at = 0.0


health_cache = _HealthCache()


def tryon_status(provider: VirtualTryOnProvider | None, settings: Settings | None = None) -> TryOnStatusOut:
    """Status resumido para GET /health: nada de caminhos, cache ou detalhes de GPU."""
    settings = settings or get_settings()
    if not settings.tryon_enabled or provider is None:
        return TryOnStatusOut(enabled=False, provider=settings.tryon_provider, available=False)
    health = health_cache.get(provider)
    return TryOnStatusOut(enabled=True, provider=provider.name, available=health.available)


# --------------------------------------------------------------------------- #
# Validacao da foto (em memoria)
# --------------------------------------------------------------------------- #
def validate_photo(data: bytes, *, content_type: str | None, filename: str | None, max_bytes: int) -> bytes:
    """Valida a foto e devolve bytes JPEG normalizados (EXIF aplicado, RGB). Nunca grava em disco."""
    if not data:
        raise InvalidPhotoError("Arquivo de foto vazio.")
    if len(data) > max_bytes:
        raise PhotoTooLargeError(f"A foto excede o tamanho máximo ({max_bytes // (1024 * 1024)} MB).")
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime and mime not in ALLOWED_PHOTO_MIME:
        raise UnsupportedPhotoTypeError("Formato não suportado. Envie JPG, PNG ou WebP.")
    if filename and "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
        if ext not in ALLOWED_PHOTO_EXT:
            raise UnsupportedPhotoTypeError("Extensão não suportada. Envie JPG, PNG ou WebP.")
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()
        fmt = (probe.format or "").upper()
        if fmt not in ALLOWED_PHOTO_FORMATS:
            raise UnsupportedPhotoTypeError("Formato não suportado. Envie JPG, PNG ou WebP.")
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.load()
    except UnsupportedPhotoTypeError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise InvalidPhotoError("O arquivo enviado não é uma imagem válida.") from exc
    w, h = image.size
    if min(w, h) < MIN_PHOTO_SIDE:
        raise InvalidPhotoError(f"A foto deve ter pelo menos {MIN_PHOTO_SIDE}px no menor lado.")
    if max(w, h) > MAX_PHOTO_SIDE:
        raise InvalidPhotoError(f"A foto deve ter no máximo {MAX_PHOTO_SIDE}px no maior lado.")
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=92)
    return out.getvalue()


# --------------------------------------------------------------------------- #
# Cache deterministico (somente digest composto; a foto nao e armazenada)
# --------------------------------------------------------------------------- #
def cache_key(photo: bytes, garment: bytes, sku: str, size: str, provider: str, model_version: str) -> str:
    photo_hash = hashlib.sha256(photo).hexdigest()
    garment_hash = hashlib.sha256(garment).hexdigest()
    composed = "|".join([photo_hash, garment_hash, sku, size, provider, model_version])
    return hashlib.sha256(composed.encode("utf-8")).hexdigest()


def _find_cached(db: Session, key: str, provider: VirtualTryOnProvider) -> TryOnJob | None:
    now = datetime.now(timezone.utc)
    stmt = (
        select(TryOnJob)
        .where(TryOnJob.cache_key == key, TryOnJob.status == "completed")
        .order_by(TryOnJob.created_at.desc())
    )
    for job in db.scalars(stmt).all():
        if _expired(job, now):
            _mark_expired(db, job)
            continue
        if job.result_ref and provider.result_exists(job.result_ref):
            return job
        # Resultado sumiu no provider (restart/TTL): registra como expirado e segue.
        _mark_expired(db, job)
    return None


# --------------------------------------------------------------------------- #
# Fluxo principal
# --------------------------------------------------------------------------- #
def create_tryon(
    db: Session,
    provider: VirtualTryOnProvider,
    *,
    analysis_id: str,
    photo: bytes,
    photo_content_type: str | None,
    photo_filename: str | None,
    consent_tryon: bool,
    size: str | None = None,
    settings: Settings | None = None,
) -> TryOnJobOut:
    settings = settings or get_settings()
    if not settings.tryon_enabled:
        raise TryOnDisabledError()
    if not consent_tryon:
        raise ConsentRequiredError()

    analysis = db.get(FitAnalysis, analysis_id)
    if analysis is None:
        raise NotFoundError("Análise não encontrada.")
    product = get_product(db, analysis.product_id)

    # Tamanho: recomendado pelo motor (padrao) ou selecao valida do usuario. Nunca do provider.
    target_size = (size or analysis.recommended_size).strip()
    sku_size = next((s for s in product.sizes if s.size_label.lower() == target_size.lower()), None)
    if sku_size is None:
        raise InvalidSizeError(f"Tamanho '{target_size}' não existe para este produto.")

    if not product.flat_image_url:
        raise FlatImageUnavailableError()
    garment = load_garment_image(product.flat_image_url, settings)
    cloth_type = CATEGORY_TO_CLOTH_TYPE.get(product.category, "upper")

    person = validate_photo(
        photo, content_type=photo_content_type, filename=photo_filename, max_bytes=settings.tryon_max_photo_bytes
    )
    del photo

    health = health_cache.get(provider)
    if not health.available:
        # Reconsulta sem cache antes de desistir (o provider pode ter acabado de subir).
        health_cache.reset()
        health = health_cache.get(provider)
        if not health.available:
            raise ProviderUnavailableError()

    key = cache_key(person, garment, sku_size.sku, sku_size.size_label, provider.name, health.model_version)
    cached = _find_cached(db, key, provider)
    if cached is not None:
        logger.info("tryon cache hit · job=%s · sku=%s · provider=%s", cached.id, cached.sku, provider.name)
        return _to_out(cached, analysis, cached=True)

    job = TryOnJob(
        analysis_id=analysis.id,
        product_id=product.id,
        sku=sku_size.sku,
        size=sku_size.size_label,
        cloth_type=cloth_type,
        provider=provider.name,
        model_version=health.model_version,
        status="processing",
        consent=True,
        cache_key=key,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    started = time.perf_counter()
    try:
        result = provider.submit(person, garment, cloth_type)
    except ProviderError as exc:
        job.status = "failed"
        job.error_code = exc.code
        job.duration_ms = int((time.perf_counter() - started) * 1000)
        db.commit()
        logger.warning(
            "tryon failed · job=%s · sku=%s · provider=%s · code=%s · %dms",
            job.id, job.sku, provider.name, exc.code, job.duration_ms,
        )
        raise
    finally:
        del person, garment

    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=settings.tryon_result_ttl_s)
    if result.expires_at is not None:
        provider_exp = result.expires_at if result.expires_at.tzinfo else result.expires_at.replace(tzinfo=timezone.utc)
        expires = min(expires, provider_exp)
    job.status = "completed"
    job.result_ref = result.result_ref
    job.duration_ms = int((time.perf_counter() - started) * 1000)
    job.expires_at = expires
    if result.model_version:
        job.model_version = result.model_version
    db.commit()
    db.refresh(job)
    logger.info(
        "tryon completed · job=%s · sku=%s · provider=%s · %dms", job.id, job.sku, provider.name, job.duration_ms
    )
    return _to_out(job, analysis)


def get_job(db: Session, job_id: str) -> TryOnJobOut:
    job = db.get(TryOnJob, job_id)
    if job is None:
        raise ResultNotFoundError()
    if job.status == "completed" and _expired(job, datetime.now(timezone.utc)):
        _mark_expired(db, job)
    analysis = db.get(FitAnalysis, job.analysis_id)
    return _to_out(job, analysis)


def get_job_image(db: Session, provider: VirtualTryOnProvider, job_id: str) -> bytes:
    job = db.get(TryOnJob, job_id)
    if job is None:
        raise ResultNotFoundError()
    if job.status == "expired":
        raise ResultExpiredError()
    if job.status != "completed" or not job.result_ref:
        raise ResultNotFoundError()
    if _expired(job, datetime.now(timezone.utc)):
        _mark_expired(db, job)
        raise ResultExpiredError()
    data = provider.fetch_result(job.result_ref)
    if data is None:
        _mark_expired(db, job)
        raise ResultExpiredError()
    return data


def delete_job_result(db: Session, provider: VirtualTryOnProvider, job_id: str) -> None:
    job = db.get(TryOnJob, job_id)
    if job is None:
        raise ResultNotFoundError()
    if job.result_ref:
        provider.delete_result(job.result_ref)
    job.result_ref = None
    job.status = "expired"
    db.commit()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _expired(job: TryOnJob, now: datetime) -> bool:
    if job.expires_at is None:
        return False
    exp = job.expires_at if job.expires_at.tzinfo else job.expires_at.replace(tzinfo=timezone.utc)
    return exp <= now


def _mark_expired(db: Session, job: TryOnJob) -> None:
    job.status = "expired"
    job.result_ref = None
    db.commit()


def _to_out(job: TryOnJob, analysis: FitAnalysis | None, *, cached: bool = False) -> TryOnJobOut:
    settings = get_settings()
    return TryOnJobOut(
        job_id=job.id,
        status=job.status,  # type: ignore[arg-type]
        analysis_id=job.analysis_id,
        product_id=job.product_id,
        sku=job.sku,
        size=job.size,
        recommended_size=analysis.recommended_size if analysis else job.size,
        provider=job.provider,
        cached=cached,
        image_url=f"{settings.api_prefix}/tryon/{job.id}/image" if job.status == "completed" else None,
        duration_ms=job.duration_ms,
        error_code=job.error_code,
        created_at=job.created_at,
        expires_at=job.expires_at,
    )


__all__ = [
    "CATEGORY_TO_CLOTH_TYPE",
    "cache_key",
    "create_tryon",
    "delete_job_result",
    "get_job",
    "get_job_image",
    "get_provider",
    "health_cache",
    "tryon_status",
    "validate_photo",
]
