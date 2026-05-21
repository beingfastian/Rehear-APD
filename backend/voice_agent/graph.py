# backend/voice_agent/graph.py
# LangGraph StateGraph wiring for the voice agent.
#
# Turn flow:
#   audio_data → stt → intent → [route] →
#     rehear / next / back / stop / navigate / unknown → (tts already embedded)

from langgraph.graph import StateGraph, END
from .state import VoiceAgentState
from .nodes.stt_node      import stt_node
from .nodes.intent_node   import intent_node
from .nodes.rehear_node   import rehear_node
from .nodes.next_node     import next_node
from .nodes.back_node     import back_node
from .nodes.stop_node     import stop_node
from .nodes.navigate_node import navigate_node
from .nodes.unknown_node  import unknown_node
from .nodes.error_node    import error_node


NAV_INTENTS = {
    "navigate_dashboard", "navigate_media", "navigate_workspace",
    "navigate_settings",  "navigate_help",  "navigate_live",
}


def route_intent(state: VoiceAgentState) -> str:
    intent = state.get("intent", "unknown")
    if intent == "rehear":   return "rehear"
    if intent == "next":     return "next"
    if intent == "back":     return "back"
    if intent == "stop":     return "stop"
    if intent in NAV_INTENTS: return "navigate"
    return "unknown"


def build_graph() -> StateGraph:
    g = StateGraph(VoiceAgentState)

    g.add_node("stt",      stt_node)
    g.add_node("intent",   intent_node)
    g.add_node("rehear",   rehear_node)
    g.add_node("next",     next_node)
    g.add_node("back",     back_node)
    g.add_node("stop",     stop_node)
    g.add_node("navigate", navigate_node)
    g.add_node("unknown",  unknown_node)
    g.add_node("error",    error_node)

    g.set_entry_point("stt")
    g.add_edge("stt", "intent")
    g.add_conditional_edges("intent", route_intent, {
        "rehear":   "rehear",
        "next":     "next",
        "back":     "back",
        "stop":     "stop",
        "navigate": "navigate",
        "unknown":  "unknown",
    })

    for node in ("rehear", "next", "back", "stop", "navigate", "unknown", "error"):
        g.add_edge(node, END)

    return g.compile()


# Compiled graph — imported by websocket_handler
voice_graph = build_graph()
