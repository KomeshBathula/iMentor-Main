from typing import List, Dict, Any, Set
from fastapi import WebSocket
from utils.logger import logger


class ConnectionManager:
    """
    Centralized WebSocket Connection Manager handling active client subscriptions,
    room messaging by research_id, and JSON broadcast dispatching.
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.research_rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, research_id: str = None) -> None:
        """
        Accept incoming client WebSocket connection and subscribe to research room.
        """
        await websocket.accept()
        self.active_connections.add(websocket)

        if research_id:
            if research_id not in self.research_rooms:
                self.research_rooms[research_id] = set()
            self.research_rooms[research_id].add(websocket)

        logger.info(f"[ConnectionManager] Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, research_id: str = None) -> None:
        """
        Unsubscribe and remove client WebSocket.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        if research_id and research_id in self.research_rooms:
            self.research_rooms[research_id].discard(websocket)
            if not self.research_rooms[research_id]:
                del self.research_rooms[research_id]

        logger.info(f"[ConnectionManager] Client disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket) -> None:
        """
        Direct JSON message to specific socket.
        """
        try:
            await websocket.send_json(message)
        except Exception as exc:
            logger.error(f"[ConnectionManager] Failed sending personal message: {exc}")

    async def broadcast_to_research(self, research_id: str, message: Dict[str, Any]) -> None:
        """
        Broadcast progress/status JSON message to all clients listening to a research session.
        """
        if research_id in self.research_rooms:
            dead_sockets = []
            for connection in list(self.research_rooms[research_id]):
                try:
                    await connection.send_json(message)
                except Exception as exc:
                    logger.error(f"[ConnectionManager] Failed sending room message: {exc}")
                    dead_sockets.append(connection)

            for dead in dead_sockets:
                self.disconnect(dead, research_id)

ws_manager = ConnectionManager()
