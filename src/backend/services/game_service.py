from uuid import UUID

from models import Game, GameCreate, GameUpdate
from services.game_store import games


def create_game(game_data: GameCreate) -> Game:
    game = Game(**game_data.model_dump())
    games.append(game)
    return game

def get_game(game_id: UUID) -> Game:
    game = next((game for game in games if game.id == game_id), None)
    if game is None:
        raise LookupError("Game not found")
    return game

def get_games() -> list[Game]:
    return games

def update_game(game_id: UUID, game_data: GameUpdate) -> Game:
    game = get_game(game_id)

    # only update explicitly set
    for field, value in game_data.model_dump(exclude_unset=True).items():
        setattr(game, field, value)
    return game

def delete_game(game_id: UUID) -> Game:
    game = get_game(game_id)
    games.remove(game)
    return game