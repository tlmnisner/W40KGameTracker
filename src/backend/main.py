from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.games import router as games_router
from api.rounds import router as rounds_router

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(games_router)
app.include_router(rounds_router)

