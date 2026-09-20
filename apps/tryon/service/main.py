"""Servico HTTP local do CatVTON (FastAPI).

    GET  /health                 status de GPU/modelo
    POST /try-on                 multipart: person, garment, cloth_type -> { resultId, processingTimeMs, ... }
    GET  /results/{resultId}     PNG do resultado (TTL)
    DELETE /results/{resultId}

Isolado da API VESTE.AI: nao conhece usuarios, analises nem o motor de recomendacao.
Logs sao tecnicos: nunca registram bytes, base64, nomes originais ou caminhos com dados pessoais.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse, Response

from .catvton_runtime import BusyError, CatVTONRuntime, CudaUnavailableError, ModelNotLoadedError, RuntimeError_
from .images import ImageValidationError, validate_and_load
from .results import ResultStore
from .schemas import ErrorResponse, HealthResponse, TryOnResponse
from .settings import ClothType, Settings, get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("tryon.api")


def create_app(settings: Settings | None = None, runtime: CatVTONRuntime | None = None) -> FastAPI:
    settings = settings or get_settings()
    runtime = runtime or CatVTONRuntime(settings)
    store = ResultStore(settings.output_path, settings.result_ttl_seconds)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if settings.load_on_startup:
            try:
                runtime.require_cuda()
                await run_in_threadpool(runtime.load)
            except CudaUnavailableError as exc:
                logger.error("CUDA indisponivel: %s", exc)
                if not settings.allow_start_without_gpu:
                    raise RuntimeError(f"Inicializacao abortada: {exc}") from exc
            except RuntimeError_ as exc:
                logger.error("Modelo nao carregado: %s", exc)
                if not settings.allow_start_without_gpu:
                    raise RuntimeError(f"Inicializacao abortada: {exc}") from exc
        yield
        runtime.unload()

    app = FastAPI(
        title="VESTE.AI Try-On (CatVTON local)",
        version="0.1.0",
        description=(
            "Servico local de virtual try-on baseado em CatVTON (Zheng-Chong/CatVTON). "
            "Licenca dos pesos/codigo: CC BY-NC-SA 4.0 — uso nao comercial."
        ),
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.runtime = runtime
    app.state.store = store

    def error(status: int, code: str, message: str, retry_after: int | None = None) -> JSONResponse:
        headers = {"Retry-After": str(retry_after)} if retry_after else None
        return JSONResponse(
            status_code=status,
            content=ErrorResponse(code=code, message=message, retryAfterSeconds=retry_after).model_dump(),
            headers=headers,
        )

    @app.exception_handler(ImageValidationError)
    async def _image_error(_: Request, exc: ImageValidationError) -> JSONResponse:
        return error(exc.status_code, exc.code, exc.message)

    @app.exception_handler(RuntimeError_)
    async def _runtime_error(_: Request, exc: RuntimeError_) -> JSONResponse:
        retry = 5 if isinstance(exc, BusyError) else None
        return error(exc.status_code, exc.code, str(exc), retry)

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(**runtime.status())

    @app.post(
        "/try-on",
        response_model=TryOnResponse,
        responses={400: {"model": ErrorResponse}, 413: {"model": ErrorResponse}, 415: {"model": ErrorResponse},
                   422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    )
    async def try_on(
        person: Annotated[UploadFile, File(description="Foto frontal da pessoa (JPEG/PNG/WebP)")],
        garment: Annotated[UploadFile, File(description="Imagem da peca (flat/lay ou em modelo)")],
        cloth_type: Annotated[ClothType, Form()] = "upper",
        steps: Annotated[int | None, Form(ge=10, le=100)] = None,
        guidance_scale: Annotated[float | None, Form(ge=0.0, le=7.5)] = None,
        seed: Annotated[int | None, Form(ge=-1, le=2**31 - 1)] = None,
    ) -> TryOnResponse:
        store.sweep()
        if not runtime.loaded:
            runtime.require_cuda()  # produz cuda_unavailable quando for o caso
            raise ModelNotLoadedError("Modelo ainda nao carregado.")

        # Leitura limitada: +1 byte para detectar excesso sem carregar tudo.
        limit = settings.max_upload_bytes + 1
        person_bytes = await person.read(limit)
        garment_bytes = await garment.read(limit)
        person_img = validate_and_load(
            person_bytes, field="person", content_type=person.content_type, filename=person.filename,
            max_bytes=settings.max_upload_bytes, min_side=settings.min_image_side, max_side=settings.max_image_side,
        )
        garment_img = validate_and_load(
            garment_bytes, field="garment", content_type=garment.content_type, filename=garment.filename,
            max_bytes=settings.max_upload_bytes, min_side=settings.min_image_side, max_side=settings.max_image_side,
        )
        del person_bytes, garment_bytes

        if not runtime.acquire_slot():
            raise BusyError("GPU ocupada com outra inferencia; tente novamente em instantes.")
        started = time.perf_counter()
        try:
            result = await run_in_threadpool(
                runtime.run, person_img, garment_img, cloth_type, steps=steps, guidance_scale=guidance_scale, seed=seed
            )
        finally:
            runtime.release_slot()
            del person_img, garment_img

        result_id, expires_at = store.save(result.image)
        total_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "try-on ok · cloth=%s · %dx%d · %s · mask=%dms · infer=%dms · total=%dms · peak=%s MiB",
            cloth_type, settings.width, settings.height, settings.precision,
            result.mask_ms, result.inference_ms, total_ms, result.peak_vram_mib,
        )
        return TryOnResponse(
            status="completed",
            resultId=result_id,
            resultUrl=f"/results/{result_id}",
            processingTimeMs=total_ms,
            maskTimeMs=result.mask_ms,
            width=settings.width,
            height=settings.height,
            precision=settings.precision,
            clothType=cloth_type,
            steps=result.steps,
            guidanceScale=result.guidance_scale,
            seed=result.seed,
            peakVramMiB=result.peak_vram_mib,
            expiresAt=datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
        )

    @app.get("/results/{result_id}", responses={404: {"model": ErrorResponse}})
    def get_result(result_id: str):
        path = store.get(result_id)
        if path is None:
            return error(404, "result_not_found", "Resultado inexistente ou expirado.")
        return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, no-store"})

    @app.delete("/results/{result_id}", status_code=204, responses={404: {"model": ErrorResponse}})
    def delete_result(result_id: str):
        if not store.delete(result_id):
            return error(404, "result_not_found", "Resultado inexistente ou expirado.")
        return Response(status_code=204)

    return app


app = create_app()
