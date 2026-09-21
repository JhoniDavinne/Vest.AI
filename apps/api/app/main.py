"""VESTE.AI API - ponto de entrada FastAPI.

Arquitetura:
    HTTP (FastAPI) -> Services -> Recommendation Engine -> PostgreSQL (fallback SQLite)
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.v1.router import api_router
from .core.config import get_settings
from sqlalchemy import inspect, text

from .core.database import get_engine
from .models import Base
from .seed.run import database_is_empty, run_seed
from .services.errors import NotFoundError, UnauthorizedError, ValidationError

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
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


def _apply_schema_compat(engine) -> None:
    inspector = inspect(engine)
    if "products" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("products")}
    if "video_url" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN video_url VARCHAR(400) DEFAULT '' NOT NULL"))
        logger.info("Schema complementado (compat): products.video_url")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    engine = get_engine()
    if settings.auto_create_schema:
        Base.metadata.create_all(engine)
        _apply_schema_compat(engine)
    if settings.auto_seed and database_is_empty():
        logger.info("Banco vazio: executando seed de demonstracao...")
        stats = run_seed()
        logger.info("Seed concluido: %s", stats)
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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins + ["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(NotFoundError)
    async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ValidationError)
    async def _validation(_: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(UnauthorizedError)
    async def _unauthorized(_: Request, exc: UnauthorizedError) -> JSONResponse:
        return JSONResponse(status_code=401, content={"detail": str(exc)})

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"name": settings.app_name, "docs": "/docs", "api": settings.api_prefix}

    return app


app = create_app()
