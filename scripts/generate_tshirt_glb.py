#!/usr/bin/env python3
"""Gera uma camiseta GLB original (casca em T, oca) para o provador 3D VESTE.AI.

Nao e BoxGeometry, cubo, paralelepipedo nem tubo eliptico solido.
Silhueta em T reconhecivel: gola, ombros, mangas curtas, torso, barra.
Frente e costas sao superficies separadas; o interior fica oco (casca).

Unidades: metros, Y para cima, pes do avatar em y=0.
Apos orientar o avatar_base.glb para a camera: largura em X, profundidade em Z,
frente em +Z. A peca e posicionada relativamente a esse corpo
(altura ~1.945 m, espessura ~0.28 m, ombros ~0.44 m).

Licenca: geometria original, CC0 1.0.
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "apps" / "web" / "public" / "models" / "garments" / "tshirt_basic.glb"

# Avatar apos pes em y=0 (~1.945 m). Fracoes antropometricas do torso.
HEM_Y = 0.96
WAIST_Y = 1.14
CHEST_Y = 1.36
ARMPIT_Y = 1.40
SLEEVE_TOP_Y = 1.52
SHOULDER_Y = 1.56
COLLAR_Y = 1.61

# Meias-larguras (X). Mangas curtas — nao a envergadura T-pose (~1.17 m).
W_HEM = 0.155
W_WAIST = 0.148
W_CHEST = 0.172
W_SHOULDER = 0.205
W_SLEEVE = 0.348
W_NECK = 0.070

# Meia-espessura (Z) com folga sobre o torso (~0.139 m de raio).
Z_HEM = 0.148
Z_CHEST = 0.158
Z_SLEEVE = 0.072
Z_NECK = 0.110

LAYERS = 18
RING = 8  # FL, FC, FR, RS, BR, BC, BL, LS


def _align4(value: int) -> int:
    return (value + 3) & ~3


def torso_x(y: float) -> float:
    if y <= WAIST_Y:
        t = (y - HEM_Y) / (WAIST_Y - HEM_Y)
        return W_HEM + (W_WAIST - W_HEM) * t
    if y <= CHEST_Y:
        t = (y - WAIST_Y) / (CHEST_Y - WAIST_Y)
        return W_WAIST + (W_CHEST - W_WAIST) * t
    if y <= SHOULDER_Y:
        t = (y - CHEST_Y) / (SHOULDER_Y - CHEST_Y)
        return W_CHEST + (W_SHOULDER - W_CHEST) * t
    t = (y - SHOULDER_Y) / (COLLAR_Y - SHOULDER_Y)
    return W_SHOULDER + (W_NECK - W_SHOULDER) * t


def sleeve_x(y: float) -> float:
    """Extensao lateral (manga). Abaixo da axila acompanha o torso."""
    body = torso_x(y)
    if y < ARMPIT_Y:
        return body
    if y <= SLEEVE_TOP_Y:
        t = (y - ARMPIT_Y) / (SLEEVE_TOP_Y - ARMPIT_Y)
        peak = W_SLEEVE if t < 0.62 else W_SLEEVE - 0.018 * ((t - 0.62) / 0.38)
        return max(body, peak)
    return body


def half_z(y: float, at_sleeve: bool) -> float:
    if at_sleeve:
        return Z_SLEEVE
    if y <= CHEST_Y:
        t = (y - HEM_Y) / (CHEST_Y - HEM_Y)
        return Z_HEM + (Z_CHEST - Z_HEM) * t
    t = (y - CHEST_Y) / (COLLAR_Y - CHEST_Y)
    return Z_CHEST + (Z_NECK - Z_CHEST) * t


def _norm(nx: float, ny: float, nz: float) -> tuple[float, float, float]:
    length = math.hypot(nx, ny, nz) or 1.0
    return (nx / length, ny / length, nz / length)


def _build_mesh() -> tuple[list[float], list[float], list[int], dict[str, float]]:
    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []

    ys = [HEM_Y + (COLLAR_Y - HEM_Y) * i / (LAYERS - 1) for i in range(LAYERS)]

    def push(px: float, py: float, pz: float, nx: float, ny: float, nz: float) -> None:
        positions.extend((px, py, pz))
        normals.extend(_norm(nx, ny, nz))

    for y in ys:
        xt = torso_x(y)
        xs = sleeve_x(y)
        zf = half_z(y, at_sleeve=False)
        zs = half_z(y, at_sleeve=xs > xt + 0.02)
        # Frente (z+), manga direita, costas (z-), manga esquerda.
        push(-xt, y, zf, -0.2, 0.0, 1.0)  # 0 FL
        push(0.0, y, zf + 0.006, 0.0, 0.0, 1.0)  # 1 FC (peito)
        push(xt, y, zf, 0.2, 0.0, 1.0)  # 2 FR
        push(xs, y, 0.0, 1.0, 0.0, 0.0)  # 3 RS
        push(xt, y, -zf, 0.2, 0.0, -1.0)  # 4 BR
        push(0.0, y, -zf - 0.004, 0.0, 0.0, -1.0)  # 5 BC
        push(-xt, y, -zf, -0.2, 0.0, -1.0)  # 6 BL
        push(-xs, y, 0.0, -1.0, 0.0, 0.0)  # 7 LS

    for i in range(LAYERS - 1):
        a = i * RING
        b = (i + 1) * RING
        for k in range(RING):
            k2 = (k + 1) % RING
            indices.extend((a + k, b + k, a + k2, a + k2, b + k, b + k2))

    xs_all = positions[0::3]
    ys_all = positions[1::3]
    zs_all = positions[2::3]
    sleeve_half = max(sleeve_x(y) for y in ys)
    stats = {
        "vertex_count": len(positions) // 3,
        "index_count": len(indices),
        "width": max(xs_all) - min(xs_all),
        "height": max(ys_all) - min(ys_all),
        "depth": max(zs_all) - min(zs_all),
        "min_y": min(ys_all),
        "max_y": max(ys_all),
        "min_x": min(xs_all),
        "max_x": max(xs_all),
        "sleeve_half_width": sleeve_half,
        "hem_half_width": torso_x(HEM_Y),
        "neck_half_width": torso_x(COLLAR_Y),
    }
    return positions, normals, indices, stats


def write_glb(path: Path) -> dict[str, float]:
    positions, normals, indices, stats = _build_mesh()
    vertex_count = len(positions) // 3
    pos_bytes = struct.pack(f"<{len(positions)}f", *positions)
    nrm_bytes = struct.pack(f"<{len(normals)}f", *normals)
    idx_bytes = struct.pack(f"<{len(indices)}I", *indices)
    xs, ys, zs = positions[0::3], positions[1::3], positions[2::3]

    bin_blob = bytearray()
    views: list[dict] = []

    def append_view(data: bytes, target: int) -> int:
        start = _align4(len(bin_blob))
        while len(bin_blob) < start:
            bin_blob.append(0)
        views.append({"buffer": 0, "byteOffset": start, "byteLength": len(data), "target": target})
        bin_blob.extend(data)
        return len(views) - 1

    pos_view = append_view(pos_bytes, 34962)
    nrm_view = append_view(nrm_bytes, 34962)
    idx_view = append_view(idx_bytes, 34963)

    gltf = {
        "asset": {"version": "2.0", "generator": "VESTE.AI generate_tshirt_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "tshirt", "mesh": 0}],
        "meshes": [
            {
                "name": "tshirt",
                "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}],
            }
        ],
        "materials": [
            {
                "name": "cotton",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.86, 0.82, 0.74, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.82,
                },
                "doubleSided": True,
            }
        ],
        "accessors": [
            {
                "bufferView": pos_view,
                "componentType": 5126,
                "count": vertex_count,
                "type": "VEC3",
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
            },
            {"bufferView": nrm_view, "componentType": 5126, "count": vertex_count, "type": "VEC3"},
            {"bufferView": idx_view, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_blob)}],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    bin_pad = (4 - len(bin_blob) % 4) % 4
    bin_bytes = bytes(bin_blob) + (b"\x00" * bin_pad)
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<I4s", len(json_bytes), b"JSON")
        + json_bytes
        + struct.pack("<I4s", len(bin_bytes), b"BIN\x00")
        + bin_bytes
    )
    return stats


def main() -> None:
    stats = write_glb(DEST)
    print(f"Camiseta gerada em {DEST} ({DEST.stat().st_size} bytes)")
    print(
        "dims m: "
        f"W={stats['width']:.3f} H={stats['height']:.3f} D={stats['depth']:.3f} "
        f"y=[{stats['min_y']:.2f},{stats['max_y']:.2f}] "
        f"sleeve={stats['sleeve_half_width']*2:.3f} neck={stats['neck_half_width']*2:.3f} "
        f"verts={stats['vertex_count']} tris={stats['index_count'] // 3}"
    )


if __name__ == "__main__":
    main()
