from __future__ import annotations

from fastapi import APIRouter, status

from ....api.deps import DbSession
from ....schemas import FeedbackCreate, FeedbackOut
from ....services import feedback_service

router = APIRouter()


@router.post(
    "",
    response_model=FeedbackOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar feedback de caimento de uma analise",
)
def create_feedback(payload: FeedbackCreate, db: DbSession) -> FeedbackOut:
    return FeedbackOut.model_validate(feedback_service.create_feedback(db, payload))
