"""Configuracao da aplicacao (variaveis de ambiente)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
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
    # Fora de producao qualquer origem e aceita (demo/widget em paginas de terceiros).
    # Em producao somente `cors_origins` vale.
    cors_allow_any_origin_in_dev: bool = True
    # Hosts aceitos no header Host (TrustedHostMiddleware). ["*"] desativa a checagem.
    trusted_hosts: list[str] = ["*"]
    # Logs em JSON (uma linha por evento) para agregadores; texto legivel por padrao.
    log_json: bool = False
    log_level: str = "INFO"

    # Chave de integracao B2B da empresa demo (seed)
    demo_api_key: str = "veste_demo_key_loja_parceira"

    # Visao computacional experimental
    vision_enabled: bool = True
    max_photo_bytes: int = 8 * 1024 * 1024

    # Provador com foto (virtual try-on) — provider externo isolado (apps/tryon). A API
    # atua apenas como adaptador: nunca hospeda o modelo nem persiste fotos.
    tryon_enabled: bool = False
    tryon_provider: str = "catvton"
    tryon_url: str = "http://127.0.0.1:8100"
    tryon_timeout_s: float = Field(default=120.0, ge=5.0, le=900.0)
    tryon_health_timeout_s: float = Field(default=2.0, ge=0.5, le=30.0)
    tryon_result_ttl_s: int = Field(default=900, ge=30)
    tryon_max_photo_bytes: int = 8 * 1024 * 1024
    # Imagens flat das pecas: caminhos internos servidos em /assets/flat (app/assets/flat) ou
    # URLs http(s) cujo host esteja nesta allowlist. Nenhuma URL enviada pelo usuario e aceita.
    tryon_flat_image_allowed_hosts: list[str] = []


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
