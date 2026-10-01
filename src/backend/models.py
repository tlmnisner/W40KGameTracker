from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_SCORE_PER_ROUND = 15
MAX_TOTAL_SCORE = 45
MAX_ROUNDS = 5


class GameCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Example Game",
                "game_description": "Friendly game with the boys.",
                "player_one_name": "Bob",
                "player_two_name": "Rob",
                "player_one_battle_ready": False,
                "player_two_battle_ready": False,
            }
        }
    )

    title: str = Field(min_length=1)
    game_description: str | None = None
    player_one_name: str | None = None
    player_one_battle_ready: bool | None = None
    player_two_name: str | None = None
    player_two_battle_ready: bool | None = None


class GameUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "game_description": "Updated game description",
                "player_two_name": "Updated player",
                "player_two_battle_ready": True,
            }
        }
    )

    title: str | None = Field(default=None, min_length=1)
    game_description: str | None = None
    player_one_name: str | None = None
    player_one_battle_ready: bool | None = None
    player_two_name: str | None = None
    player_two_battle_ready: bool | None = None


class RoundCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "round_description": "Example Round",
                "primary_score_player_one": 15,
                "primary_score_player_two": 5,
                "secondary_score_player_one": 15,
                "secondary_score_player_two": 6,
            }
        }
    )
    round_description: str | None = None
    primary_score_player_one: int = Field(
        strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )
    primary_score_player_two: int = Field(
        strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )
    secondary_score_player_one: int = Field(
        strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )
    secondary_score_player_two: int = Field(
        strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )


class RoundUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "round_description": "Updated round description",
                "primary_score_player_one": 6,
                "primary_score_player_two": 7,
            }
        }
    )
    round_description: str | None = None
    primary_score_player_one: int | None = Field(
        default=None, strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )
    primary_score_player_two: int | None = Field(
        default=None, strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )
    secondary_score_player_one: int | None = Field(
        default=None, strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )
    secondary_score_player_two: int | None = Field(
        default=None, strict=True, ge=0, le=MAX_SCORE_PER_ROUND
    )

    @field_validator("primary_score_player_one", "primary_score_player_two", "secondary_score_player_one", "secondary_score_player_two", mode="before")
    @classmethod
    def reject_null_scores(cls, value: int | None) -> int:
        if value is None:
            raise ValueError("score cannot be null")
        return value


class Round(RoundCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Game(GameCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    rounds: list[Round] = Field(default_factory=list)