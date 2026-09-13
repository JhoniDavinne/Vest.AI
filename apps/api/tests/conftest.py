from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Testes rodam em SQLite isolado, sem depender de PostgreSQL.
_TEST_DB = Path(__file__).parent / ".test_veste.db"
os.environ["VESTE_DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["VESTE_SQLITE_FALLBACK_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["VESTE_AUTO_SEED"] = "true"

from app.core.database import init_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.seed.run import run_seed  # noqa: E402


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    if _TEST_DB.exists():
        _TEST_DB.unlink()
    engine = init_engine(os.environ["VESTE_DATABASE_URL"])
    Base.metadata.create_all(engine)
    run_seed()
    with TestClient(app) as c:
        yield c
    engine.dispose()
    if _TEST_DB.exists():
        try:
            _TEST_DB.unlink()
        except PermissionError:
            pass


DEMO_CUSTOMER = {"height": 180, "weight": 78, "chest": 102, "waist": 88, "hip": 100, "shoulder": 45}
