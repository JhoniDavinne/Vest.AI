"""Sessao SQLAlchemy com fallback automatico para SQLite.

Ordem de tentativa:
1. VESTE_DATABASE_URL (PostgreSQL por padrao)
2. Se a conexao falhar e o ambiente nao for producao -> SQLite local

Isso garante que a demonstracao nunca dependa de um servico externo fragil.
"""

from __future__ import annotations

import logging
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings

logger = logging.getLogger("veste.db")

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None
_active_url: str | None = None


def _make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False}, future=True)
    connect_args = {}
    if "postgresql" in url or "psycopg" in url:
        connect_args["connect_timeout"] = 3
    return create_engine(url, pool_pre_ping=True, future=True, connect_args=connect_args)


def _try_connect(engine: Engine) -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001 - qualquer falha de conexao aciona o fallback
        logger.warning("Falha ao conectar em %s: %s", engine.url.render_as_string(hide_password=True), exc)
        return False


def init_engine(url: str | None = None) -> Engine:
    """Inicializa (ou reinicializa) o engine global. Usado pela app e pelos testes."""
    global _engine, _SessionLocal, _active_url
    settings = get_settings()
    candidate = url or settings.database_url
    engine = _make_engine(candidate)
    if not _try_connect(engine):
        can_fallback = settings.allow_sqlite_fallback and settings.environment != "production"
        if can_fallback:
            logger.warning("Usando fallback SQLite: %s", settings.sqlite_fallback_url)
            engine.dispose()
            engine = _make_engine(settings.sqlite_fallback_url)
            candidate = settings.sqlite_fallback_url
        else:
            engine.dispose()
            raise RuntimeError("Banco indisponivel e fallback SQLite desativado neste ambiente.")
    _engine = engine
    _active_url = candidate
    _SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    return engine


def get_engine() -> Engine:
    if _engine is None:
        return init_engine()
    return _engine


def active_database_url() -> str:
    get_engine()
    return _active_url or ""


def session_factory() -> sessionmaker[Session]:
    if _SessionLocal is None:
        init_engine()
    assert _SessionLocal is not None
    return _SessionLocal


def ensure_compat_schema(engine: Engine) -> list[str]:
    """Complementa `create_all` para bancos criados antes de colunas novas (modo demo/offline).

    `Base.metadata.create_all` cria tabelas novas mas nao adiciona colunas a tabelas existentes.
    Em PostgreSQL de producao a fonte oficial e o Alembic (apps/api/alembic); aqui so cobrimos
    o caminho `auto_create_schema` para que a demo nao quebre ao atualizar.
    """
    applied: list[str] = []
    inspector = inspect(engine)
    if "products" in inspector.get_table_names():
        columns = {c["name"] for c in inspector.get_columns("products")}
        if "flat_image_url" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE products ADD COLUMN flat_image_url VARCHAR(400) NOT NULL DEFAULT ''")
                )
            applied.append("products.flat_image_url")
    if applied:
        logger.info("Schema complementado (compat): %s", ", ".join(applied))
    return applied


def get_db() -> Generator[Session, None, None]:
    db = session_factory()()
    try:
        yield db
    finally:
        db.close()
