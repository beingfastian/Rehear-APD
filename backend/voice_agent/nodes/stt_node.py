from ..state import VoiceAgentState
from ..utils.stt import transcribe


async def stt_node(state: VoiceAgentState) -> VoiceAgentState:
    audio = state.get("audio_data", b"")
    transcript = await transcribe(audio)
    return {**state, "transcript": transcript}
