from ..state import VoiceAgentState
from ..utils.tts import synthesise


async def stop_node(state: VoiceAgentState) -> VoiceAgentState:
    audio = await synthesise("Voice control turned off.")
    return {**state, "tts_text": "Voice control turned off.",
            "tts_audio_b64": audio, "voice_state": "STOPPED"}
