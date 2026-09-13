"""Analise visual EXPERIMENTAL de proporcoes corporais.

Politica:
* Nenhum reconhecimento facial.
* Nenhuma classificacao estetica.
* A imagem e processada em memoria e descartada; apenas proporcoes sao devolvidas.
* Se o MediaPipe nao estiver instalado, usa uma heuristica deterministica de
  silhueta (NumPy + Pillow). Se ate isso falhar, informa indisponibilidade e o
  motor segue somente com as medidas manuais.

Saida: relacoes ombro/quadril, cintura/quadril e tronco/pernas + qualidade.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger("veste.vision")

try:  # dependencia opcional
    import mediapipe as mp  # type: ignore

    _MEDIAPIPE_AVAILABLE = True
except Exception:  # noqa: BLE001
    mp = None  # type: ignore
    _MEDIAPIPE_AVAILABLE = False


@dataclass
class VisualAnalysisResult:
    status: str  # completed | unavailable
    source: str  # mediapipe | heuristic | unavailable
    quality: float
    shoulder_hip_ratio: float | None
    waist_hip_ratio: float | None
    torso_leg_ratio: float | None
    image_width: int | None
    image_height: int | None
    message: str


def mediapipe_available() -> bool:
    return _MEDIAPIPE_AVAILABLE


def analyze_image(data: bytes) -> VisualAnalysisResult:
    try:
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        logger.info("Imagem invalida: %s", exc)
        return VisualAnalysisResult(
            status="unavailable",
            source="unavailable",
            quality=0.0,
            shoulder_hip_ratio=None,
            waist_hip_ratio=None,
            torso_leg_ratio=None,
            image_width=None,
            image_height=None,
            message="Nao foi possivel ler a imagem. A estimativa seguira apenas com as medidas informadas.",
        )

    width, height = image.size
    if _MEDIAPIPE_AVAILABLE:
        try:
            result = _analyze_with_mediapipe(image)
            if result is not None:
                return result
        except Exception as exc:  # noqa: BLE001
            logger.warning("MediaPipe falhou, usando heuristica: %s", exc)

    return _analyze_with_silhouette(image, width, height)


# --------------------------------------------------------------------------- #
# MediaPipe Pose (quando disponivel)
# --------------------------------------------------------------------------- #
def _analyze_with_mediapipe(image: Image.Image) -> VisualAnalysisResult | None:
    pose = mp.solutions.pose  # type: ignore[union-attr]
    array = np.asarray(image)
    with pose.Pose(static_image_mode=True, model_complexity=1) as detector:
        output = detector.process(array)
    if not output.pose_landmarks:
        return None
    lm = output.pose_landmarks.landmark
    P = pose.PoseLandmark

    def pt(i):
        return np.array([lm[i].x, lm[i].y]), lm[i].visibility

    (ls, v1), (rs, v2) = pt(P.LEFT_SHOULDER), pt(P.RIGHT_SHOULDER)
    (lh, v3), (rh, v4) = pt(P.LEFT_HIP), pt(P.RIGHT_HIP)
    (la, v5), (ra, v6) = pt(P.LEFT_ANKLE), pt(P.RIGHT_ANKLE)
    visibility = float(np.mean([v1, v2, v3, v4, v5, v6]))
    if visibility < 0.4:
        return None

    shoulder_w = float(np.linalg.norm(ls - rs))
    hip_w = float(np.linalg.norm(lh - rh))
    if hip_w <= 1e-6:
        return None
    # O quadril anatomico e mais largo que a distancia entre os pontos de referencia.
    hip_w_adj = hip_w * 1.6
    shoulder_center = (ls + rs) / 2
    hip_center = (lh + rh) / 2
    ankle_center = (la + ra) / 2
    torso = float(np.linalg.norm(shoulder_center - hip_center))
    legs = float(np.linalg.norm(hip_center - ankle_center))

    return VisualAnalysisResult(
        status="completed",
        source="mediapipe",
        quality=round(min(1.0, 0.6 + 0.4 * visibility), 3),
        shoulder_hip_ratio=round(shoulder_w / hip_w_adj, 3),
        waist_hip_ratio=None,  # o pose nao fornece cintura com seguranca
        torso_leg_ratio=round(torso / legs, 3) if legs > 1e-6 else None,
        image_width=image.width,
        image_height=image.height,
        message="Analise visual experimental (MediaPipe Pose): proporcoes estimadas por pontos de referencia.",
    )


# --------------------------------------------------------------------------- #
# Heuristica de silhueta (fallback deterministico, sem modelos externos)
# --------------------------------------------------------------------------- #
def _analyze_with_silhouette(image: Image.Image, width: int, height: int) -> VisualAnalysisResult:
    small = image.copy()
    small.thumbnail((240, 480))
    arr = np.asarray(small).astype(np.float32)
    h, w, _ = arr.shape

    # Cor de fundo estimada pelas bordas; primeiro plano = pixels distantes do fundo.
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]])
    bg = np.median(border, axis=0)
    distance = np.linalg.norm(arr - bg, axis=2)
    threshold = max(28.0, float(np.percentile(distance, 55)))
    mask = distance > threshold

    rows = np.where(mask.sum(axis=1) > w * 0.04)[0]
    if rows.size < h * 0.3:
        return VisualAnalysisResult(
            status="unavailable",
            source="unavailable",
            quality=0.0,
            shoulder_hip_ratio=None,
            waist_hip_ratio=None,
            torso_leg_ratio=None,
            image_width=width,
            image_height=height,
            message=(
                "Analise visual experimental indisponivel para esta imagem (silhueta nao identificada). "
                "A estimativa seguira apenas com as medidas informadas."
            ),
        )

    top, bottom = int(rows[0]), int(rows[-1])
    body_h = bottom - top
    widths = mask.sum(axis=1).astype(np.float32)

    def band_width(frac_a: float, frac_b: float) -> float:
        a = top + int(body_h * frac_a)
        b = top + int(body_h * frac_b)
        segment = widths[a : max(b, a + 1)]
        return float(np.percentile(segment, 80)) if segment.size else 0.0

    # Faixas aproximadas de uma foto frontal de corpo inteiro (cabeca no topo).
    shoulder_w = band_width(0.17, 0.24)
    waist_w = band_width(0.40, 0.47)
    hip_w = band_width(0.50, 0.58)
    torso = body_h * (0.52 - 0.17)
    legs = body_h * (1.0 - 0.52)

    if hip_w <= 0 or shoulder_w <= 0:
        quality = 0.0
    else:
        fill = mask[top:bottom].mean()
        quality = float(np.clip(0.35 + 0.5 * min(1.0, fill * 3), 0.2, 0.6))

    if quality == 0.0:
        return VisualAnalysisResult(
            status="unavailable",
            source="unavailable",
            quality=0.0,
            shoulder_hip_ratio=None,
            waist_hip_ratio=None,
            torso_leg_ratio=None,
            image_width=width,
            image_height=height,
            message="Analise visual experimental indisponivel. Usando somente medidas manuais.",
        )

    return VisualAnalysisResult(
        status="completed",
        source="heuristic",
        quality=round(quality, 3),
        shoulder_hip_ratio=round(shoulder_w / hip_w, 3),
        waist_hip_ratio=round(waist_w / hip_w, 3) if waist_w > 0 else None,
        torso_leg_ratio=round(torso / legs, 3) if legs > 0 else None,
        image_width=width,
        image_height=height,
        message=(
            "Analise visual experimental (heuristica de silhueta): proporcoes aproximadas usadas "
            "apenas como enriquecimento da estimativa."
        ),
    )
