"""Configuracao do servico (variaveis de ambiente com prefixo TRYON_)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_ROOT = Path(__file__).resolve().parents[1]
VENDOR_PATH = APP_ROOT / "vendor" / "CatVTON"
# Fora do OneDrive/repositorio: cache HF de varios GB e arquivos temporarios.
LOCAL_DATA = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "veste-ai" / "tryon"

Precision = Literal["bf16", "fp16", "no"]
ClothType = Literal["upper", "lower", "overall"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TRYON_", env_file=APP_ROOT / ".env", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8100

    device: Literal["cuda"] = "cuda"  # CPU nao e suportado por decisao de projeto (sem fallback silencioso)
    precision: Precision = "bf16"
    allow_tf32: bool = True
    skip_safety_check: bool = False  # mantem o SafetyChecker oficial

    # Checkpoints (mecanismo oficial: huggingface_hub / diffusers from_pretrained)
    base_model: str = "booksforcharlie/stable-diffusion-inpainting"
    attn_repo: str = "zhengchong/CatVTON"
    attn_version: Literal["mix", "vitonhd", "dresscode"] = "mix"
    model_path: Path = Field(default=LOCAL_DATA / "models", description="HF_HOME (cache de checkpoints)")

    output_path: Path = Field(default=LOCAL_DATA / "results", description="Resultados temporarios (PNG)")
    temp_path: Path = Field(default=LOCAL_DATA / "tmp", description="Arquivos temporarios do DensePose")

    # Inferencia
    width: int = 768
    height: int = 1024
    num_inference_steps: int = Field(default=50, ge=10, le=100)
    guidance_scale: float = Field(default=2.5, ge=0.0, le=7.5)
    seed: int = 42

    # Limites / operacao
    max_concurrent_jobs: int = Field(default=1, ge=1, le=4)
    queue_wait_seconds: float = Field(default=0.0, ge=0.0, le=120.0, description="0 = responde busy imediatamente")
    max_upload_mb: int = Field(default=8, ge=1, le=64)
    min_image_side: int = 256
    max_image_side: int = 4096
    result_ttl_seconds: int = Field(default=900, ge=30)

    load_on_startup: bool = True
    # Apenas para testes unitarios sem GPU: sobe o servico com modelo indisponivel (/try-on -> 503).
    allow_start_without_gpu: bool = False

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
