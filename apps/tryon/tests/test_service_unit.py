"""Testes unitarios do servico SEM GPU: validacao de imagens, erros controlados, concorrencia e TTL.

O runtime real e substituido por um stub; a inferencia verdadeira e coberta por scripts/test_tryon.py.
"""

from __future__ import annotations

import io
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from service.catvton_runtime import CudaUnavailableError, OutOfMemoryError_, TryOnResult
from service.images import ImageValidationError, validate_and_load
from service.main import create_app
from service.results import ResultStore
from service.settings import Settings


def png_bytes(size=(320, 480), color=(200, 180, 160)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


class StubRuntime:
    """Simula o CatVTONRuntime: sem torch, mas com a mesma semantica de slots/erros."""

    def __init__(self, settings: Settings, *, delay: float = 0.0, fail_with: Exception | None = None):
        self.settings = settings
        self.loaded = True
        self.calls = 0
        self.delay = delay
        self.fail_with = fail_with
        self._slots = threading.BoundedSemaphore(settings.max_concurrent_jobs)
        self._active = 0

    @property
    def busy(self) -> bool:
        return self._active >= self.settings.max_concurrent_jobs

    def status(self):
        return {
            "status": "ok" if self.loaded else "unavailable", "device": "cuda", "cudaAvailable": True,
            "gpu": "Stub GPU", "torchVersion": "stub", "cudaVersion": "12.8", "precision": self.settings.precision,
            "modelLoaded": self.loaded, "busy": self.busy, "maxConcurrentJobs": self.settings.max_concurrent_jobs,
            "resolution": f"{self.settings.width}x{self.settings.height}", "lastError": None,
        }

    def require_cuda(self):
        if not self.loaded:
            raise CudaUnavailableError("stub sem cuda")

    def load(self):
        self.loaded = True

    def unload(self):
        pass

    def acquire_slot(self) -> bool:
        ok = self._slots.acquire(blocking=False)
        if ok:
            self._active += 1
        return ok

    def release_slot(self) -> None:
        self._active -= 1
        self._slots.release()

    def run(self, person, garment, cloth_type="upper", *, steps=None, guidance_scale=None, seed=None):
        self.calls += 1
        if self.delay:
            time.sleep(self.delay)
        if self.fail_with:
            raise self.fail_with
        return TryOnResult(
            image=Image.new("RGB", (self.settings.width, self.settings.height), (10, 20, 30)),
            mask_ms=1, inference_ms=2, peak_vram_mib=123.4,
            steps=steps or self.settings.num_inference_steps,
            guidance_scale=self.settings.guidance_scale if guidance_scale is None else guidance_scale,
            seed=self.settings.seed if seed is None else seed,
        )


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        output_path=tmp_path / "results", temp_path=tmp_path / "tmp", model_path=tmp_path / "models",
        load_on_startup=False, result_ttl_seconds=60, max_upload_mb=1, width=64, height=96,
    )


def make_client(settings: Settings, runtime) -> TestClient:
    return TestClient(create_app(settings, runtime))


def files(person: bytes, garment: bytes, person_name="p.png", person_type="image/png"):
    return {"person": (person_name, person, person_type), "garment": ("g.png", garment, "image/png")}


# ------------------------------------------------------------------ validacao de imagens
def test_validate_and_load_ok_and_exif():
    img = validate_and_load(png_bytes(), field="person", content_type="image/png", filename="a.png",
                            max_bytes=10_000_000, min_side=256, max_side=4096)
    assert img.mode == "RGB" and img.size == (320, 480)


@pytest.mark.parametrize(
    "data,ctype,name,code,status",
    [
        (b"", "image/png", "a.png", "empty_file", 400),
        (b"x" * 10, "image/png", "a.png", "invalid_image", 400),
        (png_bytes(), "image/gif", "a.gif", "unsupported_media_type", 415),
        (png_bytes(), "image/png", "a.bmp", "unsupported_extension", 415),
        (png_bytes((100, 100)), "image/png", "a.png", "image_too_small", 400),
        (png_bytes((5000, 300)), "image/png", "a.png", "image_too_large", 400),
    ],
)
def test_validate_and_load_errors(data, ctype, name, code, status):
    with pytest.raises(ImageValidationError) as exc:
        validate_and_load(data, field="person", content_type=ctype, filename=name,
                          max_bytes=10_000_000, min_side=256, max_side=4096)
    assert exc.value.code == code and exc.value.status_code == status


def test_validate_rejects_oversized_bytes():
    with pytest.raises(ImageValidationError) as exc:
        validate_and_load(png_bytes(), field="person", content_type="image/png", filename="a.png",
                          max_bytes=100, min_side=1, max_side=4096)
    assert exc.value.code == "file_too_large" and exc.value.status_code == 413


# ------------------------------------------------------------------ endpoints
def test_health_and_tryon_roundtrip(settings):
    runtime = StubRuntime(settings)
    with make_client(settings, runtime) as client:
        h = client.get("/health").json()
        assert h["status"] == "ok" and h["modelLoaded"] is True and h["cudaAvailable"] is True

        r = client.post("/try-on", files=files(png_bytes(), png_bytes()), data={"cloth_type": "upper", "seed": "3"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "completed" and len(body["resultId"]) == 32 and body["seed"] == 3

        img = client.get(body["resultUrl"])
        assert img.status_code == 200 and img.headers["content-type"] == "image/png"
        decoded = Image.open(io.BytesIO(img.content))
        assert decoded.size == (settings.width, settings.height)

        # segunda chamada reutiliza o runtime (sem reload): contador de chamadas, nao de loads
        r2 = client.post("/try-on", files=files(png_bytes(), png_bytes()), data={"cloth_type": "lower"})
        assert r2.status_code == 200 and runtime.calls == 2

        deleted = client.delete(f"/results/{body['resultId']}")
        assert deleted.status_code == 204 and deleted.content == b""
        assert client.get(body["resultUrl"]).status_code == 404
        assert client.get("/results/not-an-id").status_code == 404


def test_tryon_validation_errors(settings):
    with make_client(settings, StubRuntime(settings)) as client:
        r = client.post("/try-on", files=files(b"", png_bytes()), data={"cloth_type": "upper"})
        assert r.status_code == 400 and r.json()["code"] == "empty_file"
        r = client.post("/try-on", files=files(b"nao e imagem", png_bytes()), data={"cloth_type": "upper"})
        assert r.status_code == 400 and r.json()["code"] == "invalid_image"
        r = client.post("/try-on", files=files(png_bytes(), png_bytes(), person_type="image/gif"), data={"cloth_type": "upper"})
        assert r.status_code == 415
        big = png_bytes((2000, 2000))  # > 1 MB? garante via bytes aleatorios
        r = client.post("/try-on", files=files(b"\x89PNG" + bytes(2 * 1024 * 1024), png_bytes()), data={"cloth_type": "upper"})
        assert r.status_code == 413 and r.json()["code"] == "file_too_large"
        assert len(big) > 0
        r = client.post("/try-on", files=files(png_bytes(), png_bytes()), data={"cloth_type": "hat"})
        assert r.status_code == 422  # enum invalido (FastAPI)


def test_model_not_loaded_and_cuda_unavailable(settings):
    runtime = StubRuntime(settings)
    runtime.loaded = False
    with make_client(settings, runtime) as client:
        assert client.get("/health").json()["status"] == "unavailable"
        r = client.post("/try-on", files=files(png_bytes(), png_bytes()), data={"cloth_type": "upper"})
        assert r.status_code == 503 and r.json()["code"] == "cuda_unavailable"


def test_oom_is_reported_and_service_survives(settings):
    runtime = StubRuntime(settings, fail_with=OutOfMemoryError_("CUDA sem memoria durante a inferencia."))
    with make_client(settings, runtime) as client:
        r = client.post("/try-on", files=files(png_bytes(), png_bytes()), data={"cloth_type": "upper"})
        assert r.status_code == 503 and r.json()["code"] == "cuda_out_of_memory"
        # slot liberado apos o erro
        assert runtime.busy is False
        assert client.get("/health").status_code == 200


def test_concurrency_second_request_gets_busy(settings):
    runtime = StubRuntime(settings, delay=1.0)
    codes: list[int] = []
    with make_client(settings, runtime) as client:
        def call():
            codes.append(client.post("/try-on", files=files(png_bytes(), png_bytes()), data={"cloth_type": "upper"}).status_code)

        t1 = threading.Thread(target=call)
        t2 = threading.Thread(target=call)
        t1.start()
        time.sleep(0.2)
        t2.start()
        t1.join(); t2.join()
    assert sorted(codes) == [200, 429]
    assert runtime.calls == 1


def test_result_store_ttl(tmp_path: Path):
    store = ResultStore(tmp_path / "r", ttl_seconds=1)
    rid, _ = store.save(Image.new("RGB", (8, 8)))
    assert store.get(rid) is not None
    time.sleep(1.2)
    assert store.get(rid) is None
    assert store.path_for("../etc/passwd") is None
