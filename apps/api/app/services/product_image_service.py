"""Persistencia de imagens de produto no diretorio publico do front-end."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from .errors import ValidationError

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES = 5 * 1024 * 1024


def product_images_dir() -> Path:
    """apps/web/public/products — servido pelo Next.js em /products/*."""
    root = Path(__file__).resolve().parents[4]
    target = root / "apps" / "web" / "public" / "products"
    target.mkdir(parents=True, exist_ok=True)
    (target / "uploads").mkdir(parents=True, exist_ok=True)
    return target


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


def save_product_image(data: bytes, filename: str | None, content_type: str | None) -> str:
    if not data:
        raise ValidationError("Arquivo vazio.")
    if len(data) > MAX_BYTES:
        raise ValidationError("Imagem excede o tamanho maximo permitido (5 MB).")

    ext = _extension(filename, content_type)
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(filename or "produto").stem).strip("-").lower()[:40]
    name = f"{safe_stem or 'produto'}-{uuid.uuid4().hex[:10]}{ext}"
    path = product_images_dir() / "uploads" / name
    path.write_bytes(data)
    return f"/products/uploads/{name}"
