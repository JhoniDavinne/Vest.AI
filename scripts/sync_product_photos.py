"""Baixa fotos reais de roupas (Pexels) para apps/web/public/products/."""

from __future__ import annotations

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "apps" / "web" / "public" / "products"

# Fotos reais (Pexels, uso editorial/demo).
DOWNLOADS: dict[str, str] = {
    "camiseta-essential.jpg": "https://images.pexels.com/photos/7671166/pexels-photo-7671166.jpeg?auto=compress&cs=tinysrgb&w=900",
    "camiseta-oversized.jpg": "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=900",
    "camisa-oxford.jpg": "https://images.pexels.com/photos/297933/pexels-photo-297933.jpeg?auto=compress&cs=tinysrgb&w=900",
    "calca-alfaiataria.jpg": "https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=900",
    "calca-jeans.jpg": "https://images.pexels.com/photos/1541090/pexels-photo-1541090.jpeg?auto=compress&cs=tinysrgb&w=900",
    "vestido-midi.jpg": "https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=900",
    "jaqueta-bomber.jpg": "https://images.pexels.com/photos/1124468/pexels-photo-1124468.jpeg?auto=compress&cs=tinysrgb&w=900",
    "polo-piquet.jpg": "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=900",
    "moletom-canguru.jpg": "https://images.pexels.com/photos/6311474/pexels-photo-6311474.jpeg?auto=compress&cs=tinysrgb&w=900",
    "shorts-sarja.jpg": "https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=900",
}


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, url in DOWNLOADS.items():
        dest = TARGET / name
        print(f"download {name}...")
        req = urllib.request.Request(url, headers={"User-Agent": "VESTE.AI/1.0"})
        with urllib.request.urlopen(req, timeout=60) as response:
            dest.write_bytes(response.read())
    print(f"OK — {len(DOWNLOADS)} imagens em {TARGET}")


if __name__ == "__main__":
    main()
