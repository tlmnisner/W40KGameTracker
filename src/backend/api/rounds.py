from fastapi import APIRouter, HTTPException, status
from uuid import UUID

from models import Round, RoundCreate
from services.round_service import create_round as create_round_service

router = APIRouter(prefix="/rounds", tags=["rounds"])

@router.post("/{game_id}/", response_model=Round, status_code=201)
async def create_round(round_data: RoundCreate, game_id: UUID) -> Round:
    try:
        return create_round_service(round_data, game_id)
    # failed game_id lookup
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

@router.patch("/{game_id}/{round}")
async def update_round(game_id: str, round_id: str):
    return {"game_id": game_id, "round_id": round_id ,"message": "Hello World"}


@router.delete("/{game_id}/{round}")
async def delete_round(game_id: str, round_id: str):
    return {"game_id": game_id, "round_id": round_id ,"message": "Hello World"}