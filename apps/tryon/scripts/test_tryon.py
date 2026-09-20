"""Teste de integracao do servico local (/health, /try-on, /results).

Uso (servico ja em execucao):
    python scripts/test_tryon.py [--base http://127.0.0.1:8100] [--person P] [--garment G] [--cloth-type upper]

Passos:
  1. GET /health (exige status ok, cudaAvailable, modelLoaded)
  2. POST /try-on (pessoa + peca de exemplo do repositorio oficial)
  3. valida resposta e baixa a imagem final (PNG decodificavel, dimensoes esperadas)
  4. segunda chamada: modelo reutilizado (sem reload — health.modelLoaded permanece, tempo similar)
  5. casos de erro: arquivo vazio, imagem invalida, extensao nao suportada
  6. concorrencia: 2 requisicoes simultaneas -> uma completa, outra 429 busy (MAX_CONCURRENT_JOBS=1)
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import threading
import time
from pathlib import Path

import httpx
from PIL import Image

APP_ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = APP_ROOT / "vendor" / "CatVTON" / "resource" / "demo" / "example"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://127.0.0.1:8100")
    p.add_argument("--person", default=str(EXAMPLES / "person" / "men" / "model_5.png"))
    p.add_argument("--garment", default=str(sorted((EXAMPLES / "condition" / "upper").glob("*.jpg"))[0]))
    p.add_argument("--cloth-type", default="upper")
    p.add_argument("--out", default=str(APP_ROOT / "output" / "service_result.png"))
    p.add_argument("--skip-concurrency", action="store_true")
    return p.parse_args()


def check(cond: bool, label: str) -> None:
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        sys.exit(1)


def post_tryon(client: httpx.Client, base: str, person: bytes, garment: bytes, cloth_type: str, **form) -> httpx.Response:
    files = {
        "person": ("person.png", person, "image/png"),
        "garment": ("garment.jpg", garment, "image/jpeg"),
    }
    data = {"cloth_type": cloth_type, **{k: str(v) for k, v in form.items() if v is not None}}
    return client.post(f"{base}/try-on", files=files, data=data, timeout=600)


def main() -> None:
    args = parse_args()
    person = Path(args.person).read_bytes()
    garment = Path(args.garment).read_bytes()
    summary: dict = {}

    with httpx.Client() as client:
        # 1. health
        r = client.get(f"{args.base}/health", timeout=30)
        check(r.status_code == 200, f"GET /health -> {r.status_code}")
        health = r.json()
        print("   " + json.dumps({k: health[k] for k in ("status", "device", "cudaAvailable", "gpu", "torchVersion", "cudaVersion", "precision", "modelLoaded")}))
        check(health["cudaAvailable"] is True, "cudaAvailable == True")
        check(health["modelLoaded"] is True and health["status"] == "ok", "modelLoaded == True")
        summary["health"] = health

        # 2. try-on #1
        t0 = time.perf_counter()
        r = post_tryon(client, args.base, person, garment, args.cloth_type)
        wall1 = time.perf_counter() - t0
        check(r.status_code == 200, f"POST /try-on #1 -> {r.status_code} ({wall1:.1f}s)")
        body = r.json()
        print("   " + json.dumps({k: body[k] for k in ("status", "resultId", "processingTimeMs", "maskTimeMs", "width", "height", "precision", "peakVramMiB")}))
        check(body["status"] == "completed" and len(body["resultId"]) == 32, "resposta completed + resultId")

        # 3. resultado
        r = client.get(f"{args.base}{body['resultUrl']}", timeout=60)
        check(r.status_code == 200 and r.headers.get("content-type", "").startswith("image/png"), "GET /results/{id} -> PNG")
        img = Image.open(io.BytesIO(r.content))
        img.verify()
        img = Image.open(io.BytesIO(r.content))
        check(img.size == (body["width"], body["height"]), f"imagem valida {img.size}")
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_bytes(r.content)
        print(f"   salvo em {args.out}")
        summary["run1"] = body

        # 4. try-on #2 — reuso do modelo (sem reload)
        t0 = time.perf_counter()
        r = post_tryon(client, args.base, person, garment, args.cloth_type, seed=7)
        wall2 = time.perf_counter() - t0
        check(r.status_code == 200, f"POST /try-on #2 -> {r.status_code} ({wall2:.1f}s)")
        body2 = r.json()
        health2 = client.get(f"{args.base}/health", timeout=30).json()
        check(health2["modelLoaded"] is True, "modelo continua carregado (sem reload)")
        check(wall2 < wall1 * 1.5 + 5, f"2a chamada sem custo de reload (#1 {wall1:.1f}s · #2 {wall2:.1f}s)")
        check(body2["resultId"] != body["resultId"], "resultId distinto por chamada")
        summary["run2"] = body2

        # 5. erros de validacao
        r = client.post(f"{args.base}/try-on", files={"person": ("p.png", b"", "image/png"), "garment": ("g.jpg", garment, "image/jpeg")}, data={"cloth_type": "upper"}, timeout=60)
        check(r.status_code == 400 and r.json()["code"] == "empty_file", f"arquivo vazio -> {r.status_code} {r.json().get('code')}")
        r = client.post(f"{args.base}/try-on", files={"person": ("p.png", b"isto nao e uma imagem", "image/png"), "garment": ("g.jpg", garment, "image/jpeg")}, data={"cloth_type": "upper"}, timeout=60)
        check(r.status_code == 400 and r.json()["code"] == "invalid_image", f"imagem invalida -> {r.status_code} {r.json().get('code')}")
        r = client.post(f"{args.base}/try-on", files={"person": ("p.gif", person, "image/gif"), "garment": ("g.jpg", garment, "image/jpeg")}, data={"cloth_type": "upper"}, timeout=60)
        check(r.status_code == 415, f"MIME nao suportado -> {r.status_code} {r.json().get('code')}")
        r = client.get(f"{args.base}/results/deadbeef", timeout=10)
        check(r.status_code == 404, "resultId invalido -> 404")

        # 6. concorrencia
        if not args.skip_concurrency:
            results: dict[str, int] = {}

            def worker(name: str) -> None:
                with httpx.Client() as c:
                    rr = post_tryon(c, args.base, person, garment, args.cloth_type, steps=20)
                    results[name] = rr.status_code

            t1 = threading.Thread(target=worker, args=("a",))
            t2 = threading.Thread(target=worker, args=("b",))
            t1.start()
            time.sleep(1.5)  # garante que a primeira ja ocupou o slot
            t2.start()
            t1.join()
            t2.join()
            codes = sorted(results.values())
            check(codes == [200, 429], f"concorrencia MAX_CONCURRENT_JOBS=1 -> {codes}")
            summary["concurrency"] = codes

        # limpeza dos resultados gerados
        for rid in (body["resultId"], body2["resultId"]):
            client.delete(f"{args.base}/results/{rid}", timeout=10)

    (APP_ROOT / "output" / "service_test_report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"processing time #1: {body['processingTimeMs']} ms · #2: {body2['processingTimeMs']} ms")
    print("ALL PASS")


if __name__ == "__main__":
    main()
