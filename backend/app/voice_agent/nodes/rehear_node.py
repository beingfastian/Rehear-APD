from ..state import VoiceAgentState
from ..utils.chunker import get_instruction_text
from ..utils.tts import synthesise


async def rehear_node(state: VoiceAgentState) -> VoiceAgentState:
    instructions = state.get("instructions") or []
    if not instructions:
        audio = await synthesise("No instructions loaded.")
        return {**state, "chunk_index": 0, "tts_text": "No instructions loaded.",
                "tts_audio_b64": audio, "voice_state": "SESSION_ACTIVE"}
    text  = get_instruction_text(instructions[0])
    audio = await synthesise(text)
    return {**state, "chunk_index": 0, "tts_text": text,
            "tts_audio_b64": audio, "voice_state": "READING"}
