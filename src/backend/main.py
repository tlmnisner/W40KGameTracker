from fastapi import FastAPI

from api.games import router as games_router
from api.rounds import router as rounds_router

app = FastAPI()

app.include_router(games_router)
app.include_router(rounds_router)
