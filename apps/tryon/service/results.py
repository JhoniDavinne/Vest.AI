"""Armazenamento temporario de resultados (PNG) com TTL. Nunca guarda a foto da pessoa."""

from __future__ import annotations

import logging
import re
import time
import uuid
from pathlib import Path

from PIL import Image

logger = logging.getLogger("tryon.results")

RESULT_ID_RE = re.compile(r"^[0-9a-f]{32}$")


class ResultStore:
    def __init__(self, root: Path, ttl_seconds: int) -> None:
        self.root = root
        self.ttl = ttl_seconds
        self.root.mkdir(parents=True, exist_ok=True)

    def new_id(self) -> str:
        return uuid.uuid4().hex

    def path_for(self, result_id: str) -> Path | None:
        if not RESULT_ID_RE.match(result_id):
            return None
        return self.root / f"{result_id}.png"

    def save(self, image: Image.Image) -> tuple[str, float]:
        result_id = self.new_id()
        path = self.root / f"{result_id}.png"
        image.save(path, format="PNG")
        expires_at = time.time() + self.ttl
        return result_id, expires_at

    def get(self, result_id: str) -> Path | None:
        path = self.path_for(result_id)
        if path is None or not path.exists():
            return None
        if time.time() - path.stat().st_mtime > self.ttl:
            self._remove(path)
            return None
        return path

    def delete(self, result_id: str) -> bool:
        path = self.path_for(result_id)
        if path is None or not path.exists():
            return False
        self._remove(path)
        return True

    def sweep(self) -> int:
        """Remove resultados expirados. Barato; chamado a cada requisicao."""
        removed = 0
        now = time.time()
        for path in self.root.glob("*.png"):
            try:
                if now - path.stat().st_mtime > self.ttl:
                    self._remove(path)
                    removed += 1
            except OSError:
                pass
        if removed:
            logger.info("Resultados expirados removidos: %d", removed)
        return removed

    @staticmethod
    def _remove(path: Path) -> None:
        try:
            path.unlink()
        except OSError:
            pass
