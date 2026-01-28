"""
WebSocket Routes for Real-time Updates
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict, Set
import asyncio
from loguru import logger

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.pipeline_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    async def connect_pipeline(self, websocket: WebSocket):
        """Connect to pipeline updates channel"""
        await websocket.accept()
        self.pipeline_connections.add(websocket)
        logger.info(f"Pipeline WebSocket connected. Total: {len(self.pipeline_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    def disconnect_pipeline(self, websocket: WebSocket):
        """Disconnect from pipeline updates"""
        self.pipeline_connections.discard(websocket)
        logger.info(f"Pipeline WebSocket disconnected. Total: {len(self.pipeline_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message: {e}")

    async def broadcast_pipeline(self, message: dict):
        """Broadcast message to pipeline subscribers"""
        disconnected = []
        for connection in self.pipeline_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send pipeline message: {e}")
                disconnected.append(connection)

        # Clean up disconnected
        for conn in disconnected:
            self.pipeline_connections.discard(conn)


manager = ConnectionManager()


@router.websocket("/updates")
async def websocket_updates(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates
    Sends breaking news and trending updates
    """
    await manager.connect(websocket)

    try:
        while True:
            # Wait for client messages (heartbeat)
            data = await websocket.receive_text()

            # Echo back
            await websocket.send_json({
                "type": "heartbeat",
                "status": "ok"
            })

            # Simulate periodic updates
            await asyncio.sleep(30)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def broadcast_breaking_news(article: dict):
    """Broadcast breaking news to all clients"""
    await manager.broadcast({
        "type": "breaking_news",
        "article": article
    })


async def broadcast_trending_update(topics: list):
    """Broadcast trending topics update"""
    await manager.broadcast({
        "type": "trending_update",
        "topics": topics
    })


@router.websocket("/pipeline")
async def websocket_pipeline(websocket: WebSocket):
    """
    WebSocket endpoint for real-time pipeline progress
    Sends: log, progress, source_update, status, completed, error events
    """
    from app.services.pipeline_manager import get_pipeline_manager

    await manager.connect_pipeline(websocket)
    pipeline_manager = get_pipeline_manager()

    # Subscribe to pipeline updates
    async def on_pipeline_event(message: dict):
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    pipeline_manager.subscribe(on_pipeline_event)

    try:
        # Send current state immediately
        await websocket.send_json({
            "type": "state",
            **pipeline_manager.get_state()
        })

        # Send recent logs
        logs = pipeline_manager.get_logs(limit=50)
        if logs:
            await websocket.send_json({
                "type": "logs_history",
                "logs": logs
            })

        # Keep connection alive
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                # Handle ping
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Pipeline WebSocket error: {e}")
    finally:
        pipeline_manager.unsubscribe(on_pipeline_event)
        manager.disconnect_pipeline(websocket)


async def broadcast_pipeline_update(message: dict):
    """Broadcast pipeline update to all pipeline subscribers"""
    await manager.broadcast_pipeline(message)
