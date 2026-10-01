from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class GameCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Example Game",
                "description": "Friendly game with the boys.",
                "player_one": "Bob",
                "player_two": "Rob",
            }
        }
    )

    title: str = Field(min_length=1)
    description: str | None = None
    player_one: str | None = None
    player_two: str | None = None


class Game(GameCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    rounds: list[dict] = Field(default_factory=list)
