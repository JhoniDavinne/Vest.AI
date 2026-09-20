"""VESTE.AI API - ponto de entrada FastAPI.

Arquitetura:
    HTTP (FastAPI) -> Services -> Recommendation Engine -> PostgreSQL (fallback SQLite)
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api.v1.router import api_router
from .core.config import get_settings
from .core.database import ensure_compat_schema, get_engine
from .core.logging import configure_logging
from .models import Base
from .seed.run import backfill_flat_images, database_is_empty, run_seed
from .services.errors import NotFoundError, UnauthorizedError, ValidationError
from .services.tryon.errors import TryOnError

ASSETS_DIR = Path(__file__).resolve().parent / "assets"

configure_logging()
logger = logging.getLogger("veste.api")

DESCRIPTION = """
Motor de recomendacao de tamanho e estimativa de caimento da **VESTE.AI**.

A VESTE.AI nao diz se uma roupa fica bonita ou feia em uma pessoa. Ela usa dados para
estimar como aquela peca tende a vestir e ajudar o consumidor a tomar uma decisao de
compra mais informada.

* `POST /api/v1/recommendations` - motor unico usado pela aplicacao web, pela API B2B e pelo widget.
* Score 0-10 = 40% medidas + 20% modelagem + 15% tecido + 15% proporcoes (foto opcional) + 10% preferencia.
* Parametros heuristicos do MVP (nao validados cientificamente).
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    engine = get_engine()
    if settings.auto_create_schema:
        Base.metadata.create_all(engine)
        ensure_compat_schema(engine)
    if settings.auto_seed:
        if database_is_empty():
            logger.info("Banco vazio: executando seed de demonstracao...")
            stats = run_seed()
            logger.info("Seed concluido: %s", stats)
        else:
            updated = backfill_flat_images()
            if updated:
                logger.info("Imagens flat do seed aplicadas a %d produto(s) existentes", updated)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/api/v1/openapi.json",
        contact={"name": "VESTE.AI", "url": "https://veste.ai"},
    )
    # CORS: em producao somente as origens configuradas; em dev/demo qualquer origem
    # (widget incorporado em paginas de terceiros). Sem credenciais em ambos os casos.
    is_production = settings.environment == "production"
    allow_any = settings.cors_allow_any_origin_in_dev and not is_production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_any else settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    if settings.trusted_hosts and settings.trusted_hosts != ["*"]:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

    @app.exception_handler(NotFoundError)
    async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ValidationError)
    async def _validation(_: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(UnauthorizedError)
    async def _unauthorized(_: Request, exc: UnauthorizedError) -> JSONResponse:
        return JSONResponse(status_code=401, content={"detail": str(exc)})

    @app.exception_handler(TryOnError)
    async def _tryon_error(_: Request, exc: TryOnError) -> JSONResponse:
        # Erro controlado do provador com foto: codigo estavel para o frontend, sem detalhes internos.
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload(), headers=headers)

    app.include_router(api_router, prefix=settings.api_prefix)
    # Imagens flat das pecas (assets internos do catalogo demo) para o provador com foto.
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"name": settings.app_name, "docs": "/docs", "api": settings.api_prefix}

    return app


app = create_app()
