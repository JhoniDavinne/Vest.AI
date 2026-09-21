"""Persistencia de imagens de produto."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from ..core.config import get_settings
from .errors import ValidationError

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES = 5 * 1024 * 1024


def product_uploads_dir() -> Path:
    """Diretorio gravavel para uploads (monorepo local ou /app/data em producao)."""
    settings = get_settings()
    if settings.product_upload_dir:
        base = Path(settings.product_upload_dir)
    else:
        api_root = Path(__file__).resolve().parents[2]
        web_products = api_root.parent / "web" / "public" / "products" / "uploads"
        if (api_root.parent / "web").is_dir():
            base = web_products
        else:
            base = api_root / "data" / "products" / "uploads"
    base.mkdir(parents=True, exist_ok=True)
    return base


def public_image_url(relative_path: str, base_url: str) -> str:
    if relative_path.startswith("http://") or relative_path.startswith("https://"):
        return relative_path
    return f"{base_url.rstrip('/')}{relative_path}"


def _extension(filename: str | None, content_type: str | None) -> str:
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            return ext
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    if content_type and content_type in mapping:
        return mapping[content_type]
    raise ValidationError("Formato nao suportado. Use JPG, PNG ou WebP.")


def save_product_image(
    data: bytes,
    filename: str | None,
    content_type: str | None,
    *,
    base_url: str | None = None,
) -> str:
    if not data:
        raise ValidationError("Arquivo vazio.")
    if len(data) > MAX_BYTES:
        raise ValidationError("Imagem excede o tamanho maximo permitido (5 MB).")

    ext = _extension(filename, content_type)
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(filename or "produto").stem).strip("-").lower()[:40]
    name = f"{safe_stem or 'produto'}-{uuid.uuid4().hex[:10]}{ext}"
    path = product_uploads_dir() / name
    path.write_bytes(data)
    relative = f"/products/uploads/{name}"
    if base_url:
        return public_image_url(relative, base_url)
    return relative
