"""Pre-start da API em containers: aguarda o banco e aplica migrations Alembic.

    python -m app.prestart          # espera VESTE_DATABASE_URL responder e roda `alembic upgrade head`

Regras:
  * Nunca destrutivo: so `upgrade head`. Bancos criados antes do Alembic (via `create_all`) sao
    detectados e carimbados (`stamp`) na revisao correspondente antes do upgrade.
  * Sem fallback silencioso para SQLite: se o banco configurado nao responder dentro de
    VESTE_DB_WAIT_SECONDS, o processo sai com erro (o orquestrador reinicia).
  * Seed continua a cargo do lifespan (VESTE_AUTO_SEED), apos as migrations.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from .core.config import get_settings
from .core.logging import configure_logging

logger = logging.getLogger("veste.prestart")

API_ROOT = Path(__file__).resolve().parents[1]
INITIAL_REVISION = "07f07de8bcbe"
TRYON_REVISION = "4b2a7c9e1d06"


def wait_for_database(url: str, timeout_s: float) -> Engine:
    engine = create_engine(url, pool_pre_ping=True, future=True)
    deadline = time.monotonic() + timeout_s
    attempt = 0
    while True:
        attempt += 1
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("banco disponivel apos %d tentativa(s)", attempt)
            return engine
        except Exception as exc:  # noqa: BLE001 - qualquer erro de conexao conta como "ainda nao"
            if time.monotonic() >= deadline:
                logger.error("banco indisponivel apos %.0fs: %s", timeout_s, type(exc).__name__)
                raise SystemExit(1) from exc
            time.sleep(min(2.0, 0.5 * attempt))


def _legacy_revision(engine: Engine) -> str | None:
    """Revisao equivalente de um banco criado por `create_all` (sem tabela alembic_version)."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "alembic_version" in tables or "products" not in tables:
        return None
    columns = {c["name"] for c in inspector.get_columns("products")}
    if "flat_image_url" in columns and "tryon_jobs" in tables:
        return TRYON_REVISION
    return INITIAL_REVISION


def run_migrations(url: str) -> None:
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    engine = create_engine(url, future=True)
    legacy = _legacy_revision(engine)
    engine.dispose()
    if legacy:
        logger.info("banco legado sem alembic_version: stamp %s", legacy)
        command.stamp(cfg, legacy)
    command.upgrade(cfg, "head")
    logger.info("migrations aplicadas (head)")


def main() -> None:
    configure_logging()
    settings = get_settings()
    url = os.environ.get("VESTE_DATABASE_URL", settings.database_url)
    timeout_s = float(os.environ.get("VESTE_DB_WAIT_SECONDS", "60"))
    run = os.environ.get("VESTE_RUN_MIGRATIONS", "true").lower() in {"1", "true", "yes"}

    engine = wait_for_database(url, timeout_s)
    engine.dispose()
    if run:
        run_migrations(url)
    else:
        logger.info("VESTE_RUN_MIGRATIONS=false: migrations nao executadas")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:  # noqa: BLE001
        logger.exception("prestart falhou")
        sys.exit(1)
