"""Orquestra os testes do MVP: motor, API, widget e pipeline de exemplos.

Uso (na raiz do monorepo):

    python pipelines/tests/run_all.py
    python pipelines/tests/run_all.py --skip-widget
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run(title: str, command: list[str], cwd: Path | None = None) -> int:
    print()
    print("=" * 72)
    print(title)
    print(" ".join(command))
    print("=" * 72)
    completed = subprocess.run(command, cwd=str(cwd or ROOT), check=False)
    return completed.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Pipeline de testes VESTE.AI")
    parser.add_argument("--skip-widget", action="store_true")
    parser.add_argument("--skip-examples", action="store_true")
    args = parser.parse_args()

    python = sys.executable
    failures = 0

    api_dir = ROOT / "apps" / "api"
    failures += run("Testes do motor e da API", [python, "-m", "pytest"], cwd=api_dir)

    if not args.skip_examples:
        failures += run(
            "Pipeline de exemplos (in-process + assert)",
            [python, str(ROOT / "pipelines" / "examples" / "run_examples.py"), "--inprocess", "--assert"],
        )

    npm = shutil.which("npm")
    if not args.skip_widget and npm:
        failures += run("Testes do widget", [npm, "run", "test:widget"], cwd=ROOT)
    elif not args.skip_widget:
        print("npm nao encontrado — pulando testes do widget")

    print()
    if failures:
        print(f"Pipeline de testes FALHOU (codigo acumulado {failures}).")
        return 1
    print("Pipeline de testes OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
