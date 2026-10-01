from uuid import UUID

from models import Round, RoundCreate
from services.game_service import get_game


def create_round(round_data: RoundCreate, game_id: UUID) -> Round:
    game = get_game(game_id)
    round_item = Round(**round_data.model_dump())
    game.rounds.append(round_item)
    return round_item
