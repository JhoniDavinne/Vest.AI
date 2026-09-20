"""Resolucao segura da imagem flat da peca (`Product.flat_image_url`).

A imagem da roupa vem SEMPRE dos dados internos do produto — nunca de uma URL enviada pelo
usuario. Origens aceitas:
  * caminho interno `/assets/flat/<arquivo>` -> app/assets/flat (sem path traversal);
  * URL http(s) cujo host esteja em `VESTE_TRYON_FLAT_IMAGE_ALLOWED_HOSTS`.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from urllib.parse import urlparse

import httpx

from ...core.config import Settings
from .errors import FlatImageUnavailableError

logger = logging.getLogger("veste.tryon.garment")

ASSETS_FLAT_DIR = Path(__file__).resolve().parents[2] / "assets" / "flat"
INTERNAL_PREFIX = "/assets/flat/"
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(jpg|jpeg|png|webp)$", re.IGNORECASE)
_MAX_REMOTE_BYTES = 8 * 1024 * 1024


def is_valid_flat_image_url(url: str, settings: Settings) -> bool:
    return _classify(url, settings) is not None


def load_garment_image(url: str, settings: Settings) -> bytes:
    """Devolve os bytes da imagem flat ou lanca `FlatImageUnavailableError`."""
    kind = _classify(url, settings)
    if kind is None:
        raise FlatImageUnavailableError()
    if kind == "internal":
        path = ASSETS_FLAT_DIR / url[len(INTERNAL_PREFIX):]
        try:
            return path.read_bytes()
        except OSError:
            logger.warning("imagem flat interna ausente para o produto")
            raise FlatImageUnavailableError() from None
    try:
        response = httpx.get(url, timeout=10.0, follow_redirects=False)
    except httpx.HTTPError as exc:
        logger.warning("falha ao obter imagem flat remota: %s", type(exc).__name__)
        raise FlatImageUnavailableError() from exc
    if response.status_code != 200 or len(response.content) > _MAX_REMOTE_BYTES:
        raise FlatImageUnavailableError()
    return response.content


def _classify(url: str, settings: Settings) -> str | None:
    if not url:
        return None
    if url.startswith(INTERNAL_PREFIX):
        name = url[len(INTERNAL_PREFIX):]
        if _SAFE_NAME.match(name) and "/" not in name and "\\" not in name and ".." not in name:
            return "internal"
        return None
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https") and parsed.hostname:
        allowed = {h.lower() for h in settings.tryon_flat_image_allowed_hosts}
        if parsed.hostname.lower() in allowed:
            return "remote"
    return None
