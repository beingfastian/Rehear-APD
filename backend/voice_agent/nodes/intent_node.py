import os, json
from openai import AsyncOpenAI
from ..state import VoiceAgentState

_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

SYSTEM = """You are a voice command classifier for an educational audio app.
Given the transcribed user speech, output JSON with exactly two keys:
  "intent": one of: rehear | next | back | stop | navigate_dashboard |
            navigate_media | navigate_workspace | navigate_settings |
            navigate_help | navigate_live | unknown
  "confidence": float 0.0-1.0
Reply with JSON only, no extra text."""


async def intent_node(state: VoiceAgentState) -> VoiceAgentState:
    transcript = state.get("transcript", "").strip()
    if not transcript:
        return {**state, "intent": "unknown", "intent_confidence": 0.0}
    try:
        resp = await _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user",   "content": transcript},
            ],
            temperature=0,
            max_tokens=60,
        )
        data = json.loads(resp.choices[0].message.content)
        return {**state, "intent": data.get("intent", "unknown"),
                "intent_confidence": float(data.get("confidence", 0.0))}
    except Exception as e:
        print(f"[IntentNode] error: {e}")
        return {**state, "intent": "unknown", "intent_confidence": 0.0}
