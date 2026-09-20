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
        return _read_internal(url[len(INTERNAL_PREFIX) :])
    return _fetch_remote(url)


def _read_internal(name: str) -> bytes:
    """Le somente arquivos regulares sob `ASSETS_FLAT_DIR` (resolve + is_relative_to)."""
    root = ASSETS_FLAT_DIR.resolve()
    path = (ASSETS_FLAT_DIR / name).resolve()
    try:
        if not path.is_relative_to(root) or not path.is_file():
            raise FlatImageUnavailableError()
        data = path.read_bytes()
    except OSError:
        logger.warning("imagem flat interna ausente para o produto")
        raise FlatImageUnavailableError() from None
    if len(data) > _MAX_REMOTE_BYTES:
        raise FlatImageUnavailableError()
    return data


def _fetch_remote(url: str) -> bytes:
    """GET http(s) sem seguir redirects, com teto de bytes (nao carrega o corpo inteiro na memoria primeiro)."""
    try:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            with client.stream("GET", url) as response:
                if response.status_code != 200:
                    raise FlatImageUnavailableError()
                length = response.headers.get("content-length")
                if length is not None:
                    try:
                        if int(length) > _MAX_REMOTE_BYTES:
                            raise FlatImageUnavailableError()
                    except ValueError:
                        pass
                chunks: list[bytes] = []
                total = 0
                for chunk in response.iter_bytes(chunk_size=64 * 1024):
                    total += len(chunk)
                    if total > _MAX_REMOTE_BYTES:
                        raise FlatImageUnavailableError()
                    chunks.append(chunk)
                return b"".join(chunks)
    except FlatImageUnavailableError:
        raise
    except httpx.HTTPError as exc:
        logger.warning("falha ao obter imagem flat remota: %s", type(exc).__name__)
        raise FlatImageUnavailableError() from exc


def _classify(url: str, settings: Settings) -> str | None:
    if not url:
        return None
    if url.startswith(INTERNAL_PREFIX):
        name = url[len(INTERNAL_PREFIX):]
        if _SAFE_NAME.match(name) and "/" not in name and "\\" not in name and ".." not in name:
            return "internal"
        return None
    parsed = urlparse(url)
    # userinfo (user:pass@host) e schemes nao-http sao rejeitados mesmo com host na allowlist.
    if parsed.username is not None or parsed.password is not None:
        return None
    if parsed.scheme in ("http", "https") and parsed.hostname:
        allowed = {h.lower() for h in settings.tryon_flat_image_allowed_hosts}
        if parsed.hostname.lower() in allowed:
            return "remote"
    return None
