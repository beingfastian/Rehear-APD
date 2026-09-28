from fastapi import APIRouter, WebSocket

from app.voice_agent.websocket_handler import voice_agent_ws_endpoint

router = APIRouter(tags=["voice-agent"])


@router.websocket("/ws/voice-agent")
async def ws_voice_agent(websocket: WebSocket):
    """LangGraph voice agent (speech → intent → spoken response)."""
    await voice_agent_ws_endpoint(websocket)
