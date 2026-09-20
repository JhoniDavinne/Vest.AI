#!/usr/bin/env python3
"""Gera GLB placeholder (corpo neutro + 8 categorias) para o provador 3D VESTE.AI."""

from __future__ import annotations

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "apps" / "web" / "public" / "models"

_CUBE_POSITIONS = [
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
]
_CUBE_INDICES = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 8, 9, 10, 8, 10, 11,
    12, 14, 13, 12, 15, 14, 16, 17, 18, 16, 18, 19, 20, 22, 21, 20, 23, 22,
]
_CUBE_NORMALS = [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
]
VERTEX_COUNT = len(_CUBE_POSITIONS) // 3
INDEX_COUNT = len(_CUBE_INDICES)

BODY_PARTS: list[tuple[str, tuple[float, float, float], tuple[float, float, float]]] = [
    ("Head", (0.0, 1.62, 0.0), (0.22, 0.24, 0.22)),
    ("Shoulder", (0.0, 1.38, 0.0), (0.48, 0.12, 0.28)),
    ("Chest", (0.0, 1.18, 0.0), (0.42, 0.28, 0.26)),
    ("Waist", (0.0, 0.92, 0.0), (0.34, 0.18, 0.24)),
    ("Hip", (0.0, 0.72, 0.0), (0.4, 0.2, 0.28)),
    ("Length", (0.0, 0.45, 0.0), (0.36, 0.5, 0.24)),
]

GARMENT_SHAPES: dict[str, tuple[tuple[float, float, float], tuple[float, float, float]]] = {
    "tshirt": ((0.0, 1.15, 0.02), (0.46, 0.55, 0.3)),
    "shirt": ((0.0, 1.12, 0.02), (0.48, 0.62, 0.28)),
    "polo": ((0.0, 1.14, 0.02), (0.45, 0.52, 0.29)),
    "hoodie": ((0.0, 1.1, 0.02), (0.52, 0.68, 0.34)),
    "jacket": ((0.0, 1.08, 0.03), (0.54, 0.72, 0.36)),
    "dress": ((0.0, 0.85, 0.02), (0.44, 1.05, 0.3)),
    "pants": ((0.0, 0.42, 0.02), (0.38, 0.88, 0.28)),
    "shorts": ((0.0, 0.62, 0.02), (0.4, 0.38, 0.3)),
}


def _align4(value: int) -> int:
    return (value + 3) & ~3


def _write_glb(path: Path, parts: list[tuple[str, tuple[float, float, float], tuple[float, float, float]]]) -> None:
    meshes: list[dict] = []
    nodes: list[dict] = []
    accessors: list[dict] = []
    buffer_views: list[dict] = []
    bin_blob = bytearray()
    offset = 0

    for name, translation, scale in parts:
        positions = struct.pack(f"<{len(_CUBE_POSITIONS)}f", *_CUBE_POSITIONS)
        normals = struct.pack(f"<{len(_CUBE_NORMALS)}f", *_CUBE_NORMALS)
        indices = struct.pack(f"<{len(_CUBE_INDICES)}H", *_CUBE_INDICES)

        pos_off = offset
        norm_off = pos_off + len(positions)
        idx_off = norm_off + len(normals)

        pos_bv = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": pos_off, "byteLength": len(positions), "target": 34962})
        norm_bv = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": norm_off, "byteLength": len(normals), "target": 34962})
        idx_bv = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": idx_off, "byteLength": len(indices), "target": 34963})

        pos_acc = len(accessors)
        accessors.append(
            {
                "bufferView": pos_bv,
                "componentType": 5126,
                "count": VERTEX_COUNT,
                "type": "VEC3",
                "min": [-0.5, -0.5, -0.5],
                "max": [0.5, 0.5, 0.5],
            }
        )
        accessors.append({"bufferView": norm_bv, "componentType": 5126, "count": VERTEX_COUNT, "type": "VEC3"})
        accessors.append({"bufferView": idx_bv, "componentType": 5123, "count": INDEX_COUNT, "type": "SCALAR"})

        mesh_idx = len(meshes)
        meshes.append(
            {
                "name": name,
                "primitives": [
                    {"attributes": {"POSITION": pos_acc, "NORMAL": pos_acc + 1}, "indices": pos_acc + 2}
                ],
            }
        )
        nodes.append(
            {
                "name": name,
                "mesh": mesh_idx,
                "translation": list(translation),
                "scale": list(scale),
            }
        )

        bin_blob.extend(positions)
        bin_blob.extend(normals)
        bin_blob.extend(indices)
        offset = _align4(len(bin_blob))

    while len(bin_blob) < offset:
        bin_blob.append(0)

    gltf = {
        "asset": {"version": "2.0", "generator": "VESTE.AI generate_3d_models.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(bin_blob)}],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - len(json_bytes) % 4) % 4
    json_bytes += b" " * json_pad
    bin_pad = (4 - len(bin_blob) % 4) % 4
    bin_bytes = bytes(bin_blob) + (b"\x00" * bin_pad)

    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    header = struct.pack("<4sII", b"glTF", 2, total)
    json_chunk = struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
    bin_chunk = struct.pack("<I4s", len(bin_bytes), b"BIN\x00") + bin_bytes
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + json_chunk + bin_chunk)


def main() -> None:
    _write_glb(MODELS / "body" / "base-male.glb", BODY_PARTS)
    for category, (translation, scale) in GARMENT_SHAPES.items():
        _write_glb(MODELS / "garments" / f"{category}.glb", [(category, translation, scale)])
    # Manifest v2 (ver packages/fit-preview-3d/src/manifest.ts). Assets gerados aqui
    # sao SEMPRE placeholder: o provador exibe a silhueta estilizada enquanto
    # `placeholder` for true.
    morph_axes = {
        "height": ("height_plus", "height_minus"),
        "chest": ("chest_plus", "chest_minus"),
        "waist": ("waist_plus", "waist_minus"),
        "hip": ("hip_plus", "hip_minus"),
        "shoulder": ("shoulder_plus", "shoulder_minus"),
        "torsoLeg": ("torso_plus", "torso_minus"),
    }
    manifest = {
        "version": 2,
        "avatar": {
            "url": "body/base-male.glb",
            "placeholder": True,
            "morphTargets": {axis: {"plus": plus, "minus": minus} for axis, (plus, minus) in morph_axes.items()},
        },
        "garments": {k: {"url": f"garments/{k}.glb", "placeholder": True} for k in GARMENT_SHAPES},
        "regions": ["Chest", "Waist", "Hip", "Shoulder", "Length"],
        "note": (
            "Assets placeholder (cubos low-poly). Enquanto placeholder=true a cena usa a silhueta "
            "estilizada. Substitua por GLB em escala metrica (metros, Y para cima, pes em y=0) e "
            "marque placeholder=false."
        ),
    }
    avatar_real = MODELS / "avatar" / "avatar_base.glb"
    if avatar_real.exists():
        manifest["avatar"] = {
            "url": "avatar/avatar_base.glb",
            "placeholder": False,
            "type": "human",
            "baseMeasurements": {
                "height": 175,
                "chest": 96,
                "waist": 82,
                "hips": 98,
                "shoulders": 44,
                "weight": 72,
            },
        }
        manifest["avatars"] = {"default": dict(manifest["avatar"])}
        manifest["note"] = (
            "Avatar humano GLB CC0 em avatar/avatar_base.glb. "
            "Camiseta real em garments/tshirt_basic.glb quando presente; demais pecas usam GarmentPrimitive."
        )
    tshirt_real = MODELS / "garments" / "tshirt_basic.glb"
    if tshirt_real.exists():
        manifest["garments"]["tshirt"] = {
            "url": "garments/tshirt_basic.glb",
            "placeholder": False,
            "type": "tshirt",
            "baseSize": "M",
            "baseMeasurements": {"chest": 111, "waist": 111, "length": 71, "shoulder": 45},
        }
    (MODELS / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Gerados {len(BODY_PARTS)} segmentos corporais + {len(GARMENT_SHAPES)} pecas em {MODELS}")


if __name__ == "__main__":
    main()
