from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import PhotoAnalysis, User, UserMeasurement
from ..schemas import MeasurementsIn, UserCreate, UserUpdate
from .errors import NotFoundError


def create_user(db: Session, payload: UserCreate) -> User:
    user = User(
        name=payload.name.strip(),
        email=payload.email,
        fit_preference=payload.fit_preference,
        photo_consent=payload.photo_consent,
    )
    db.add(user)
    db.flush()
    db.add(UserMeasurement(user_id=user.id, **payload.measurements.model_dump()))
    db.commit()
    db.refresh(user)
    return user


def get_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"Usuario '{user_id}' nao encontrado.")
    return user


def update_user(db: Session, user_id: str, payload: UserUpdate) -> User:
    user = get_user(db, user_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def latest_measurement(db: Session, user_id: str) -> UserMeasurement | None:
    stmt = (
        select(UserMeasurement)
        .where(UserMeasurement.user_id == user_id)
        .order_by(UserMeasurement.created_at.desc())
        .limit(1)
    )
    return db.scalars(stmt).first()


def add_measurement(db: Session, user_id: str, payload: MeasurementsIn) -> UserMeasurement:
    get_user(db, user_id)
    measurement = UserMeasurement(user_id=user_id, **payload.model_dump())
    db.add(measurement)
    db.commit()
    db.refresh(measurement)
    return measurement


def latest_photo(db: Session, user_id: str) -> PhotoAnalysis | None:
    stmt = (
        select(PhotoAnalysis)
        .where(PhotoAnalysis.user_id == user_id)
        .order_by(PhotoAnalysis.created_at.desc())
        .limit(1)
    )
    return db.scalars(stmt).first()
