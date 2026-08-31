"""
PRAHARI WebSocket Connection Manager
"""
import json
import asyncio
import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"Client disconnected. Total: {len(self.active_connections)}")
    
    async def send_to(self, websocket: WebSocket, event_type: str, data):
        try:
            message = json.dumps({"type": event_type, "data": data})
            await websocket.send_text(message)
        except Exception as e:
            logger.warning(f"Failed to send to client: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, event_type: str, data):
        """Broadcast to all connected clients"""
        if not self.active_connections:
            return
        
        message = json.dumps({"type": event_type, "data": data}, default=str)
        dead = set()
        
        for ws in list(self.active_connections):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        
        for ws in dead:
            self.active_connections.discard(ws)
    
    @property
    def connection_count(self):
        return len(self.active_connections)


# Global manager
ws_manager = ConnectionManager()
