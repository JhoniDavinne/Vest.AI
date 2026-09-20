"""CatVTONProvider — adaptador HTTP para o servico isolado apps/tryon (CatVTON local).

Contrato consumido (apps/tryon, Etapa 5):
    GET  /health              -> { status, modelLoaded, busy, precision, gpu, ... }
    POST /try-on              -> multipart person, garment, cloth_type -> { resultId, processingTimeMs, expiresAt }
    GET  /results/{resultId}  -> PNG
    DELETE /results/{resultId}

Traducao de erros (codigo do provider -> erro controlado da API):
    conexao recusada / DNS      -> ProviderUnavailableError
    timeout                     -> ProviderTimeoutError
    429 busy                    -> ProviderBusyError (Retry-After)
    503 cuda_out_of_memory      -> ProviderOutOfMemoryError
    503 model_not_loaded / cuda_unavailable -> ProviderUnavailableError
    400/413/415/422 (imagem)    -> ProviderRejectedInputError
    outros                      -> ProviderError
Logs: apenas codigos, status e tempos — nunca bytes, base64 ou nomes de arquivo.
"""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from .errors import (
    ProviderBusyError,
    ProviderError,
    ProviderOutOfMemoryError,
    ProviderRejectedInputError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from .provider import ClothType, ProviderHealth, ProviderResult

logger = logging.getLogger("veste.tryon.catvton")

_UNAVAILABLE_CODES = {"model_not_loaded", "cuda_unavailable"}
_INPUT_CODES = {
    "empty_file",
    "invalid_image",
    "image_too_small",
    "image_too_large",
    "file_too_large",
    "unsupported_media_type",
    "unsupported_extension",
    "unsupported_format",
    "decode_error",
    "preprocessing_error",
}


class CatVTONProvider:
    name = "catvton"

    def __init__(
        self,
        base_url: str,
        *,
        timeout_s: float = 120.0,
        health_timeout_s: float = 2.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self.health_timeout_s = health_timeout_s
        self._client = httpx.Client(base_url=self.base_url, transport=transport)

    # ------------------------------------------------------------------ health
    def health(self) -> ProviderHealth:
        try:
            response = self._client.get("/health", timeout=self.health_timeout_s)
        except httpx.HTTPError as exc:
            return ProviderHealth(available=False, detail=type(exc).__name__)
        if response.status_code != 200:
            return ProviderHealth(available=False, detail=f"http_{response.status_code}")
        try:
            body = response.json()
        except ValueError:
            return ProviderHealth(available=False, detail="invalid_json")
        loaded = bool(body.get("modelLoaded")) and body.get("status") == "ok"
        return ProviderHealth(
            available=loaded,
            model_version=_model_version(body),
            busy=bool(body.get("busy")),
            detail="" if loaded else str(body.get("status", "unknown")),
        )

    # ------------------------------------------------------------------ submit
    def submit(self, person: bytes, garment: bytes, cloth_type: ClothType) -> ProviderResult:
        files = {
            # Nomes fixos: o nome original do upload nunca e propagado.
            "person": ("person.jpg", person, "image/jpeg"),
            "garment": ("garment.jpg", garment, "image/jpeg"),
        }
        try:
            response = self._client.post(
                "/try-on", files=files, data={"cloth_type": cloth_type}, timeout=self.timeout_s
            )
        except httpx.TimeoutException as exc:
            logger.warning("provider timeout apos %.0fs (%s)", self.timeout_s, type(exc).__name__)
            raise ProviderTimeoutError() from exc
        except httpx.HTTPError as exc:
            logger.warning("provider indisponivel: %s", type(exc).__name__)
            raise ProviderUnavailableError() from exc

        if response.status_code != 200:
            raise self._translate(response)

        body = response.json()
        result_ref = str(body.get("resultId") or "")
        if body.get("status") != "completed" or not result_ref:
            logger.error("provider respondeu 200 sem resultId/completed")
            raise ProviderError()
        return ProviderResult(
            result_ref=result_ref,
            processing_ms=int(body.get("processingTimeMs") or 0),
            model_version=_model_version(body),
            expires_at=_parse_dt(body.get("expiresAt")),
        )

    # ----------------------------------------------------------------- results
    def result_exists(self, result_ref: str) -> bool:
        if not _safe_ref(result_ref):
            return False
        try:
            with self._client.stream("GET", f"/results/{result_ref}", timeout=self.health_timeout_s) as r:
                return r.status_code == 200
        except httpx.HTTPError:
            return False

    def fetch_result(self, result_ref: str) -> bytes | None:
        if not _safe_ref(result_ref):
            return None
        try:
            response = self._client.get(f"/results/{result_ref}", timeout=self.health_timeout_s * 5)
        except httpx.HTTPError as exc:
            logger.warning("falha ao buscar resultado no provider: %s", type(exc).__name__)
            raise ProviderUnavailableError() from exc
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise self._translate(response)
        return response.content

    def delete_result(self, result_ref: str) -> None:
        if not _safe_ref(result_ref):
            return
        try:
            self._client.delete(f"/results/{result_ref}", timeout=self.health_timeout_s)
        except httpx.HTTPError:
            pass

    # ------------------------------------------------------------------ interno
    def _translate(self, response: httpx.Response) -> ProviderError:
        code = ""
        try:
            code = str(response.json().get("code") or "")
        except ValueError:
            pass
        status = response.status_code
        logger.warning("provider respondeu %s (%s)", status, code or "sem codigo")
        if status == 429 or code == "busy":
            retry = _retry_after(response) or ProviderBusyError.retry_after
            return ProviderBusyError(retry_after=retry)
        if code == "cuda_out_of_memory":
            return ProviderOutOfMemoryError()
        if code in _UNAVAILABLE_CODES or status == 503:
            return ProviderUnavailableError()
        if code in _INPUT_CODES or status in (400, 413, 415, 422):
            return ProviderRejectedInputError()
        if status == 504:
            return ProviderTimeoutError()
        return ProviderError()


def _model_version(body: dict) -> str:
    # Versao do modelo para a chave de cache: precisao + resolucao (o checkpoint e fixo no provider).
    parts = [str(body.get("precision") or ""), str(body.get("resolution") or "")]
    if body.get("width") and body.get("height"):
        parts[1] = f"{body['width']}x{body['height']}"
    return "catvton-mix:" + "/".join(p for p in parts if p)


def _parse_dt(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _retry_after(response: httpx.Response) -> int | None:
    raw = response.headers.get("Retry-After")
    if raw and raw.isdigit():
        return int(raw)
    return None


def _safe_ref(result_ref: str) -> bool:
    return bool(result_ref) and len(result_ref) <= 80 and result_ref.isalnum()
