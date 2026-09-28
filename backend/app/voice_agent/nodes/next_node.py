from ..state import VoiceAgentState
from ..utils.chunker import get_instruction_text
from ..utils.tts import synthesise


async def next_node(state: VoiceAgentState) -> VoiceAgentState:
    instructions = state.get("instructions") or []
    total  = len(instructions)
    idx    = state.get("chunk_index", -1) + 1

    if not instructions:
        audio = await synthesise("No instructions loaded.")
        return {**state, "tts_text": "No instructions loaded.",
                "tts_audio_b64": audio, "voice_state": "SESSION_ACTIVE"}

    if idx >= total:
        audio = await synthesise("No more instructions.")
        return {**state, "chunk_index": total - 1, "tts_text": "No more instructions.",
                "tts_audio_b64": audio, "voice_state": "END_OF_CHUNKS"}

    text  = get_instruction_text(instructions[idx])
    audio = await synthesise(text)
    return {**state, "chunk_index": idx, "tts_text": text,
            "tts_audio_b64": audio, "voice_state": "READING"}
