from fastapi import APIRouter, HTTPException, status
from uuid import UUID

from models import Round, RoundCreate, RoundUpdate
from services.round_service import (
    create_round as create_round_service,
    delete_round as delete_round_service,
    update_round as update_round_service,
)

router = APIRouter(prefix="/rounds", tags=["rounds"])

@router.post("/{game_id}/", response_model=Round, status_code=status.HTTP_201_CREATED)
async def create_round(round_data: RoundCreate, game_id: UUID) -> Round:
    try:
        return create_round_service(round_data, game_id)
    # failed game_id lookup
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

@router.patch("/{game_id}/{round_id}", response_model=Round)
async def update_round(game_id: UUID, round_id: UUID, round_data: RoundUpdate) -> Round:
    try:
        return update_round_service(game_id, round_id, round_data)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.delete("/{game_id}/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_round(game_id: UUID, round_id: UUID):
    try:
        delete_round_service(game_id, round_id)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error