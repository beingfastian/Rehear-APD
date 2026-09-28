"""FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.logging_config import configure_logging
from app.routers import audio, auth, billing, jobs, system, voice


@asynccontextmanager
async def _lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    app = FastAPI(title="Rehear APD API", version=system.API_VERSION, lifespan=_lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for module in (system, auth, billing, audio, jobs, voice):
        app.include_router(module.router)

    return app
