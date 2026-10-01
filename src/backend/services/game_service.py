from uuid import UUID

from models import Game, GameCreate
from services.game_store import games


def create_game(game_data: GameCreate) -> Game:
    game = Game(**game_data.model_dump())
    games.append(game)
    return game

def get_game(game_id: UUID | None = None) -> list[Game] | Game:
    if game_id is None:
        return games

    game = next((game for game in games if game.id == game_id), None)
    if game is None:
        raise LookupError("Game not found")
    return game
