"""Catalogo seed (marcas ficticias) com medidas tecnicas por tamanho.

As medidas sao geradas a partir de uma base (tamanho de referencia) e de uma
regra de gradacao por categoria, imitando tabelas tecnicas reais.
Circunferencias em cm para peito/cintura/quadril; ombro, comprimento, manga e
largura (abertura/boca) tambem em cm.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SIZE_LABELS_LETTERS = ["S", "M", "L", "XL"]
SIZE_LABELS_NUMERIC = ["38", "40", "42", "44", "46"]


def _grade(
    labels: list[str],
    base_index: int,
    base: dict[str, float | None],
    step: dict[str, float],
) -> list[dict[str, Any]]:
    sizes = []
    for i, label in enumerate(labels):
        k = i - base_index
        measures: dict[str, float | None] = {}
        for key, value in base.items():
            if value is None:
                measures[key] = None
            else:
                measures[key] = round(value + step.get(key, 0.0) * k, 1)
        sizes.append({"size_label": label, "measurements": measures})
    return sizes


TOP_STEP = {"chest": 5, "waist": 5, "hip": 5, "shoulder": 1.0, "length": 2, "sleeve": 1, "width": 2.5}
OUTER_STEP = {"chest": 6, "waist": 6, "hip": 6, "shoulder": 1.2, "length": 2, "sleeve": 1, "width": 3}
BOTTOM_STEP = {"waist": 4, "hip": 4, "length": 1, "width": 1}
DRESS_STEP = {"chest": 5, "waist": 5, "hip": 5, "shoulder": 1.0, "length": 2, "sleeve": 0.5, "width": 2.5}


def build_catalog() -> list[dict[str, Any]]:
    return [
        {
            "sku_prefix": "CAMISETA-001",
            "slug": "camiseta-essential-algodao",
            "name": "Camiseta Essential Algodão",
            "brand": "Atelier Norte",
            "category": "tshirt",
            "audience": "unissex",
            "color": "Off-white",
            "price_cents": 8990,
            "description": (
                "Camiseta de algodão penteado com toque macio e caimento regular. "
                "Gola careca reforçada e costura dupla na barra. Peça-chave do guarda-roupa."
            ),
            "modeling": "regular",
            "fabric": "Malha de algodão penteado 30.1",
            "composition": "100% algodão",
            "elasticity_pct": 5,
            "care": "Lavar à máquina em água fria. Não usar alvejante.",
            "image": "camiseta-essential.svg",
            "sizes": _grade(
                SIZE_LABELS_LETTERS, 1,
                {"chest": 111, "waist": 111, "hip": 107, "shoulder": 45, "length": 71, "sleeve": 21, "width": 55.5},
                TOP_STEP,
            ),
        },
        {
            "sku_prefix": "CAMISETA-002",
            "slug": "camiseta-oversized-drop",
            "name": "Camiseta Oversized Drop Shoulder",
            "brand": "Studio Vão",
            "category": "tshirt",
            "audience": "unissex",
            "color": "Preto",
            "price_cents": 12990,
            "description": (
                "Modelagem oversized com ombro caído e comprimento alongado. "
                "Malha encorpada que mantém a estrutura da peça."
            ),
            "modeling": "oversized",
            "fabric": "Malha de algodão e viscose 260 g/m²",
            "composition": "70% algodão, 30% viscose",
            "elasticity_pct": 6,
            "care": "Lavar do avesso. Secar à sombra.",
            "image": "camiseta-oversized.svg",
            "sizes": _grade(
                SIZE_LABELS_LETTERS, 1,
                {"chest": 124, "waist": 124, "hip": 122, "shoulder": 52, "length": 76, "sleeve": 24, "width": 62},
                {**TOP_STEP, "chest": 6, "waist": 6, "hip": 6, "shoulder": 1.5},
            ),
        },
        {
            "sku_prefix": "CAMISA-001",
            "slug": "camisa-oxford-slim",
            "name": "Camisa Oxford Slim",
            "brand": "Casa Linho",
            "category": "shirt",
            "audience": "masculino",
            "color": "Azul claro",
            "price_cents": 24990,
            "description": (
                "Camisa em tecido oxford com modelagem slim, colarinho estruturado e "
                "punhos ajustáveis. Ideal para compor looks de trabalho e ocasiões casuais."
            ),
            "modeling": "slim",
            "fabric": "Oxford de algodão",
            "composition": "100% algodão",
            "elasticity_pct": 2,
            "care": "Passar em temperatura média.",
            "image": "camisa-oxford.svg",
            "sizes": _grade(
                SIZE_LABELS_LETTERS, 1,
                {"chest": 108, "waist": 100, "hip": 106, "shoulder": 45.5, "length": 75, "sleeve": 64, "width": 54},
                TOP_STEP,
            ),
        },
        {
            "sku_prefix": "CALCA-001",
            "slug": "calca-alfaiataria-regular",
            "name": "Calça Alfaiataria Regular",
            "brand": "Casa Linho",
            "category": "pants",
            "audience": "unissex",
            "color": "Cinza grafite",
            "price_cents": 32990,
            "description": (
                "Calça de alfaiataria com cintura média, pregas frontais discretas e caimento reto. "
                "Tecido com leve elastano para conforto ao longo do dia."
            ),
            "modeling": "regular",
            "fabric": "Alfaiataria com elastano",
            "composition": "64% poliéster, 33% viscose, 3% elastano",
            "elasticity_pct": 6,
            "care": "Lavar a seco ou à mão.",
            "image": "calca-alfaiataria.svg",
            "sizes": _grade(
                SIZE_LABELS_NUMERIC, 2,
                {"chest": None, "waist": 91, "hip": 106, "shoulder": None, "length": 108, "sleeve": None, "width": 40},
                BOTTOM_STEP,
            ),
        },
        {
            "sku_prefix": "CALCA-002",
            "slug": "calca-jeans-skinny-stretch",
            "name": "Calça Jeans Skinny Stretch",
            "brand": "Denim Sul",
            "category": "pants",
            "audience": "feminino",
            "color": "Índigo escuro",
            "price_cents": 27990,
            "description": (
                "Jeans skinny com alto teor de elastano, cintura alta e lavagem escura. "
                "Acompanha o movimento do corpo sem perder a forma."
            ),
            "modeling": "slim",
            "fabric": "Denim stretch 10 oz",
            "composition": "92% algodão, 6% poliéster, 2% elastano",
            "elasticity_pct": 14,
            "care": "Lavar do avesso em água fria.",
            "image": "calca-jeans.svg",
            "sizes": _grade(
                ["36", "38", "40", "42", "44"], 2,
                {"chest": None, "waist": 78, "hip": 100, "shoulder": None, "length": 104, "sleeve": None, "width": 28},
                BOTTOM_STEP,
            ),
        },
        {
            "sku_prefix": "VESTIDO-001",
            "slug": "vestido-midi-malha",
            "name": "Vestido Midi Malha Canelada",
            "brand": "Maré Atelier",
            "category": "dress",
            "audience": "feminino",
            "color": "Terracota",
            "price_cents": 35990,
            "description": (
                "Vestido midi em malha canelada com elasticidade, decote redondo e fenda lateral. "
                "Modelagem regular que acompanha as curvas sem marcar."
            ),
            "modeling": "regular",
            "fabric": "Malha canelada viscose",
            "composition": "92% viscose, 8% elastano",
            "elasticity_pct": 16,
            "care": "Lavar à mão. Não torcer.",
            "image": "vestido-midi.svg",
            "sizes": _grade(
                SIZE_LABELS_LETTERS, 1,
                {"chest": 96, "waist": 80, "hip": 102, "shoulder": 38, "length": 118, "sleeve": 12, "width": 48},
                DRESS_STEP,
            ),
        },
        {
            "sku_prefix": "JAQUETA-001",
            "slug": "jaqueta-bomber-relaxed",
            "name": "Jaqueta Bomber Relaxed",
            "brand": "Studio Vão",
            "category": "jacket",
            "audience": "unissex",
            "color": "Verde oliva",
            "price_cents": 45990,
            "description": (
                "Bomber em nylon matte com forro leve, punhos e barra em ribana. "
                "Modelagem relaxed pensada para sobreposição."
            ),
            "modeling": "relaxed",
            "fabric": "Nylon matte com forro",
            "composition": "100% poliamida",
            "elasticity_pct": 1,
            "care": "Lavar à máquina em ciclo delicado.",
            "image": "jaqueta-bomber.svg",
            "sizes": _grade(
                SIZE_LABELS_LETTERS, 1,
                {"chest": 122, "waist": 116, "hip": 112, "shoulder": 49, "length": 68, "sleeve": 63, "width": 61},
                OUTER_STEP,
            ),
        },
        {
            "sku_prefix": "POLO-001",
            "slug": "polo-piquet-regular",
            "name": "Polo Piquet Regular",
            "brand": "Atelier Norte",
            "category": "polo",
            "audience": "masculino",
            "color": "Marinho",
            "price_cents": 15990,
            "description": (
                "Polo em piquet de algodão com gola e punhos em retilínea. "
                "Caimento regular, comprimento clássico."
            ),
            "modeling": "regular",
            "fabric": "Piquet de algodão",
            "composition": "100% algodão",
            "elasticity_pct": 4,
            "care": "Lavar à máquina em água fria.",
            "image": "polo-piquet.svg",
            "sizes": _grade(
                SIZE_LABELS_LETTERS, 1,
                {"chest": 110, "waist": 106, "hip": 108, "shoulder": 45.5, "length": 72, "sleeve": 22, "width": 55},
                TOP_STEP,
            ),
        },
        {
            "sku_prefix": "MOLETOM-001",
            "slug": "moletom-canguru-oversized",
            "name": "Moletom Canguru Oversized",
            "brand": "Studio Vão",
            "category": "hoodie",
            "audience": "unissex",
            "color": "Cinza mescla",
            "price_cents": 22990,
            "description": (
                "Moletom felpado com capuz duplo, bolso canguru e modelagem oversized. "
                "Toque macio e estrutura encorpada."
            ),
            "modeling": "oversized",
            "fabric": "Moletom felpado 320 g/m²",
            "composition": "80% algodão, 20% poliéster",
            "elasticity_pct": 6,
            "care": "Lavar do avesso. Não usar secadora.",
            "image": "moletom-canguru.svg",
            "sizes": _grade(
                SIZE_LABELS_LETTERS, 1,
                {"chest": 128, "waist": 122, "hip": 118, "shoulder": 54, "length": 72, "sleeve": 60, "width": 64},
                OUTER_STEP,
            ),
        },
        {
            "sku_prefix": "SHORTS-001",
            "slug": "shorts-sarja-relaxed",
            "name": "Shorts Sarja Relaxed",
            "brand": "Denim Sul",
            "category": "shorts",
            "audience": "unissex",
            "color": "Bege areia",
            "price_cents": 14990,
            "description": (
                "Shorts em sarja leve com cós elástico nas costas e cordão. "
                "Modelagem relaxed com comprimento acima do joelho."
            ),
            "modeling": "relaxed",
            "fabric": "Sarja de algodão leve",
            "composition": "98% algodão, 2% elastano",
            "elasticity_pct": 5,
            "care": "Lavar à máquina em água fria.",
            "image": "shorts-sarja.svg",
            "sizes": _grade(
                SIZE_LABELS_NUMERIC, 2,
                {"chest": None, "waist": 92, "hip": 110, "shoulder": None, "length": 50, "sleeve": None, "width": 58},
                BOTTOM_STEP,
            ),
        },
    ]


def export_json(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_catalog(), ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[4]
    export_json(root / "database" / "seed" / "catalog.json")
    print("catalog.json exportado.")
