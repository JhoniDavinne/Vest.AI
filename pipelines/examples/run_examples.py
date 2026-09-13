"""Pipeline de exemplos do motor VESTE.AI.

Executa os payloads em pipelines/examples/payloads/ contra a API.

Uso (na raiz do monorepo):

    python pipelines/examples/run_examples.py
    python pipelines/examples/run_examples.py --live
    python pipelines/examples/run_examples.py --inprocess --assert

--inprocess  usa TestClient (sobe a API em memoria com SQLite + seed)
--live       chama http://localhost:8000 (ou --base)
--assert     falha se as expectativas do JSON nao forem atendidas
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PAYLOAD_DIR = Path(__file__).resolve().parent / "payloads"
DEMO_KEY = os.environ.get("VESTE_DEMO_API_KEY", "veste_demo_key_loja_parceira")


def _load_cases() -> list[dict[str, Any]]:
    cases = []
    for path in sorted(PAYLOAD_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        data["_file"] = path.name
        cases.append(data)
    return cases


def _inprocess_client():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db_url = f"sqlite:///{Path(tmp.name).as_posix()}"
    os.environ["VESTE_DATABASE_URL"] = db_url
    os.environ["VESTE_SQLITE_FALLBACK_URL"] = db_url
    os.environ["VESTE_AUTO_SEED"] = "true"
    os.environ["VESTE_AUTO_CREATE_SCHEMA"] = "true"
    sys.path.insert(0, str(ROOT / "apps" / "api"))
    from fastapi.testclient import TestClient  # noqa: PLC0415
    from app.core.database import init_engine  # noqa: PLC0415
    from app.main import app  # noqa: PLC0415
    from app.models import Base  # noqa: PLC0415
    from app.seed.run import run_seed  # noqa: PLC0415

    engine = init_engine(db_url)
    Base.metadata.create_all(engine)
    run_seed()
    return TestClient(app), tmp.name


def _live_post(base: str, payload: dict[str, Any], use_key: bool) -> tuple[int, dict[str, Any]]:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(
        f"{base.rstrip('/')}/api/v1/recommendations",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **({"X-API-Key": DEMO_KEY} if use_key else {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"detail": body}
        return exc.code, parsed


def _check(expect: dict[str, Any], body: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if "recommended_size" in expect and body.get("recommended_size") != expect["recommended_size"]:
        errors.append(f"recommended_size={body.get('recommended_size')} != {expect['recommended_size']}")
    if "recommended_size_in" in expect and body.get("recommended_size") not in expect["recommended_size_in"]:
        errors.append(f"recommended_size={body.get('recommended_size')} not in {expect['recommended_size_in']}")
    if "confidence" in expect and body.get("confidence") != expect["confidence"]:
        errors.append(f"confidence={body.get('confidence')} != {expect['confidence']}")
    if "evaluated_size" in expect and body.get("evaluated_size") != expect["evaluated_size"]:
        errors.append(f"evaluated_size={body.get('evaluated_size')} != {expect['evaluated_size']}")
    if "min_score" in expect and float(body.get("fit_score", -1)) < float(expect["min_score"]):
        errors.append(f"fit_score={body.get('fit_score')} < {expect['min_score']}")
    if "max_score" in expect and float(body.get("fit_score", 99)) > float(expect["max_score"]):
        errors.append(f"fit_score={body.get('fit_score')} > {expect['max_score']}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Pipeline de exemplos VESTE.AI")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--inprocess", action="store_true", help="API em memoria (padrao)")
    mode.add_argument("--live", action="store_true", help="Chama a API ja em execucao")
    parser.add_argument("--base", default=os.environ.get("VESTE_API_URL", "http://localhost:8000"))
    parser.add_argument("--assert", dest="do_assert", action="store_true", help="Falhar se expectativas nao baterem")
    args = parser.parse_args()

    cases = _load_cases()
    cleanup = None
    client = None
    if args.live:
        print(f"Modo live → {args.base}")
    else:
        print("Modo in-process → TestClient + SQLite + seed")
        client, cleanup = _inprocess_client()

    failed = 0
    print()
    print(f"{'caso':<42} {'tam':<6} {'score':<6} {'conf':<8} status")
    print("-" * 78)
    for case in cases:
        request = case["request"]
        use_key = bool(case.get("use_api_key"))
        if args.live:
            status, body = _live_post(args.base, request, use_key)
        else:
            headers = {"X-API-Key": DEMO_KEY} if use_key else {}
            response = client.post("/api/v1/recommendations", json=request, headers=headers)
            status = response.status_code
            body = response.json()

        size = str(body.get("recommended_size", "—"))
        score = body.get("fit_score")
        score_s = f"{score:.1f}" if isinstance(score, (int, float)) else "—"
        conf = str(body.get("confidence", "—"))
        errors = _check(case.get("expect", {}), body) if status == 200 else [f"HTTP {status} {body}"]
        ok = not errors
        if not ok:
            failed += 1
        mark = "ok" if ok else "FALHA"
        print(f"{case['name'][:42]:<42} {size:<6} {score_s:<6} {conf:<8} {mark}")
        if errors and args.do_assert:
            for err in errors:
                print(f"    → {err}")

    print("-" * 78)
    print(f"{len(cases) - failed}/{len(cases)} exemplos ok")

    if cleanup:
        try:
            Path(cleanup).unlink(missing_ok=True)
        except OSError:
            pass

    if args.do_assert and failed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
