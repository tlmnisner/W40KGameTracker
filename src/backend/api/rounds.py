from fastapi import APIRouter

router = APIRouter(prefix="/rounds", tags=["rounds"])

@router.post("/{game_id}/")
async def add_round(game_id: str):
    return {"game_id": game_id, "message": "Hello World"}


@router.patch("/{game_id}/{round}")
async def update_round(game_id: str, round_id: str):
    return {"game_id": game_id, "round_id": round_id ,"message": "Hello World"}


@router.delete("/{game_id}/{round}")
async def delete_round(game_id: str, round_id: str):
    return {"game_id": game_id, "round_id": round_id ,"message": "Hello World"}