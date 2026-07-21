from api.routes.health import router as health_router
from api.routes.auth import router as auth_router
from api.routes.research import router as research_router
from api.routes.report import router as report_router
from api.routes.websocket import router as ws_router

__all__ = [
    "health_router",
    "auth_router",
    "research_router",
    "report_router",
    "ws_router",
]
