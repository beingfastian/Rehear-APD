# LangGraph StateGraph wiring for the voice agent.
#
# Turn flow:
#   audio_data → stt → intent → [route] →
#     rehear / next / back / stop / navigate / unknown → (tts already embedded)

from langgraph.graph import END, StateGraph

from .nodes.back_node import back_node
from .nodes.error_node import error_node
from .nodes.intent_node import intent_node
from .nodes.navigate_node import navigate_node
from .nodes.next_node import next_node
from .nodes.rehear_node import rehear_node
from .nodes.stop_node import stop_node
from .nodes.stt_node import stt_node
from .nodes.unknown_node import unknown_node
from .state import VoiceAgentState

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


ACTION_NODES = {
    "rehear":   rehear_node,
    "next":     next_node,
    "back":     back_node,
    "stop":     stop_node,
    "navigate": navigate_node,
    "unknown":  unknown_node,
}


def build_graph():
    # Node names get an "_node" suffix: LangGraph rejects node names that
    # collide with state keys (e.g. "intent", "error").
    g = StateGraph(VoiceAgentState)

    g.add_node("stt_node", stt_node)
    g.add_node("intent_node", intent_node)
    g.add_node("error_node", error_node)
    for route, node in ACTION_NODES.items():
        g.add_node(f"{route}_node", node)

    g.set_entry_point("stt_node")
    g.add_edge("stt_node", "intent_node")
    g.add_conditional_edges(
        "intent_node",
        route_intent,
        {route: f"{route}_node" for route in ACTION_NODES},
    )

    for route in (*ACTION_NODES, "error"):
        g.add_edge(f"{route}_node", END)

    return g.compile()


# Compiled graph — imported by websocket_handler
voice_graph = build_graph()
