from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from ....api.deps import DbSession
from ....schemas import MeasurementsIn, MeasurementsOut, PhotoAnalysisOut, UserCreate, UserOut, UserUpdate
from ....services import photo_service, user_service
from ....services.mappers import user_to_schema

router = APIRouter()


def _user_out(db, user) -> UserOut:
    return user_to_schema(
        user, user_service.latest_measurement(db, user.id), user_service.latest_photo(db, user.id)
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="Criar perfil do consumidor")
def create_user(payload: UserCreate, db: DbSession) -> UserOut:
    user = user_service.create_user(db, payload)
    return _user_out(db, user)


@router.get("/{user_id}", response_model=UserOut, summary="Obter perfil e medidas mais recentes")
def get_user(user_id: str, db: DbSession) -> UserOut:
    return _user_out(db, user_service.get_user(db, user_id))


@router.patch("/{user_id}", response_model=UserOut, summary="Atualizar preferencia/consentimento")
def update_user(user_id: str, payload: UserUpdate, db: DbSession) -> UserOut:
    return _user_out(db, user_service.update_user(db, user_id, payload))


@router.put("/{user_id}/measurements", response_model=MeasurementsOut, summary="Registrar novas medidas")
def put_measurements(user_id: str, payload: MeasurementsIn, db: DbSession) -> MeasurementsOut:
    return MeasurementsOut.model_validate(user_service.add_measurement(db, user_id, payload))


@router.post(
    "/{user_id}/photo",
    response_model=PhotoAnalysisOut,
    status_code=status.HTTP_201_CREATED,
    summary="Analisar foto (experimental, opcional, com consentimento)",
    description=(
        "A imagem e processada em memoria e descartada. Apenas proporcoes aproximadas sao persistidas. "
        "Nao ha reconhecimento facial nem classificacao estetica."
    ),
)
async def upload_photo(
    user_id: str,
    db: DbSession,
    file: Annotated[UploadFile, File(description="Foto frontal de corpo inteiro")],
    consent: Annotated[bool, Form()] = False,
) -> PhotoAnalysisOut:
    data = await file.read()
    photo = photo_service.analyze_and_store(db, user_id, data, consent)
    return PhotoAnalysisOut.model_validate(photo)
