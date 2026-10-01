from uuid import UUID

from models import Round, RoundCreate
from services.game_store import games


def create_round(round_data: RoundCreate, game_id: UUID) -> Round:
    game = next((game for game in games if game.id == game_id), None)
    if game is None:
        raise LookupError("Game not found")

    round_item = Round(**round_data.model_dump())
    game.rounds.append(round_item)
    return round_item
