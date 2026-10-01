from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class GameCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Example Game",
                "game_description": "Friendly game with the boys.",
                "player_one_name": "Bob",
                "player_two_name": "Rob",
            }
        }
    )

    title: str = Field(min_length=1)
    game_description: str | None = None
    player_one_name: str | None = None
    player_two_name: str | None = None


class GameUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "game_description": "Updated game description",
                "player_two_name": "Updated player",
            }
        }
    )

    title: str | None = Field(default=None, min_length=1)
    game_description: str | None = None
    player_one_name: str | None = None
    player_two_name: str | None = None


class RoundCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "round_description": "Example Round",
                "score_player_one": 15,
                "score_player_two": 5,
            }
        }
    )
    round_description: str | None = None
    score_player_one: int = Field(strict=True, ge=0)
    score_player_two: int = Field(strict=True, ge=0)

class Round(RoundCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Game(GameCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    rounds: list[Round] = Field(default_factory=list)