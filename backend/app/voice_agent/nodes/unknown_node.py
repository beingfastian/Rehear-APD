from ..state import VoiceAgentState
from ..utils.tts import synthesise


async def unknown_node(state: VoiceAgentState) -> VoiceAgentState:
    """Handles unrecognised commands gracefully."""
    audio = await synthesise("Sorry, I didn't catch that. Try saying next, back, or rehear.")
    return {**state, "tts_text": "Sorry, I didn't catch that.",
            "tts_audio_b64": audio}
