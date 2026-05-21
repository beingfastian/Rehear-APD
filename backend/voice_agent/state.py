# backend/voice_agent/state.py
# LangGraph state schema for the voice agent graph.

from typing import TypedDict, Optional, List, Any


class VoiceAgentState(TypedDict, total=False):
    # Audio input
    audio_data: Optional[bytes]         # raw PCM / webm bytes for this turn

    # STT result
    transcript: Optional[str]           # Whisper output

    # Intent classification
    intent: Optional[str]               # e.g. "next", "back", "rehear", "stop", "navigate_*"
    intent_confidence: Optional[float]

    # Session state
    session_id: Optional[str]
    instructions: Optional[List[Any]]   # list of instruction objects
    chunk_index: int                     # current playback position
    total_chunks: int
    voice_state: str                     # IDLE | SESSION_ACTIVE | READING | END_OF_CHUNKS | STOPPED

    # TTS output
    tts_text: Optional[str]
    tts_audio_b64: Optional[str]         # base64-encoded mp3

    # Navigation
    navigate_target: Optional[str]

    # Error
    error: Optional[str]
