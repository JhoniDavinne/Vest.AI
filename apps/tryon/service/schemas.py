"""Contratos HTTP do servico de try-on."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok", "loading", "unavailable", "error"]
    device: str
    cudaAvailable: bool
    gpu: str | None
    torchVersion: str
    cudaVersion: str | None
    precision: str
    modelLoaded: bool
    busy: bool
    maxConcurrentJobs: int
    resolution: str
    vramAllocatedMiB: float | None = None
    vramReservedMiB: float | None = None
    lastError: str | None = None
    license: str = "CatVTON: CC BY-NC-SA 4.0 (uso nao comercial)"


class TryOnResponse(BaseModel):
    status: Literal["completed"]
    resultId: str
    resultUrl: str
    processingTimeMs: int
    maskTimeMs: int
    width: int
    height: int
    precision: str
    clothType: str
    steps: int
    guidanceScale: float
    seed: int
    peakVramMiB: float | None = None
    expiresAt: str
    disclaimer: str = Field(
        default=(
            "Imagem gerada por modelo de difusao (CatVTON) para fins de visualizacao; nao representa "
            "caimento fisico real. Uso nao comercial (CC BY-NC-SA 4.0)."
        )
    )


class ErrorResponse(BaseModel):
    code: str
    message: str
    retryAfterSeconds: int | None = None
