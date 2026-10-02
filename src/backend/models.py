import base64
from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_SCORE_PER_ROUND = 15
MAX_TOTAL_SCORE = 45
MAX_ROUNDS = 5


class RoundImage(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    image: str = Field(min_length=1)
    image_description: str | None = None
    mimetype: str = Field(min_length=1)
    x_dim: int = Field(gt=0)
    y_dim: int = Field(gt=0)

    @field_validator("image")
    @classmethod
    def validate_base64_picture(cls, value: str) -> str:
        try:
            base64.b64decode(value, validate=True)
        except ValueError as error:
            raise ValueError("Image must be a valid base64 string") from error
        return value

    @field_validator("mimetype")
    @classmethod
    def validate_image_mimetype(cls, value: str) -> str:
        if not value.startswith("image/"):
            raise ValueError("Mimetype must be image type")
        return value


class RoundImageUpdate(BaseModel):
    image: str | None = Field(default=None, min_length=1)
    image_description: str | None = None
    mimetype: str | None = Field(default=None, min_length=1)
    x_dim: int | None = Field(default=None, gt=0)
    y_dim: int | None = Field(default=None, gt=0)

    @field_validator("image")
    @classmethod
    def validate_base64_picture(cls, value: str | None) -> str | None:
        if value is None:
            return value

        try:
            base64.b64decode(value, validate=True)
        except ValueError as error:
            raise ValueError("Image must be a valid base64 string") from error
        return value

    @field_validator("mimetype")
    @classmethod
    def validate_image_mimetype(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith("image/"):
            raise ValueError("Mimetype must be image type")
        return value


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
    images: list[RoundImage] = Field(default_factory=list)


class RoundUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "round_description": "Updated round description",
                "primary_score_player_one": 6,
                "primary_score_player_two": 7,
                "images": [],
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
    images: list[RoundImage] | None = None

    @field_validator("primary_score_player_one", "primary_score_player_two", "secondary_score_player_one", "secondary_score_player_two", mode="before")
    @classmethod
    def reject_null_scores(cls, value: int | None) -> int:
        if value is None:
            raise ValueError("Score cannot be null")
        return value

    @field_validator("images", mode="before")
    @classmethod
    def reject_null_images(cls, value: list[RoundImage] | None) -> list[RoundImage]:
        if value is None:
            raise ValueError("Images cannot be null")
        return value


class Round(RoundCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Game(GameCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    rounds: list[Round] = Field(default_factory=list)