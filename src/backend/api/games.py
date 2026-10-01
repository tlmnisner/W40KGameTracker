from fastapi import APIRouter
from fastapi import HTTPException, status
from uuid import UUID

from models import Game, GameCreate
from services.game_service import (
    create_game as create_game_service,
    get_game as get_game_service,
)

router = APIRouter(prefix="/games", tags=["games"])


@router.get("/", response_model=list[Game])
async def get_games() -> list[Game]:
    return get_game_service()


@router.get("/{game_id}", response_model=Game)
async def get_game(game_id: UUID) -> Game:
    try:
        return get_game_service(game_id)
    # failed game_id lookup
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.post("/", response_model=Game, status_code=201)
async def create_game(game_data: GameCreate) -> Game:
    return create_game_service(game_data)


@router.patch("/{game_id}")
async def update_game(game_id: UUID):
    return {"game_id": game_id, "message": "Hello World"}


@router.delete("/{game_id}")
async def delete_game(game_id: UUID):
    return {"message": "Hello World"}