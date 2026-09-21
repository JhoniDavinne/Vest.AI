"""Configuracao da aplicacao (variaveis de ambiente)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VESTE_", env_file=".env", extra="ignore")

    app_name: str = "VESTE.AI API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    # PostgreSQL e o banco oficial do MVP. SQLite e aceito como fallback offline
    # (demonstracao sem Docker e testes automatizados).
    database_url: str = Field(
        default="postgresql+psycopg://veste:veste@localhost:5432/veste_ai",
        description="URL SQLAlchemy do banco de dados",
    )
    sqlite_fallback_url: str = "sqlite:///./veste_ai.db"
    auto_create_schema: bool = True  # cria tabelas na subida (util para demo/offline)
    auto_seed: bool = True           # popula seed na subida se o banco estiver vazio

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Chave de integracao B2B da empresa demo (seed)
    demo_api_key: str = "veste_demo_key_loja_parceira"

    # Visao computacional experimental
    vision_enabled: bool = True
    max_photo_bytes: int = 8 * 1024 * 1024

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://") and "+psycopg" not in value:
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
