from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_async_db
from websocket.manager import ws_manager
from agents.manager import ManagerAgent
from schemas.research import ResearchCreate
from schemas.websocket import WSMessage
from utils.logger import logger

router = APIRouter(prefix="/ws", tags=["WebSocket"])


@router.websocket("/research")
async def websocket_research_endpoint(websocket: WebSocket, db: AsyncSession = Depends(get_async_db)):
    """
    WebSocket endpoint for real-time streaming of research progress, logs, and results.
    """
    await ws_manager.connect(websocket)
    manager = ManagerAgent()

    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"[WebSocket API] Received payload: {data}")

            try:
                payload = ResearchCreate(**data)
            except Exception as parse_err:
                await ws_manager.send_personal_message(
                    WSMessage(
                        event="error",
                        message=f"Invalid research payload format: {parse_err}"
                    ).model_dump(),
                    websocket
                )
                continue

            async def progress_cb(stage: str, progress: int, msg: str):
                event_data = WSMessage(
                    event="status",
                    stage=stage,
                    progress=progress,
                    message=msg
                ).model_dump()
                await ws_manager.send_personal_message(event_data, websocket)

            try:
                state = await manager.run_research_pipeline(
                    query=payload.query,
                    nature=payload.nature,
                    depth=payload.depth,
                    requirements=payload.requirements,
                    progress_callback=progress_cb
                )

                await ws_manager.send_personal_message(
                    WSMessage(
                        event="report",
                        stage="completed",
                        progress=100,
                        message="Deep research completed successfully.",
                        data=state.get("final_report")
                    ).model_dump(),
                    websocket
                )
            except Exception as pipeline_err:
                logger.error(f"[WebSocket API] Research pipeline error: {pipeline_err}")
                await ws_manager.send_personal_message(
                    WSMessage(
                        event="error",
                        message=f"Pipeline execution error: {pipeline_err}"
                    ).model_dump(),
                    websocket
                )
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.error(f"[WebSocket API] Socket error: {exc}")
        ws_manager.disconnect(websocket)
