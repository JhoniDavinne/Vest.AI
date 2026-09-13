from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Feedback, FitAnalysis
from ..schemas import FeedbackCreate
from .errors import NotFoundError, ValidationError


def create_feedback(db: Session, payload: FeedbackCreate) -> Feedback:
    analysis = db.get(FitAnalysis, payload.analysis_id)
    if analysis is None:
        raise NotFoundError("Analise nao encontrada.")
    if analysis.feedback is not None:
        raise ValidationError("Esta analise ja possui feedback registrado.")
    feedback = Feedback(
        fit_analysis_id=analysis.id,
        user_id=analysis.user_id,
        purchased_size=payload.purchased_size or analysis.recommended_size,
        fit_rating=payload.fit_rating,
        followed_recommendation=payload.followed_recommendation,
        returned=payload.returned,
        return_reason=payload.return_reason,
        comment=payload.comment,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
