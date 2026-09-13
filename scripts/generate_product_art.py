"""Gera ilustracoes SVG editoriais para o catalogo seed (offline, sem imagens externas).

Uso: python scripts/generate_product_art.py
Saida: apps/web/public/products/*.svg
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "public" / "products"

# Silhuetas por categoria (viewBox 0 0 400 500)
SHAPES = {
    "tshirt": "M120 90 L160 70 Q200 95 240 70 L280 90 L330 150 L285 180 L275 160 L275 430 L125 430 L125 160 L115 180 L70 150 Z",
    "shirt": "M125 85 L175 65 L200 100 L225 65 L275 85 L335 150 L290 180 L280 165 L280 440 L120 440 L120 165 L110 180 L65 150 Z M175 65 L200 130 L225 65",
    "polo": "M120 90 L165 68 L200 120 L235 68 L280 90 L330 150 L285 180 L275 160 L275 430 L125 430 L125 160 L115 180 L70 150 Z M165 68 L200 96 L235 68",
    "hoodie": "M115 100 L150 72 Q200 40 250 72 L285 100 L345 170 L295 200 L285 180 L285 445 L115 445 L115 180 L105 200 L55 170 Z M150 72 Q200 130 250 72",
    "jacket": "M110 95 L160 70 L200 110 L240 70 L290 95 L350 165 L300 195 L290 175 L290 440 L110 440 L110 175 L100 195 L50 165 Z M200 110 L200 440",
    "dress": "M150 70 L200 95 L250 70 L275 150 L255 200 L300 460 L100 460 L145 200 L125 150 Z",
    "pants": "M125 60 L275 60 L290 460 L215 460 L200 220 L185 460 L110 460 Z",
    "shorts": "M120 80 L280 80 L300 300 L212 300 L200 200 L188 300 L100 300 Z",
}

PRODUCTS = [
    ("camiseta-essential", "tshirt", "#F1EBE1", "#141416", "Camiseta Essential", "Atelier Norte"),
    ("camiseta-oversized", "tshirt", "#1B1B1F", "#F7F4EF", "Oversized Drop", "Studio Vão"),
    ("camisa-oxford", "shirt", "#DCE6F0", "#2A3A4E", "Camisa Oxford Slim", "Casa Linho"),
    ("calca-alfaiataria", "pants", "#4A4A4F", "#E9E5DF", "Calça Alfaiataria", "Casa Linho"),
    ("calca-jeans", "pants", "#2B3A5C", "#C9D3E8", "Jeans Skinny Stretch", "Denim Sul"),
    ("vestido-midi", "dress", "#C4623A", "#F7F4EF", "Vestido Midi Malha", "Maré Atelier"),
    ("jaqueta-bomber", "jacket", "#5F6B4A", "#E9E5DF", "Bomber Relaxed", "Studio Vão"),
    ("polo-piquet", "polo", "#1F2A44", "#E9E5DF", "Polo Piquet", "Atelier Norte"),
    ("moletom-canguru", "hoodie", "#9A9A9C", "#141416", "Moletom Canguru", "Studio Vão"),
    ("shorts-sarja", "shorts", "#D8C6A6", "#141416", "Shorts Sarja", "Denim Sul"),
]

BACKGROUNDS = ["#F7F4EF", "#EFE9E1", "#F3EEE7", "#EDE8E0"]


def svg(slug: str, category: str, fill: str, ink: str, name: str, brand: str, index: int) -> str:
    shape = SHAPES[category]
    bg = BACKGROUNDS[index % len(BACKGROUNDS)]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500" role="img" aria-label="{name}">
  <defs>
    <linearGradient id="bg-{slug}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{bg}"/>
      <stop offset="1" stop-color="#FFFFFF"/>
    </linearGradient>
    <linearGradient id="fab-{slug}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{fill}" stop-opacity="1"/>
      <stop offset="1" stop-color="{fill}" stop-opacity="0.82"/>
    </linearGradient>
    <filter id="shadow-{slug}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#141416" flood-opacity="0.16"/>
    </filter>
    <pattern id="grid-{slug}" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#141416" stroke-opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="400" height="500" fill="url(#bg-{slug})"/>
  <rect width="400" height="500" fill="url(#grid-{slug})"/>
  <circle cx="330" cy="90" r="120" fill="{fill}" fill-opacity="0.10"/>
  <g filter="url(#shadow-{slug})">
    <path d="{shape}" fill="url(#fab-{slug})" stroke="{ink}" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <text x="28" y="462" font-family="Georgia, serif" font-size="22" fill="#141416">{name}</text>
  <text x="28" y="484" font-family="Helvetica, Arial, sans-serif" font-size="11" letter-spacing="2" fill="#6F6B66">{brand.upper()}</text>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (slug, cat, fill, ink, name, brand) in enumerate(PRODUCTS):
        (OUT / f"{slug}.svg").write_text(svg(slug, cat, fill, ink, name, brand, i), encoding="utf-8")
    # placeholders por categoria para produtos cadastrados no Studio sem imagem
    for i, cat in enumerate(SHAPES):
        (OUT / f"placeholder-{cat}.svg").write_text(
            svg(f"ph-{cat}", cat, "#D9D3CB", "#141416", "Novo produto", "VESTE.AI Studio", i), encoding="utf-8"
        )
    print(f"{len(PRODUCTS) + len(SHAPES)} SVGs gerados em {OUT}")


if __name__ == "__main__":
    main()
