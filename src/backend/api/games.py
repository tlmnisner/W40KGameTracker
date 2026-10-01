from fastapi import APIRouter

from models import Game, GameCreate
from services.game_service import create_game as create_game_service

router = APIRouter(prefix="/games", tags=["games"])


@router.get("/")
async def get_games():
    return {"message": "Hello World"}


@router.get("/{game_id}")
async def get_game(game_id: str):
    return {"game_id": game_id, "message": "Hello World"}


@router.post("/", response_model=Game, status_code=201)
async def create_game(game_data: GameCreate) -> Game:
    return create_game_service(game_data)


@router.patch("/{game_id}")
async def update_game(game_id: str):
    return {"game_id": game_id, "message": "Hello World"}


@router.delete("/{game_id}")
async def delete_game(game_id: str):
    return {"message": "Hello World"}