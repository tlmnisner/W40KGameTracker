import json
from fastapi import APIRouter
from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from uuid import UUID

from models import Game, GameCreate, GameUpdate
from services.game_service import (
    create_game as create_game_service,
    get_game as get_game_service,
    get_games as get_games_service,
    update_game as update_game_service,
    delete_game as delete_game_service,
)

router = APIRouter(prefix="/games", tags=["games"])


@router.get("/", response_model=list[Game])
async def get_games() -> list[Game]:
    return get_games_service()


@router.get("/export", response_class=Response)
async def export_games() -> Response:
    games = get_games_service()
    content = json.dumps(jsonable_encoder(games))

    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="export.json"',
        },
    )


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


@router.post("/", response_model=Game, status_code=status.HTTP_201_CREATED)
async def create_game(game_data: GameCreate) -> Game:
    return create_game_service(game_data)


@router.patch("/{game_id}", response_model=Game)
async def update_game(game_id: UUID, game_data: GameUpdate) -> Game:
    try:
        return update_game_service(game_id, game_data)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game(game_id: UUID) -> None:
    try:
        delete_game_service(game_id)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error