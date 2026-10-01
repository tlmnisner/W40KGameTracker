from models import Game, GameCreate

games: list[Game] = []


def create_game(game_data: GameCreate) -> Game:
    game = Game(**game_data.model_dump())
    games.append(game)
    return game
