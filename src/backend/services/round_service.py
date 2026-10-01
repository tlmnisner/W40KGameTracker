from uuid import UUID

from models import Round, RoundCreate, RoundUpdate
from services.game_service import get_game


def create_round(round_data: RoundCreate, game_id: UUID) -> Round:
    game = get_game(game_id)
    round_item = Round(**round_data.model_dump())
    game.rounds.append(round_item)
    return round_item

def get_round(game_id: UUID, round_id:UUID) -> Round:
    game = get_game(game_id)

    round_item = next((round_item for round_item in game.rounds if round_item.id == round_id), None)
    if round_item is None:
        raise LookupError("Round not found")

    return round_item

def update_round(game_id: UUID, round_id:UUID, round_data: RoundUpdate) -> Round:
    game = get_game(game_id)
    round_item = get_round(game.id, round_id)

    # only update explicitly set
    for field, value in round_data.model_dump(exclude_unset=True).items():
        setattr(round_item, field, value)
    return round_item

def delete_round(game_id: UUID, round_id:UUID) -> None:
    game = get_game(game_id)
    round_item = get_round(game.id, round_id)

    game.rounds.remove(round_item)
