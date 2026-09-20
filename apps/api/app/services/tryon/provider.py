"""Abstracao de provider de virtual try-on.

A API principal conversa com o provider apenas por esta interface: o frontend nunca chama o
servico de inferencia diretamente e nenhum detalhe interno (caminhos, GPU, cache) vaza
para o contrato HTTP publico. Implementacao atual: `CatVTONProvider` (apps/tryon por HTTP).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

ClothType = Literal["upper", "lower", "overall"]


@dataclass(frozen=True)
class ProviderHealth:
    available: bool
    model_version: str = ""
    busy: bool = False
    detail: str = ""  # texto tecnico curto (log), nunca exibido ao usuario


@dataclass(frozen=True)
class ProviderResult:
    result_ref: str  # identificador opaco do resultado no provider (nunca a imagem)
    processing_ms: int
    model_version: str = ""
    expires_at: datetime | None = None


class VirtualTryOnProvider(Protocol):
    name: str

    def health(self) -> ProviderHealth:
        """Disponibilidade do provider. Nunca lanca: indisponivel -> available=False."""

    def submit(self, person: bytes, garment: bytes, cloth_type: ClothType) -> ProviderResult:
        """Executa a inferencia. Lanca subclasses de `ProviderError` ja traduzidas."""

    def result_exists(self, result_ref: str) -> bool:
        """True se o resultado ainda esta disponivel no provider (TTL)."""

    def fetch_result(self, result_ref: str) -> bytes | None:
        """Bytes da imagem final (PNG) ou None se expirou/inexistente."""

    def delete_result(self, result_ref: str) -> None:
        """Remove o resultado no provider (best-effort)."""
