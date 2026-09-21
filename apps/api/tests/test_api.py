"""Testes de integracao da API v1 (SQLite + seed real)."""

from __future__ import annotations

import io

from PIL import Image, ImageDraw

from .conftest import DEMO_CUSTOMER

API = "/api/v1"
DEMO_KEY = "veste_demo_key_loja_parceira"


def test_health(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["products"] >= 8


def test_openapi_available(client):
    r = client.get(f"{API}/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    for expected in ("/api/v1/products", "/api/v1/products/{product_id}", "/api/v1/products/{product_id}/sizes",
                     "/api/v1/recommendations", "/api/v1/feedback"):
        assert expected in paths


def test_catalog_products_use_real_photos(client):
    products = client.get(f"{API}/products").json()
    camiseta = next(p for p in products if p["slug"] == "camiseta-essential-algodao")
    assert camiseta["image_url"].endswith(".jpg")


def test_product_detail_includes_images_gallery(client):
    detail = client.get(f"{API}/products/camiseta-essential-algodao").json()
    assert detail["image_url"]
    assert isinstance(detail["images"], list)
    assert detail["images"][0] == detail["image_url"]


def test_update_product_images(client):
    product = client.get(f"{API}/products/camiseta-essential-algodao").json()
    urls = [product["image_url"], "/products/camiseta-oversized.jpg"]
    updated = client.patch(
        f"{API}/products/{product['id']}/images",
        json={"images": urls},
        headers={"X-API-Key": DEMO_KEY},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["images"] == urls
    assert body["image_url"] == urls[0]


def test_upload_product_image(client):
    img = Image.new("RGB", (400, 500), (240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    r = client.post(
        f"{API}/products/upload-image",
        files={"file": ("peca.jpg", buf.getvalue(), "image/jpeg")},
        headers={"X-API-Key": DEMO_KEY},
    )
    assert r.status_code == 201
    assert r.json()["image_url"].startswith("/products/uploads/")


def test_list_products_and_sizes(client):
    r = client.get(f"{API}/products")
    assert r.status_code == 200
    products = r.json()
    assert 8 <= len(products) <= 12
    categories = {p["category"] for p in products}
    assert {"tshirt", "shirt", "pants", "dress", "jacket", "polo", "hoodie", "shorts"} <= categories

    first = products[0]
    detail = client.get(f"{API}/products/{first['slug']}")
    assert detail.status_code == 200
    assert detail.json()["sizes"]

    sizes = client.get(f"{API}/products/{first['id']}/sizes")
    assert sizes.status_code == 200
    assert all("measurements" in s for s in sizes.json())


def test_product_not_found(client):
    assert client.get(f"{API}/products/nao-existe").status_code == 404


def test_delete_product(client):
    created = client.post(
        f"{API}/products",
        json={
            "name": "Produto Temporario",
            "brand": "Teste",
            "category": "tshirt",
            "audience": "unissex",
            "description": "Item para exclusao",
            "color": "Branco",
            "price_cents": 9990,
            "modeling": "regular",
            "fabric": "Algodao",
            "composition": "100% algodao",
            "elasticity_pct": 3,
            "care": "Lavar a seco",
            "sizes": [
                {
                    "size_label": "M",
                    "stock": 5,
                    "measurements": {"chest": 100, "waist": 96, "hip": 98, "length": 70},
                }
            ],
        },
        headers={"X-API-Key": DEMO_KEY},
    )
    assert created.status_code == 201
    product = created.json()

    deleted = client.delete(f"{API}/products/{product['id']}", headers={"X-API-Key": DEMO_KEY})
    assert deleted.status_code == 204

    assert client.get(f"{API}/products/{product['slug']}").status_code == 404
    slugs = {p["slug"] for p in client.get(f"{API}/products").json()}
    assert product["slug"] not in slugs


def test_recommendation_demo_payload(client):
    payload = {"sku": "CAMISETA-001-M", "customer": DEMO_CUSTOMER, "fit_preference": "regular"}
    r = client.post(f"{API}/recommendations", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["recommended_size"] == "M"
    assert 8.5 <= body["fit_score"] <= 9.0
    assert body["confidence"] == "medium"
    assert body["analysis_id"]
    assert {c["size"] for c in body["comparison"]} == {"S", "M", "L", "XL"}
    assert sum(1 for c in body["comparison"] if c["recommended"]) == 1
    assert set(body["regional_analysis"]) >= {"chest", "waist", "hip", "shoulder"}
    assert body["fit_preview"]
    assert body["fit_preview"]["garment"]["evaluatedSize"] == "M"
    assert "disclaimer" in body["fit_preview"]


def test_recommendation_other_size_changes_score(client):
    m = client.post(f"{API}/recommendations", json={"sku": "CAMISETA-001-M", "customer": DEMO_CUSTOMER}).json()
    lg = client.post(f"{API}/recommendations", json={"sku": "CAMISETA-001-L", "customer": DEMO_CUSTOMER}).json()
    assert m["fit_score"] != lg["fit_score"]
    assert lg["recommended_size"] == "M"
    assert lg["evaluated_size"] == "L"


def test_recommendation_with_api_key_is_attributed(client):
    r = client.post(
        f"{API}/recommendations",
        json={"sku": "POLO-001-M", "customer": DEMO_CUSTOMER, "channel": "widget"},
        headers={"X-API-Key": DEMO_KEY},
    )
    assert r.status_code == 200
    dash = client.get(f"{API}/companies/me", headers={"X-API-Key": DEMO_KEY})
    assert dash.status_code == 200
    assert dash.json()["widget_calls_count"] >= 1


def test_companies_me_requires_key(client):
    assert client.get(f"{API}/companies/me").status_code == 401
    assert client.get(f"{API}/companies/me", headers={"X-API-Key": "invalida"}).status_code == 401


def test_recommendation_requires_target_and_body(client):
    assert client.post(f"{API}/recommendations", json={"customer": DEMO_CUSTOMER}).status_code == 422
    assert client.post(f"{API}/recommendations", json={"sku": "CAMISETA-001-M"}).status_code == 422
    assert client.post(f"{API}/recommendations", json={"sku": "NAO-EXISTE", "customer": DEMO_CUSTOMER}).status_code == 404


def test_user_flow_persists_measurements_and_uses_profile(client):
    r = client.post(
        f"{API}/users",
        json={"name": "Teste Banca", "fit_preference": "loose", "photo_consent": False, "measurements": DEMO_CUSTOMER},
    )
    assert r.status_code == 201
    user = r.json()
    assert user["measurements"]["chest"] == 102

    fetched = client.get(f"{API}/users/{user['id']}").json()
    assert fetched["fit_preference"] == "loose"

    updated = client.put(f"{API}/users/{user['id']}/measurements", json={**DEMO_CUSTOMER, "chest": 104})
    assert updated.status_code == 200
    assert client.get(f"{API}/users/{user['id']}").json()["measurements"]["chest"] == 104

    rec = client.post(f"{API}/recommendations", json={"sku": "CAMISETA-001-M", "user_id": user["id"], "channel": "web"})
    assert rec.status_code == 200
    assert rec.json()["confidence"] == "medium"

    stored = client.get(f"{API}/recommendations/{rec.json()['analysis_id']}")
    assert stored.status_code == 200
    assert stored.json()["fit_score"] == rec.json()["fit_score"]


def _synthetic_photo() -> bytes:
    img = Image.new("RGB", (300, 600), (235, 235, 235))
    d = ImageDraw.Draw(img)
    d.ellipse((125, 20, 175, 80), fill=(60, 60, 60))           # cabeca
    d.rectangle((90, 90, 210, 300), fill=(40, 40, 40))         # tronco
    d.rectangle((100, 300, 200, 560), fill=(40, 40, 40))       # pernas
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_photo_upload_requires_consent_and_returns_proportions(client):
    user = client.post(
        f"{API}/users", json={"name": "Foto", "measurements": DEMO_CUSTOMER, "photo_consent": True}
    ).json()
    no_consent = client.post(
        f"{API}/users/{user['id']}/photo",
        files={"file": ("foto.png", _synthetic_photo(), "image/png")},
        data={"consent": "false"},
    )
    assert no_consent.status_code == 422

    ok = client.post(
        f"{API}/users/{user['id']}/photo",
        files={"file": ("foto.png", _synthetic_photo(), "image/png")},
        data={"consent": "true"},
    )
    assert ok.status_code == 201
    photo = ok.json()
    assert photo["source"] in {"heuristic", "mediapipe", "unavailable"}
    assert "experimental" in photo["message"].lower() or photo["status"] == "unavailable"

    rec = client.post(f"{API}/recommendations", json={"sku": "CAMISETA-001-M", "user_id": user["id"]}).json()
    if photo["status"] == "completed":
        assert rec["visual_used"] is True
        assert rec["confidence"] in {"high", "medium"}
    else:
        assert rec["visual_used"] is False


def test_invalid_photo_does_not_break_flow(client):
    user = client.post(f"{API}/users", json={"name": "Foto ruim", "measurements": DEMO_CUSTOMER}).json()
    r = client.post(
        f"{API}/users/{user['id']}/photo",
        files={"file": ("x.txt", b"nao e imagem", "text/plain")},
        data={"consent": "true"},
    )
    assert r.status_code == 201
    assert r.json()["status"] == "unavailable"
    rec = client.post(f"{API}/recommendations", json={"sku": "CAMISETA-001-M", "user_id": user["id"]})
    assert rec.status_code == 200
    assert rec.json()["visual_used"] is False


def test_feedback(client):
    rec = client.post(f"{API}/recommendations", json={"sku": "CAMISA-001-M", "customer": DEMO_CUSTOMER}).json()
    fb = client.post(
        f"{API}/feedback",
        json={"analysis_id": rec["analysis_id"], "fit_rating": "good", "followed_recommendation": True},
    )
    assert fb.status_code == 201
    dup = client.post(f"{API}/feedback", json={"analysis_id": rec["analysis_id"], "fit_rating": "good"})
    assert dup.status_code == 422


def test_create_product_and_recommend(client):
    payload = {
        "name": "Camiseta Teste Studio",
        "brand": "Marca Teste",
        "category": "tshirt",
        "modeling": "regular",
        "fabric": "Malha",
        "composition": "100% algodao",
        "elasticity_pct": 5,
        "sizes": [
            {"size_label": "M", "sku": "TESTE-STUDIO-M", "measurements": {"chest": 110, "waist": 110, "hip": 108, "shoulder": 45, "length": 71}},
            {"size_label": "L", "sku": "TESTE-STUDIO-L", "measurements": {"chest": 116, "waist": 116, "hip": 114, "shoulder": 46.5, "length": 73}},
        ],
    }
    r = client.post(f"{API}/products", json=payload, headers={"X-API-Key": DEMO_KEY})
    assert r.status_code == 201
    product = r.json()
    assert product["available_sizes"] == ["M", "L"]
    rec = client.post(f"{API}/recommendations", json={"product_id": product["id"], "customer": DEMO_CUSTOMER})
    assert rec.status_code == 200
    assert rec.json()["recommended_size"] in {"M", "L"}


def test_metrics_dashboard(client):
    r = client.get(f"{API}/metrics/dashboard")
    assert r.status_code == 200
    m = r.json()
    assert "simulados" in m["disclaimer"].lower()
    assert m["total_analyses"] >= 300
    assert m["most_recommended_size"]
    assert 0 < m["average_score"] <= 10
    assert m["size_distribution"]
    assert m["daily_series"]
    assert "relative_reduction" in m["return_reduction_potential"]


def test_engine_config_endpoint(client):
    r = client.get(f"{API}/engine/config")
    assert r.status_code == 200
    weights = {c["key"]: c["weight"] for c in r.json()["components"]}
    assert weights == {"measurements": 0.4, "modeling": 0.2, "elasticity": 0.15, "visual_proportion": 0.15, "preference": 0.1}
