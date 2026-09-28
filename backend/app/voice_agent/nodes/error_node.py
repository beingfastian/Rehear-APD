from ..state import VoiceAgentState
from ..utils.tts import synthesise


async def error_node(state: VoiceAgentState) -> VoiceAgentState:
    state.get("error", "An error occurred.")
    audio = await synthesise("Sorry, something went wrong. Please try again.")
    return {**state, "tts_text": "Sorry, something went wrong.",
            "tts_audio_b64": audio}
