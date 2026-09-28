from ..state import VoiceAgentState
from ..utils.tts import synthesise

# Map intent names to frontend page keys and readable labels
NAV_MAP = {
    "navigate_dashboard":  ("dashboard",      "Navigating to dashboard."),
    "navigate_media":      ("media",           "Opening media vault."),
    "navigate_workspace":  ("segment",         "Opening your workspace."),
    "navigate_settings":   ("settings",        "Opening settings."),
    "navigate_help":       ("help",            "Opening help center."),
    "navigate_live":       ("live-recording",  "Starting a new recording."),
}


async def navigate_node(state: VoiceAgentState) -> VoiceAgentState:
    intent  = state.get("intent", "")
    target, msg = NAV_MAP.get(intent, ("dashboard", "Navigating."))
    audio   = await synthesise(msg)
    return {**state, "navigate_target": target, "tts_text": msg,
            "tts_audio_b64": audio}
