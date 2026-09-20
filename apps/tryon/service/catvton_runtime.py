"""CatVTONRuntime — carrega o modelo UMA vez e o mantem em GPU para todas as requisicoes.

    process start -> CatVTONRuntime.load() -> modelo em GPU -> requests reutilizam

Responsabilidades: carregar modelo, manter device/precision, executar inferencia,
limpar memoria temporaria, controlar concorrencia e reportar status.
Usa exclusivamente o codigo oficial vendorizado (vendor/CatVTON): CatVTONPipeline + AutoMasker.
"""

from __future__ import annotations

import gc
import logging
import os
import shutil
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any

from PIL import Image

from .settings import Settings, VENDOR_PATH

logger = logging.getLogger("tryon.runtime")


class RuntimeError_(Exception):
    """Base dos erros controlados do runtime."""

    code = "runtime_error"
    status_code = 500


class CudaUnavailableError(RuntimeError_):
    code = "cuda_unavailable"
    status_code = 503


class ModelNotLoadedError(RuntimeError_):
    code = "model_not_loaded"
    status_code = 503


class BusyError(RuntimeError_):
    code = "busy"
    status_code = 429


class OutOfMemoryError_(RuntimeError_):
    code = "cuda_out_of_memory"
    status_code = 503


class PreprocessingError(RuntimeError_):
    code = "preprocessing_error"
    status_code = 422


class InferenceError(RuntimeError_):
    code = "inference_error"
    status_code = 500


@dataclass
class TryOnResult:
    image: Image.Image
    mask_ms: int
    inference_ms: int
    peak_vram_mib: float | None
    steps: int
    guidance_scale: float
    seed: int


def _mib(value: int) -> float:
    return round(value / (1024 * 1024), 1)


class CatVTONRuntime:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._torch: Any = None
        self._pipeline: Any = None
        self._automasker: Any = None
        self._mask_processor: Any = None
        self._weight_dtype: Any = None
        self._loaded = False
        self._loading = False
        self._last_error: str | None = None
        self._gpu_name: str | None = None
        self._slots = threading.BoundedSemaphore(settings.max_concurrent_jobs)
        self._active = 0
        self._active_lock = threading.Lock()

    # ------------------------------------------------------------------ status
    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def busy(self) -> bool:
        return self._active >= self.settings.max_concurrent_jobs

    def status(self) -> dict[str, Any]:
        torch = self._import_torch()
        cuda = bool(torch and torch.cuda.is_available())
        info: dict[str, Any] = {
            "device": self.settings.device,
            "cudaAvailable": cuda,
            "gpu": (torch.cuda.get_device_name(0) if cuda else None),
            "torchVersion": torch.__version__ if torch else "unavailable",
            "cudaVersion": (torch.version.cuda if torch else None),
            "precision": self.settings.precision,
            "modelLoaded": self._loaded,
            "busy": self.busy,
            "maxConcurrentJobs": self.settings.max_concurrent_jobs,
            "resolution": f"{self.settings.width}x{self.settings.height}",
            "lastError": self._last_error,
        }
        if cuda:
            info["vramAllocatedMiB"] = _mib(torch.cuda.memory_allocated())
            info["vramReservedMiB"] = _mib(torch.cuda.memory_reserved())
        if self._loaded:
            info["status"] = "ok"
        elif self._loading:
            info["status"] = "loading"
        elif self._last_error:
            info["status"] = "error"
        else:
            info["status"] = "unavailable"
        return info

    # ------------------------------------------------------------------- load
    def _import_torch(self) -> Any:
        if self._torch is None:
            try:
                import torch  # noqa: WPS433 - import tardio intencional (ambiente pesado)

                self._torch = torch
            except Exception as exc:  # noqa: BLE001
                self._last_error = f"torch import failed: {type(exc).__name__}"
                return None
        return self._torch

    def require_cuda(self) -> None:
        """Falha explicitamente se CUDA nao estiver disponivel — nunca cai para CPU."""
        torch = self._import_torch()
        if torch is None:
            raise CudaUnavailableError("PyTorch indisponivel no ambiente.")
        if self.settings.device != "cuda" or not torch.cuda.is_available():
            raise CudaUnavailableError("torch.cuda.is_available() == False; inferencia recusada (sem fallback para CPU).")
        cap = torch.cuda.get_device_capability(0)
        if f"sm_{cap[0]}{cap[1]}" not in torch.cuda.get_arch_list():
            raise CudaUnavailableError(
                f"Build do PyTorch sem kernels para sm_{cap[0]}{cap[1]} ({torch.cuda.get_device_name(0)})."
            )
        if self.settings.precision == "bf16" and not torch.cuda.is_bf16_supported():
            raise CudaUnavailableError("bf16 nao suportado pela GPU/PyTorch; ajuste TRYON_PRECISION.")

    def load(self) -> None:
        """Carrega pipeline + AutoMasker uma unica vez (idempotente)."""
        if self._loaded:
            return
        self.require_cuda()
        self._loading = True
        t0 = time.perf_counter()
        try:
            settings = self.settings
            for path in (settings.model_path, settings.output_path, settings.temp_path):
                path.mkdir(parents=True, exist_ok=True)
            # Cache HF local ao servico; definido antes de importar huggingface_hub/diffusers.
            os.environ.setdefault("HF_HOME", str(settings.model_path))
            os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
            # DensePose oficial grava temporarios em ./densepose_/tmp relativo ao CWD.
            os.chdir(settings.temp_path)
            if str(VENDOR_PATH) not in sys.path:
                sys.path.insert(0, str(VENDOR_PATH))

            from diffusers.image_processor import VaeImageProcessor
            from huggingface_hub import snapshot_download

            from model.cloth_masker import AutoMasker
            from model.pipeline import CatVTONPipeline
            from utils import init_weight_dtype

            torch = self._import_torch()
            self._weight_dtype = init_weight_dtype(settings.precision)
            self._gpu_name = torch.cuda.get_device_name(0)

            repo_path = snapshot_download(repo_id=settings.attn_repo)
            self._pipeline = CatVTONPipeline(
                base_ckpt=settings.base_model,
                attn_ckpt=repo_path,
                attn_ckpt_version=settings.attn_version,
                weight_dtype=self._weight_dtype,
                use_tf32=settings.allow_tf32,
                device=settings.device,
                skip_safety_check=settings.skip_safety_check,
            )
            self._automasker = AutoMasker(
                densepose_ckpt=os.path.join(repo_path, "DensePose"),
                schp_ckpt=os.path.join(repo_path, "SCHP"),
                device=settings.device,
            )
            self._mask_processor = VaeImageProcessor(
                vae_scale_factor=8, do_normalize=False, do_binarize=True, do_convert_grayscale=True
            )
            torch.cuda.synchronize()
            self._loaded = True
            self._last_error = None
            logger.info(
                "CatVTON carregado em %.1fs · gpu=%s · precision=%s · vram=%.0f MiB",
                time.perf_counter() - t0,
                self._gpu_name,
                settings.precision,
                _mib(torch.cuda.memory_allocated()),
            )
        except RuntimeError_:
            raise
        except Exception as exc:  # noqa: BLE001
            self._last_error = f"load failed: {type(exc).__name__}: {exc}"
            logger.exception("Falha ao carregar o CatVTON")
            raise ModelNotLoadedError(self._last_error) from exc
        finally:
            self._loading = False

    # -------------------------------------------------------------- inference
    def acquire_slot(self) -> bool:
        wait = self.settings.queue_wait_seconds
        ok = self._slots.acquire(blocking=wait > 0, timeout=wait if wait > 0 else None)
        if ok:
            with self._active_lock:
                self._active += 1
        return ok

    def release_slot(self) -> None:
        with self._active_lock:
            self._active = max(0, self._active - 1)
        self._slots.release()

    def run(
        self,
        person: Image.Image,
        garment: Image.Image,
        cloth_type: str = "upper",
        *,
        steps: int | None = None,
        guidance_scale: float | None = None,
        seed: int | None = None,
    ) -> TryOnResult:
        """Executa uma inferencia. O chamador deve ter adquirido um slot (acquire_slot)."""
        if not self._loaded:
            raise ModelNotLoadedError("Modelo nao carregado.")
        torch = self._torch
        settings = self.settings
        steps = steps or settings.num_inference_steps
        guidance_scale = settings.guidance_scale if guidance_scale is None else guidance_scale
        seed = settings.seed if seed is None else seed

        from utils import resize_and_crop, resize_and_padding

        try:
            torch.cuda.reset_peak_memory_stats()
            t0 = time.perf_counter()
            person_p = resize_and_crop(person, (settings.width, settings.height))
            garment_p = resize_and_padding(garment, (settings.width, settings.height))
            mask = self._automasker(person_p, cloth_type)["mask"]
            mask = self._mask_processor.blur(mask, blur_factor=9)
            mask_ms = int((time.perf_counter() - t0) * 1000)
        except torch.cuda.OutOfMemoryError as exc:
            self._recover_from_oom()
            raise OutOfMemoryError_("CUDA sem memoria durante a geracao da mascara.") from exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("Preprocessing falhou: %s", type(exc).__name__)
            raise PreprocessingError(f"Falha no pre-processamento ({type(exc).__name__}).") from exc

        try:
            t0 = time.perf_counter()
            generator = torch.Generator(device=settings.device).manual_seed(seed) if seed >= 0 else None
            result = self._pipeline(
                image=person_p,
                condition_image=garment_p,
                mask=mask,
                num_inference_steps=steps,
                guidance_scale=guidance_scale,
                height=settings.height,
                width=settings.width,
                generator=generator,
            )[0]
            torch.cuda.synchronize()
            inference_ms = int((time.perf_counter() - t0) * 1000)
            peak = _mib(torch.cuda.max_memory_allocated())
        except torch.cuda.OutOfMemoryError as exc:
            self._recover_from_oom()
            raise OutOfMemoryError_("CUDA sem memoria durante a inferencia.") from exc
        except Exception as exc:  # noqa: BLE001
            logger.exception("Inferencia falhou")
            raise InferenceError(f"Falha na inferencia ({type(exc).__name__}).") from exc
        finally:
            del person_p, garment_p, mask
            self._cleanup_temp()

        return TryOnResult(
            image=result,
            mask_ms=mask_ms,
            inference_ms=inference_ms,
            peak_vram_mib=peak,
            steps=steps,
            guidance_scale=guidance_scale,
            seed=seed,
        )

    # ---------------------------------------------------------------- cleanup
    def _recover_from_oom(self) -> None:
        logger.error("CUDA OutOfMemory — liberando cache")
        gc.collect()
        if self._torch is not None:
            self._torch.cuda.empty_cache()

    def _cleanup_temp(self) -> None:
        """Remove restos do DensePose (./densepose_/tmp) — arquivos com a imagem da pessoa."""
        tmp = self.settings.temp_path / "densepose_" / "tmp"
        if tmp.exists():
            for entry in tmp.iterdir():
                try:
                    entry.unlink()
                except OSError:
                    pass

    def unload(self) -> None:
        self._pipeline = None
        self._automasker = None
        self._mask_processor = None
        self._loaded = False
        gc.collect()
        if self._torch is not None and self._torch.cuda.is_available():
            self._torch.cuda.empty_cache()
        tmp = self.settings.temp_path / "densepose_"
        shutil.rmtree(tmp, ignore_errors=True)
