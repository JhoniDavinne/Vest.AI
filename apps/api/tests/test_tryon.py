"""Provador com foto (try-on): API com provider stub (sem GPU) e CatVTONProvider com transporte mock."""

from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from PIL import Image
from sqlalchemy import inspect, select

from app.core.config import get_settings
from app.core.database import session_factory
from app.main import app
from app.models import Product, TryOnJob
from app.services.tryon import service as tryon_service
from app.services.tryon.catvton_provider import CatVTONProvider
from app.services.tryon.errors import (
    ProviderBusyError,
    ProviderError,
    ProviderOutOfMemoryError,
    ProviderRejectedInputError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.services.tryon.provider import ProviderHealth, ProviderResult

from .conftest import DEMO_CUSTOMER

API = "/api/v1"


def photo_bytes(size=(600, 900), color=(180, 160, 150), fmt="PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt)
    return buf.getvalue()


PNG_1x1 = photo_bytes((1, 1))


class StubProvider:
    """Provider em memoria com a mesma semantica de erros do CatVTONProvider."""

    name = "stub"

    def __init__(self, *, available: bool = True, fail_with: Exception | None = None):
        self.available = available
        self.fail_with = fail_with
        self.submits = 0
        self.results: dict[str, bytes] = {}
        self.last_person: bytes | None = None
        self.last_garment: bytes | None = None
        self.last_cloth_type: str | None = None

    def health(self) -> ProviderHealth:
        return ProviderHealth(available=self.available, model_version="stub:bf16/768x1024")

    def submit(self, person: bytes, garment: bytes, cloth_type: str) -> ProviderResult:
        self.submits += 1
        self.last_person, self.last_garment, self.last_cloth_type = person, garment, cloth_type
        if self.fail_with:
            raise self.fail_with
        ref = f"r{self.submits:031d}"
        self.results[ref] = photo_bytes((768, 1024), (10, 20, 30))
        return ProviderResult(
            result_ref=ref, processing_ms=1234, model_version="stub:bf16/768x1024",
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=900),
        )

    def result_exists(self, result_ref: str) -> bool:
        return result_ref in self.results

    def fetch_result(self, result_ref: str) -> bytes | None:
        return self.results.get(result_ref)

    def delete_result(self, result_ref: str) -> None:
        self.results.pop(result_ref, None)


@pytest.fixture
def stub():
    provider = StubProvider()
    app.dependency_overrides[tryon_service.get_provider] = lambda: provider
    tryon_service.health_cache.reset()
    yield provider
    app.dependency_overrides.pop(tryon_service.get_provider, None)
    tryon_service.health_cache.reset()


@pytest.fixture
def enabled(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "tryon_enabled", True)
    yield settings


@pytest.fixture
def analysis(client) -> dict:
    # Produto do seed COM imagem flat (camiseta-essential.jpg)
    return client.post(f"{API}/recommendations", json={"sku": "CAMISETA-001-M", "customer": DEMO_CUSTOMER}).json()


def post_tryon(client, analysis_id, *, photo=None, consent=True, size=None, filename="foto.png", ctype="image/png"):
    data = {"analysis_id": analysis_id, "consent_tryon": str(consent).lower()}
    if size:
        data["size"] = size
    return client.post(
        f"{API}/tryon",
        files={"person": (filename, photo_bytes() if photo is None else photo, ctype)},
        data=data,
    )


# --------------------------------------------------------------------------- #
# Produto / health
# --------------------------------------------------------------------------- #
def test_product_exposes_flat_image_and_tryon_supported(client):
    products = {p["slug"]: p for p in client.get(f"{API}/products").json()}
    tee = products["camiseta-essential-algodao"]
    assert tee["flat_image_url"] == "/assets/flat/camiseta-essential.jpg"
    assert tee["tryon_supported"] is True
    pants = products["calca-alfaiataria-regular"]
    assert pants["flat_image_url"] == "" and pants["tryon_supported"] is False
    # Asset interno servido pela API (fonte da imagem da peca; nunca URL do usuario)
    asset = client.get(tee["flat_image_url"])
    assert asset.status_code == 200 and asset.headers["content-type"].startswith("image/jpeg")


def test_health_tryon_disabled_by_default(client, stub):
    body = client.get(f"{API}/health").json()
    assert body["status"] == "ok"
    assert body["tryon"] == {"enabled": False, "provider": "catvton", "available": False}


def test_health_tryon_enabled_reports_availability(client, stub, enabled):
    body = client.get(f"{API}/health").json()["tryon"]
    assert body == {"enabled": True, "provider": "stub", "available": True}
    assert set(body) == {"enabled", "provider", "available"}  # nada de caminhos/GPU
    stub.available = False
    tryon_service.health_cache.reset()
    assert client.get(f"{API}/tryon/status").json()["available"] is False


# --------------------------------------------------------------------------- #
# Regras de negocio
# --------------------------------------------------------------------------- #
def test_tryon_disabled_returns_controlled_error(client, stub, analysis):
    r = post_tryon(client, analysis["analysis_id"])
    assert r.status_code == 503 and r.json()["code"] == "tryon_disabled"
    assert stub.submits == 0
    # A recomendacao continua acessivel
    assert client.get(f"{API}/recommendations/{analysis['analysis_id']}").status_code == 200


def test_consent_required_blocks_before_upload(client, stub, enabled, analysis):
    r = post_tryon(client, analysis["analysis_id"], consent=False)
    assert r.status_code == 422 and r.json()["code"] == "consent_required"
    assert stub.submits == 0
    with session_factory()() as db:
        assert db.scalar(select(TryOnJob).where(TryOnJob.analysis_id == analysis["analysis_id"])) is None


def test_analysis_not_found(client, stub, enabled):
    r = post_tryon(client, "00000000000000000000000000000000")
    assert r.status_code == 404
    assert stub.submits == 0


def test_invalid_size_rejected(client, stub, enabled, analysis):
    r = post_tryon(client, analysis["analysis_id"], size="XXL")
    assert r.status_code == 422 and r.json()["code"] == "invalid_size"
    assert stub.submits == 0


def test_product_without_flat_image(client, stub, enabled):
    rec = client.post(f"{API}/recommendations", json={"sku": "CALCA-001-42", "customer": DEMO_CUSTOMER}).json()
    r = post_tryon(client, rec["analysis_id"])
    assert r.status_code == 422 and r.json()["code"] == "flat_image_unavailable"
    assert stub.submits == 0


@pytest.mark.parametrize(
    "photo,filename,ctype,status,code",
    [
        (b"", "foto.png", "image/png", 400, "invalid_photo"),
        (b"nao e imagem", "foto.png", "image/png", 400, "invalid_photo"),
        (photo_bytes(), "foto.gif", "image/gif", 415, "unsupported_photo_type"),
        (photo_bytes((100, 100)), "foto.png", "image/png", 400, "invalid_photo"),
        (b"\x89PNG" + bytes(9 * 1024 * 1024), "foto.png", "image/png", 413, "photo_too_large"),
    ],
    ids=["empty", "not_image", "gif_mime", "too_small", "too_large"],
)
def test_photo_validation(client, stub, enabled, analysis, photo, filename, ctype, status, code):
    r = post_tryon(client, analysis["analysis_id"], photo=photo, filename=filename, ctype=ctype)
    assert r.status_code == status, r.text
    assert r.json()["code"] == code
    assert stub.submits == 0


# --------------------------------------------------------------------------- #
# Provider: falhas nao quebram a recomendacao
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "exc,status,code",
    [
        (ProviderUnavailableError(), 503, "provider_unavailable"),
        (ProviderTimeoutError(), 504, "provider_timeout"),
        (ProviderBusyError(), 503, "provider_busy"),
        (ProviderOutOfMemoryError(), 503, "provider_out_of_memory"),
        (ProviderRejectedInputError(), 422, "provider_rejected_input"),
        (ProviderError(), 502, "provider_error"),
    ],
)
def test_provider_errors_are_translated_and_recorded(client, stub, enabled, analysis, exc, status, code):
    stub.fail_with = exc
    r = post_tryon(client, analysis["analysis_id"])
    assert r.status_code == status
    body = r.json()
    assert body["code"] == code and "detail" in body
    assert "Traceback" not in r.text and "cuda" not in body["detail"].lower()
    if code == "provider_busy":
        assert r.headers.get("Retry-After") and body["retry_after_seconds"]
    with session_factory()() as db:
        job = db.scalars(select(TryOnJob).where(TryOnJob.analysis_id == analysis["analysis_id"]).order_by(TryOnJob.created_at.desc())).first()
        assert job is not None and job.status == "failed" and job.error_code == code
    # Recomendacao segue disponivel e inalterada
    rec = client.get(f"{API}/recommendations/{analysis['analysis_id']}").json()
    assert rec["recommended_size"] == analysis["recommended_size"] and rec["fit_score"] == analysis["fit_score"]


def test_provider_offline_before_submit(client, stub, enabled, analysis):
    stub.available = False
    r = post_tryon(client, analysis["analysis_id"])
    assert r.status_code == 503 and r.json()["code"] == "provider_unavailable"
    assert stub.submits == 0


# --------------------------------------------------------------------------- #
# Caminho feliz, metadados, cache, imagem
# --------------------------------------------------------------------------- #
def test_completed_flow_persists_only_metadata(client, stub, enabled, analysis):
    photo = photo_bytes()
    r = post_tryon(client, analysis["analysis_id"], photo=photo)
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["status"] == "completed" and job["cached"] is False
    assert job["sku"] == "CAMISETA-001-M" and job["size"] == analysis["recommended_size"] == "M"
    assert job["provider"] == "stub" and job["duration_ms"] is not None and job["expires_at"]
    assert job["image_url"] == f"{API}/tryon/{job['job_id']}/image"
    assert "IA" in job["disclaimer"] and "medidas" in job["size_note"]
    # Provider recebeu a peca dos dados internos (imagem flat do produto) e o cloth_type da categoria
    assert stub.last_cloth_type == "upper"
    assert stub.last_garment and stub.last_garment[:2] == b"\xff\xd8"  # JPEG do asset interno
    # Foto normalizada (JPEG), nunca os bytes originais crus
    assert stub.last_person and stub.last_person[:2] == b"\xff\xd8"

    # Imagem via proxy da API (frontend nunca chama o provider)
    img = client.get(job["image_url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"
    assert Image.open(io.BytesIO(img.content)).size == (768, 1024)

    # Job consultavel
    fetched = client.get(f"{API}/tryon/{job['job_id']}").json()
    assert fetched["status"] == "completed" and fetched["recommended_size"] == "M"

    # Persistencia: somente metadados (nenhuma coluna com imagem/bytes/base64)
    with session_factory()() as db:
        columns = {c["name"] for c in inspect(db.get_bind()).get_columns("tryon_jobs")}
        assert columns == {
            "id", "created_at", "updated_at", "analysis_id", "product_id", "sku", "size", "cloth_type",
            "provider", "model_version", "status", "consent", "cache_key", "result_ref", "duration_ms",
            "error_code", "expires_at",
        }
        stored = db.get(TryOnJob, job["job_id"])
        assert stored.consent is True and stored.result_ref and len(stored.cache_key) == 64
        for value in vars(stored).values():
            assert not isinstance(value, (bytes, bytearray))
            if isinstance(value, str):
                assert len(value) < 200 and "base64" not in value


def test_cache_hit_reuses_result_without_new_inference(client, stub, enabled, analysis):
    photo = photo_bytes(color=(90, 120, 200))
    first = post_tryon(client, analysis["analysis_id"], photo=photo).json()
    second = post_tryon(client, analysis["analysis_id"], photo=photo).json()
    assert stub.submits == 1
    assert second["cached"] is True and second["job_id"] == first["job_id"]
    # Foto diferente ou tamanho diferente -> nova inferencia
    post_tryon(client, analysis["analysis_id"], photo=photo, size="L")
    post_tryon(client, analysis["analysis_id"], photo=photo_bytes(color=(1, 2, 3)))
    assert stub.submits == 3


def test_selected_size_comes_from_user_choice_not_provider(client, stub, enabled, analysis):
    r = post_tryon(client, analysis["analysis_id"], size="l")
    assert r.status_code == 200
    body = r.json()
    assert body["size"] == "L" and body["sku"] == "CAMISETA-001-L"
    assert body["recommended_size"] == "M"  # recomendacao do motor preservada


def test_expired_result_and_delete(client, stub, enabled, analysis):
    job = post_tryon(client, analysis["analysis_id"], photo=photo_bytes(color=(5, 5, 5))).json()
    # Resultado sumiu no provider -> 410 expired e status atualizado
    stub.results.clear()
    r = client.get(job["image_url"])
    assert r.status_code == 410 and r.json()["code"] == "result_expired"
    assert client.get(f"{API}/tryon/{job['job_id']}").json()["status"] == "expired"
    assert client.get(f"{API}/tryon/nao-existe/image").status_code == 404

    job2 = post_tryon(client, analysis["analysis_id"], photo=photo_bytes(color=(6, 6, 6))).json()
    assert client.delete(f"{API}/tryon/{job2['job_id']}").status_code == 204
    assert client.get(job2["image_url"]).status_code == 410


# --------------------------------------------------------------------------- #
# CatVTONProvider: traducao HTTP -> erros controlados (transporte mock, sem rede)
# --------------------------------------------------------------------------- #
def make_provider(handler, *, timeout_s=5.0) -> CatVTONProvider:
    return CatVTONProvider("http://tryon.test", timeout_s=timeout_s, transport=httpx.MockTransport(handler))


def test_provider_health_mapping():
    ok = make_provider(lambda req: httpx.Response(200, json={"status": "ok", "modelLoaded": True, "precision": "bf16", "resolution": "768x1024", "busy": False}))
    h = ok.health()
    assert h.available is True and h.model_version == "catvton-mix:bf16/768x1024"

    loading = make_provider(lambda req: httpx.Response(200, json={"status": "loading", "modelLoaded": False}))
    assert loading.health().available is False

    def offline(_req):
        raise httpx.ConnectError("refused")

    assert make_provider(offline).health().available is False


def test_provider_submit_success_and_result():
    def handler(req: httpx.Request):
        if req.url.path == "/try-on":
            assert req.method == "POST"
            body = req.read()
            assert b'name="person"; filename="person.jpg"' in body  # nome original nunca propagado
            assert b'name="cloth_type"' in body and b"upper" in body
            return httpx.Response(200, json={"status": "completed", "resultId": "abc123", "processingTimeMs": 36000,
                                             "precision": "bf16", "width": 768, "height": 1024,
                                             "expiresAt": "2026-09-20T20:20:21.137100+00:00"})
        if req.url.path == "/results/abc123":
            return httpx.Response(200, content=PNG_1x1, headers={"content-type": "image/png"})
        return httpx.Response(404, json={"code": "result_not_found", "message": "x"})

    p = make_provider(handler)
    result = p.submit(b"person", b"garment", "upper")
    assert result.result_ref == "abc123" and result.processing_ms == 36000
    assert result.model_version == "catvton-mix:bf16/768x1024" and result.expires_at.tzinfo is not None
    assert p.result_exists("abc123") and p.fetch_result("abc123") == PNG_1x1
    assert p.fetch_result("zzz") is None and p.result_exists("../etc") is False


@pytest.mark.parametrize(
    "status,code,headers,expected",
    [
        (429, "busy", {"Retry-After": "5"}, ProviderBusyError),
        (503, "cuda_out_of_memory", {}, ProviderOutOfMemoryError),
        (503, "model_not_loaded", {}, ProviderUnavailableError),
        (503, "cuda_unavailable", {}, ProviderUnavailableError),
        (400, "invalid_image", {}, ProviderRejectedInputError),
        (415, "unsupported_media_type", {}, ProviderRejectedInputError),
        (500, "inference_error", {}, ProviderError),
    ],
)
def test_provider_error_translation(status, code, headers, expected):
    p = make_provider(lambda req: httpx.Response(status, json={"code": code, "message": "interno"}, headers=headers))
    with pytest.raises(expected) as exc:
        p.submit(b"p", b"g", "upper")
    assert "interno" not in str(exc.value)  # mensagem interna do provider nao vaza
    if expected is ProviderBusyError:
        assert exc.value.retry_after == 5


def test_provider_timeout_and_offline():
    def timeout(_req):
        raise httpx.ReadTimeout("slow")

    with pytest.raises(ProviderTimeoutError):
        make_provider(timeout).submit(b"p", b"g", "upper")

    def offline(_req):
        raise httpx.ConnectError("refused")

    with pytest.raises(ProviderUnavailableError):
        make_provider(offline).submit(b"p", b"g", "upper")


def test_seed_products_flat_images_exist_on_disk(client):
    from app.services.tryon.garment_images import ASSETS_FLAT_DIR

    with session_factory()() as db:
        urls = [p.flat_image_url for p in db.scalars(select(Product)).all() if p.flat_image_url]
    assert len(urls) >= 4
    for url in urls:
        assert (ASSETS_FLAT_DIR / url.rsplit("/", 1)[-1]).exists()
