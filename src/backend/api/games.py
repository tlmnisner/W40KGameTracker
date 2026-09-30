from fastapi import APIRouter

router = APIRouter(prefix="/games", tags=["games"])

@router.get("/")
async def get_games():
    return {"message": "Hello World"}


@router.get("/{game_id}")
async def get_game(game_id: str):
    return {"game_id": game_id, "message": "Hello World"}


@router.post("/")
async def create_game():
    return {"message": "Hello World"}


@router.patch("/{game_id}")
async def update_game(game_id: str):
    return {"game_id": game_id, "message": "Hello World"}


@router.delete("/{game_id}")
async def delete_game(game_id: str):
    return {"message": "Hello World"}