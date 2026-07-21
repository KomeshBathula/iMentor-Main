import os
import sys
from contextlib import asynccontextmanager

# Add root server directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.database import init_db

# API Routers
from api.routes import (
    health_router,
    auth_router,
    research_router,
    report_router,
    ws_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup & Shutdown Events
    """
    print("=" * 60)
    print("Deep Research Server Starting...")
    print("=" * 60)

    # Initialize Database Tables
    await init_db()

    yield

    print("=" * 60)
    print("Deep Research Server Stopped")
    print("=" * 60)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(research_router, prefix=settings.API_V1_STR)
app.include_router(report_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "message": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "Running",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host=settings.HOST, port=settings.PORT, reload=True)
