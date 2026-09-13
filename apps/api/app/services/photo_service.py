from __future__ import annotations

from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import PhotoAnalysis
from ..vision import VisualAnalysisResult, analyze_image
from .errors import ValidationError
from .user_service import get_user


def analyze_and_store(db: Session, user_id: str | None, data: bytes, consent: bool) -> PhotoAnalysis:
    """Processa a foto em memoria e persiste SOMENTE as proporcoes derivadas."""
    settings = get_settings()
    if not consent:
        raise ValidationError("E necessario consentimento explicito para a analise da foto.")
    if len(data) == 0:
        raise ValidationError("Arquivo vazio.")
    if len(data) > settings.max_photo_bytes:
        raise ValidationError("Imagem excede o tamanho maximo permitido (8 MB).")

    if user_id:
        user = get_user(db, user_id)
        if not user.photo_consent:
            user.photo_consent = True

    if settings.vision_enabled:
        result = analyze_image(data)
    else:
        result = VisualAnalysisResult(
            status="unavailable",
            source="unavailable",
            quality=0.0,
            shoulder_hip_ratio=None,
            waist_hip_ratio=None,
            torso_leg_ratio=None,
            image_width=None,
            image_height=None,
            message="Analise visual desabilitada neste ambiente.",
        )

    photo = PhotoAnalysis(
        user_id=user_id,
        status=result.status,
        source=result.source,
        quality=result.quality,
        shoulder_hip_ratio=result.shoulder_hip_ratio,
        waist_hip_ratio=result.waist_hip_ratio,
        torso_leg_ratio=result.torso_leg_ratio,
        image_width=result.image_width,
        image_height=result.image_height,
        message=result.message,
        consent=True,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo
