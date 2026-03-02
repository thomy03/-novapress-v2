"""
Web Chat API — WebSocket + REST endpoints for NovaPress chat.
Reuses ChatEngine (shared with Telegram bot).

Rate limiting:
- FREE tier: 5 messages/day
- PRO tier: unlimited
"""
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from loguru import logger

from app.services.messaging.chat_engine import get_chat_engine

router = APIRouter()

# In-memory session store (per-connection chat history)
_sessions: Dict[str, List[Dict[str, str]]] = {}

# Simple daily rate limiting (in-memory, resets on restart)
_daily_counts: Dict[str, Dict[str, int]] = {}  # {date: {session_id: count}}
FREE_DAILY_LIMIT = 5


def _check_rate_limit(session_id: str) -> bool:
    """Check if session has exceeded daily limit. Returns True if OK."""
    today = datetime.now().strftime("%Y-%m-%d")

    # Clean old dates
    old_dates = [d for d in _daily_counts if d != today]
    for d in old_dates:
        del _daily_counts[d]

    if today not in _daily_counts:
        _daily_counts[today] = {}

    count = _daily_counts[today].get(session_id, 0)
    return count < FREE_DAILY_LIMIT


def _increment_rate(session_id: str):
    """Increment daily message count for session."""
    today = datetime.now().strftime("%Y-%m-%d")
    if today not in _daily_counts:
        _daily_counts[today] = {}
    _daily_counts[today][session_id] = _daily_counts[today].get(session_id, 0) + 1


@router.websocket("/chat")
async def chat_websocket(websocket: WebSocket):
    """
    WebSocket chat endpoint.

    Client sends JSON:
        {"type": "message", "content": "...", "session_id": "..."}

    Server responds JSON:
        {"type": "response", "content": "...", "timestamp": "..."}
        {"type": "error", "content": "...", "code": "rate_limit"}
        {"type": "typing", "content": true}
    """
    await websocket.accept()

    engine = get_chat_engine()
    await engine.initialize()

    session_id = str(uuid.uuid4())
    _sessions[session_id] = []

    # Send welcome with session_id
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "content": "Connecte a NovaPress AI. Pose-moi tes questions sur l'actualite !",
    })

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "content": "Format JSON invalide",
                    "code": "invalid_json",
                })
                continue

            msg_type = data.get("type", "message")
            content = data.get("content", "").strip()
            client_session = data.get("session_id", session_id)

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if not content:
                continue

            # Rate limiting (free tier)
            if not _check_rate_limit(client_session):
                await websocket.send_json({
                    "type": "error",
                    "content": f"Limite quotidienne atteinte ({FREE_DAILY_LIMIT} messages/jour en mode gratuit). Passez a PRO pour un acces illimite.",
                    "code": "rate_limit",
                })
                continue

            # Send typing indicator
            await websocket.send_json({"type": "typing", "content": True})

            # Get or create history for this session
            if client_session not in _sessions:
                _sessions[client_session] = []
            history = _sessions[client_session]

            # Generate response
            response = await engine.generate_response(
                user_message=content,
                session_id=client_session,
                history=history,
            )

            # Update history
            history.append({"role": "user", "content": content})
            history.append({"role": "assistant", "content": response})

            # Trim history to prevent memory bloat
            if len(history) > 20:
                _sessions[client_session] = history[-20:]

            # Increment rate limit
            _increment_rate(client_session)

            # Send response
            await websocket.send_json({
                "type": "response",
                "content": response,
                "timestamp": datetime.now().isoformat(),
                "remaining": FREE_DAILY_LIMIT - _daily_counts.get(
                    datetime.now().strftime("%Y-%m-%d"), {}
                ).get(client_session, 0),
            })

    except WebSocketDisconnect:
        logger.info(f"Chat session {session_id} disconnected")
        # Clean up session after disconnect
        _sessions.pop(session_id, None)
    except Exception as e:
        logger.error(f"Chat WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "content": "Erreur interne du serveur",
                "code": "internal_error",
            })
        except Exception:
            pass


@router.post("/chat/message")
async def chat_message_rest(
    content: str,
    session_id: str = "",
):
    """
    REST fallback for chat (for environments where WebSocket isn't available).
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    if not _check_rate_limit(session_id):
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit reached ({FREE_DAILY_LIMIT} messages/day on free tier)",
        )

    engine = get_chat_engine()
    await engine.initialize()

    history = _sessions.get(session_id, [])

    response = await engine.generate_response(
        user_message=content,
        session_id=session_id,
        history=history,
    )

    # Update history
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append({"role": "user", "content": content})
    _sessions[session_id].append({"role": "assistant", "content": response})

    if len(_sessions[session_id]) > 20:
        _sessions[session_id] = _sessions[session_id][-20:]

    _increment_rate(session_id)

    return {
        "response": response,
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(),
        "remaining": FREE_DAILY_LIMIT - _daily_counts.get(
            datetime.now().strftime("%Y-%m-%d"), {}
        ).get(session_id, 0),
    }
