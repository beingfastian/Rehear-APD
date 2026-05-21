# backend/voice_agent/utils/chunker.py
# Helpers for extracting readable text from instruction objects.

from typing import Any, List, Optional


def get_instruction_text(instruction: Any) -> str:
    """Extract the readable text from a variety of instruction object shapes."""
    if isinstance(instruction, str):
        return instruction
    if isinstance(instruction, dict):
        # Prefer 'instruction' key, fall back to 'text', then first step text
        if "instruction" in instruction:
            return str(instruction["instruction"])
        if "text" in instruction:
            return str(instruction["text"])
        steps = instruction.get("steps", [])
        if steps and isinstance(steps[0], dict):
            return str(steps[0].get("text", ""))
    return str(instruction)


def get_all_texts(instructions: List[Any]) -> List[str]:
    return [get_instruction_text(i) for i in instructions]
