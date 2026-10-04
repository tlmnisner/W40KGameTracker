import json

from fastapi.encoders import jsonable_encoder

from models import MAX_ROUNDS, Game
from services.game_store import games
from services.round_service import validate_total_scores


def export_games(game_list: list[Game]) -> str:
    return json.dumps(jsonable_encoder(game_list))


def import_games(imported_games: list[Game]) -> list[Game]:
    existing_game_ids = {game.id for game in games}
    imported_game_ids = [game.id for game in imported_games]
    duplicate_game_ids = {
        game_id for game_id in imported_game_ids if imported_game_ids.count(game_id) > 1
    }
    if duplicate_id := next(iter(duplicate_game_ids), None):
        raise ValueError(f"Game ID already appears more than once: {duplicate_id}")
    if duplicate_id := next(
        (game_id for game_id in imported_game_ids if game_id in existing_game_ids),
        None,
    ):
        raise ValueError(f"Game ID already exists: {duplicate_id}")

    for game in imported_games:
        if len(game.rounds) > MAX_ROUNDS:
            raise ValueError(f"A game cannot have more than {MAX_ROUNDS} rounds")

        round_ids = [round_item.id for round_item in game.rounds]
        duplicate_round_ids = {
            round_id for round_id in round_ids if round_ids.count(round_id) > 1
        }
        if duplicate_id := next(iter(duplicate_round_ids), None):
            raise ValueError(
                f"Round ID appears more than once in game {game.id}: {duplicate_id}"
            )

        for round_item in game.rounds:
            image_ids = [image.id for image in round_item.images]
            duplicate_image_ids = {
                image_id for image_id in image_ids if image_ids.count(image_id) > 1
            }
            if duplicate_id := next(iter(duplicate_image_ids), None):
                raise ValueError(
                    f"Image ID appears more than once in round {round_item.id}: "
                    f"{duplicate_id}"
                )

        validate_total_scores(game.rounds)

    games.extend(imported_games)
    return imported_games
