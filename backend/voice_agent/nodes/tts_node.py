from ..state import VoiceAgentState
from ..utils.tts import synthesise


async def tts_node(state: VoiceAgentState) -> VoiceAgentState:
    """Standalone TTS node — used when audio needs to be (re)generated for tts_text."""
    text = state.get("tts_text", "")
    if not text or state.get("tts_audio_b64"):
        return state  # already generated upstream
    audio = await synthesise(text)
    return {**state, "tts_audio_b64": audio}
