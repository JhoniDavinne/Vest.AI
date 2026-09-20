"""Validacao e normalizacao de imagens de entrada.

Regras:
  * MIME e extensao permitidos (JPEG, PNG, WebP);
  * arquivo nao vazio e abaixo do limite;
  * decodificacao real via Pillow (verify + reopen), orientacao EXIF normalizada;
  * dimensoes minimas/maximas;
  * o nome original NUNCA e usado como caminho e nao e registrado em log.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


@dataclass
class ImageValidationError(Exception):
    code: str
    message: str
    status_code: int = 400

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.message}"


def _extension(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def validate_and_load(
    data: bytes,
    *,
    field: str,
    content_type: str | None,
    filename: str | None,
    max_bytes: int,
    min_side: int,
    max_side: int,
) -> Image.Image:
    """Valida bytes de upload e devolve uma PIL.Image RGB com EXIF normalizado."""
    if not data:
        raise ImageValidationError("empty_file", f"Arquivo '{field}' vazio.")
    if len(data) > max_bytes:
        raise ImageValidationError(
            "file_too_large", f"Arquivo '{field}' excede {max_bytes // (1024 * 1024)} MB.", status_code=413
        )
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime and mime not in ALLOWED_MIME:
        raise ImageValidationError("unsupported_media_type", f"Tipo '{mime}' nao suportado em '{field}'.", status_code=415)
    ext = _extension(filename)
    if ext and ext not in ALLOWED_EXT:
        raise ImageValidationError("unsupported_extension", f"Extensao nao suportada em '{field}'.", status_code=415)

    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise ImageValidationError("invalid_image", f"Arquivo '{field}' nao e uma imagem valida.") from exc

    fmt = (probe.format or "").upper()
    if fmt not in ALLOWED_FORMATS:
        raise ImageValidationError("unsupported_format", f"Formato '{fmt or 'desconhecido'}' nao suportado em '{field}'.", status_code=415)

    try:
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")
        image.load()
    except (OSError, ValueError) as exc:
        raise ImageValidationError("decode_error", f"Falha ao decodificar '{field}'.") from exc

    w, h = image.size
    if min(w, h) < min_side:
        raise ImageValidationError("image_too_small", f"'{field}' deve ter pelo menos {min_side}px no menor lado.")
    if max(w, h) > max_side:
        raise ImageValidationError("image_too_large", f"'{field}' deve ter no maximo {max_side}px no maior lado.")
    return image
