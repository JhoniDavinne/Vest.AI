"""Provador com foto (virtual try-on, experimental).

A API principal atua como adaptador: recebe a foto, resolve analise/tamanho/peca no banco,
chama o provider (apps/tryon via VirtualTryOnProvider) e persiste SOMENTE metadados.
O frontend nunca fala com o provider; a imagem final e entregue por proxy.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from ....api.deps import DbSession
from ....core.config import get_settings
from ....core.database import session_factory
from ....schemas import TryOnErrorOut, TryOnJobOut, TryOnStatusOut
from ....services.tryon import service as tryon_service
from ....services.tryon.provider import VirtualTryOnProvider

router = APIRouter()

Provider = Annotated[VirtualTryOnProvider, Depends(tryon_service.get_provider)]

_ERRORS = {
    400: {"model": TryOnErrorOut},
    404: {"model": TryOnErrorOut},
    413: {"model": TryOnErrorOut},
    415: {"model": TryOnErrorOut},
    422: {"model": TryOnErrorOut},
    503: {"model": TryOnErrorOut},
    504: {"model": TryOnErrorOut},
}


@router.get("/status", response_model=TryOnStatusOut, summary="Disponibilidade do provador com foto")
def tryon_status(provider: Provider) -> TryOnStatusOut:
    return tryon_service.tryon_status(provider)


def _create_tryon_in_worker(
    provider: VirtualTryOnProvider,
    *,
    analysis_id: str,
    photo: bytes,
    photo_content_type: str | None,
    photo_filename: str | None,
    consent_tryon: bool,
    size: str | None,
) -> TryOnJobOut:
    """Sessao SQLAlchemy criada no mesmo thread da inferencia (Session nao e thread-safe)."""
    db = session_factory()()
    try:
        return tryon_service.create_tryon(
            db,
            provider,
            analysis_id=analysis_id,
            photo=photo,
            photo_content_type=photo_content_type,
            photo_filename=photo_filename,
            consent_tryon=consent_tryon,
            size=size,
        )
    finally:
        db.close()


@router.post(
    "",
    response_model=TryOnJobOut,
    status_code=status.HTTP_200_OK,
    responses=_ERRORS,
    summary="Gerar visualização da peça na foto do consumidor (experimental)",
    description=(
        "Exige `consent_tryon=true` (consentimento específico, distinto da análise corporal). "
        "O tamanho vem da análise (recomendado) ou de `size` válido escolhido pelo usuário — o provider "
        "não determina tamanho, score nem confiança. A foto é processada em memória e descartada; "
        "apenas metadados do job são persistidos. Execução síncrona na v1: o job transita "
        "processing → completed|failed na mesma chamada."
    ),
)
async def create_tryon(
    provider: Provider,
    person: Annotated[UploadFile, File(description="Foto frontal de corpo inteiro (JPG/PNG/WebP)")],
    analysis_id: Annotated[str, Form(min_length=8, max_length=64)],
    consent_tryon: Annotated[bool, Form()] = False,
    size: Annotated[str | None, Form(max_length=12)] = None,
) -> TryOnJobOut:
    settings = get_settings()
    # Leitura limitada (+1 byte para detectar excesso) — a foto fica somente em memoria.
    data = await person.read(settings.tryon_max_photo_bytes + 1)
    content_type = person.content_type
    filename = person.filename
    return await run_in_threadpool(
        _create_tryon_in_worker,
        provider,
        analysis_id=analysis_id,
        photo=data,
        photo_content_type=content_type,
        photo_filename=filename,
        consent_tryon=consent_tryon,
        size=size,
    )


@router.get("/{job_id}", response_model=TryOnJobOut, responses={404: {"model": TryOnErrorOut}}, summary="Estado do job")
def get_tryon(job_id: str, db: DbSession) -> TryOnJobOut:
    return tryon_service.get_job(db, job_id)


@router.get(
    "/{job_id}/image",
    responses={200: {"content": {"image/png": {}}}, 404: {"model": TryOnErrorOut}, 410: {"model": TryOnErrorOut}},
    summary="Imagem gerada (proxy do provider, com TTL)",
)
def get_tryon_image(job_id: str, db: DbSession, provider: Provider) -> Response:
    data = tryon_service.get_job_image(db, provider, job_id)
    return Response(content=data, media_type="image/png", headers={"Cache-Control": "private, no-store"})


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Descartar resultado")
def delete_tryon(job_id: str, db: DbSession, provider: Provider) -> Response:
    tryon_service.delete_job_result(db, provider, job_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
