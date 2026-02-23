from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import router as auth_router
from .database import init_db
from .routes.badges import router as badges_router
from .routes.quests import router as quests_router
from .routes.stats import router as stats_router

app = FastAPI(
    title="QuestLog",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(quests_router)
app.include_router(badges_router)
app.include_router(stats_router)

# Serve frontend — must come after API routes
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")


@app.on_event("startup")
def on_startup():
    init_db()
