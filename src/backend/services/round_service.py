from uuid import UUID

from models import MAX_ROUNDS, MAX_TOTAL_SCORE, Round, RoundCreate, RoundUpdate
from services.game_service import get_game


def _validate_total_scores(rounds: list[Round]) -> None:
    score_fields = (
        "primary_score_player_one",
        "primary_score_player_two",
        "secondary_score_player_one",
        "secondary_score_player_two",
    )
    for field in score_fields:
        total = sum(getattr(round_item, field) for round_item in rounds)
        if total > MAX_TOTAL_SCORE:
            raise ValueError(
                f"{field} cannot exceed {MAX_TOTAL_SCORE} across all rounds"
            )


def create_round(round_data: RoundCreate, game_id: UUID) -> Round:
    game = get_game(game_id)
    if len(game.rounds) >= MAX_ROUNDS:
        raise ValueError(f"A game cannot have more than {MAX_ROUNDS} rounds")

    round_item = Round(**round_data.model_dump())
    _validate_total_scores([*game.rounds, round_item])
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

    updated_round = round_item.model_copy(
        update=round_data.model_dump(exclude_unset=True)
    )
    _validate_total_scores(
        [updated_round if item.id == round_item.id else item for item in game.rounds]
    )

    for field, value in round_data.model_dump(exclude_unset=True).items():
        setattr(round_item, field, value)
    return round_item

def delete_round(game_id: UUID, round_id:UUID) -> None:
    game = get_game(game_id)
    round_item = get_round(game.id, round_id)

    game.rounds.remove(round_item)
