import asyncio
import base64
import json
from types import SimpleNamespace

import pytest

from app.voice_agent import graph as graph_module
from app.voice_agent.nodes import back_node, navigate_node, next_node, rehear_node
from app.voice_agent.utils import chunker, stt
from app.voice_agent.utils.stt import decode_base64_audio

INSTRUCTIONS = [
    {"instruction": "Open your book", "steps": [{"text": "Open your book"}]},
    {"text": "Turn to page five"},
    "Close the book",
]


@pytest.fixture(autouse=True)
def silent_tts(monkeypatch):
    async def fake_synthesise(text):
        return base64.b64encode(f"mp3:{text}".encode()).decode()

    for module in (next_node, back_node, rehear_node, navigate_node):
        monkeypatch.setattr(module, "synthesise", fake_synthesise)


def run(coro):
    return asyncio.run(coro)


# ── Pure helpers ───────────────────────────────────────────────────────────

def test_chunker_handles_all_instruction_shapes():
    assert chunker.get_all_texts(INSTRUCTIONS) == ["Open your book", "Turn to page five", "Close the book"]
    assert chunker.get_instruction_text({"steps": [{"text": "Step text"}]}) == "Step text"


@pytest.mark.parametrize(
    "intent, route",
    [
        ("next", "next"), ("back", "back"), ("rehear", "rehear"), ("stop", "stop"),
        ("navigate_settings", "navigate"), ("navigate_live", "navigate"),
        ("dance", "unknown"), (None, "unknown"),
    ],
)
def test_route_intent(intent, route):
    assert graph_module.route_intent({"intent": intent}) == route


def test_decode_base64_audio_rejects_garbage():
    assert decode_base64_audio(base64.b64encode(b"webm").decode()) == b"webm"
    assert decode_base64_audio("***not base64***") == b""
    assert decode_base64_audio("") == b""


# ── Navigation nodes ───────────────────────────────────────────────────────

def test_next_walks_forward_and_stops_at_end():
    state = {"instructions": INSTRUCTIONS, "chunk_index": -1}
    texts = []
    for _ in range(3):
        state = run(next_node.next_node(state))
        texts.append(state["tts_text"])
    assert texts == ["Open your book", "Turn to page five", "Close the book"]

    end = run(next_node.next_node(state))
    assert (end["chunk_index"], end["voice_state"], end["tts_text"]) == (2, "END_OF_CHUNKS", "No more instructions.")


def test_back_never_goes_below_first_instruction():
    state = run(back_node.back_node({"instructions": INSTRUCTIONS, "chunk_index": 1}))
    assert (state["chunk_index"], state["tts_text"]) == (0, "Open your book")
    state = run(back_node.back_node(state))
    assert state["chunk_index"] == 0


def test_nodes_without_instructions():
    for node in (next_node.next_node, back_node.back_node, rehear_node.rehear_node):
        state = run(node({"instructions": [], "chunk_index": -1}))
        assert state["tts_text"] == "No instructions loaded."


def test_navigate_node_maps_intent_to_page():
    state = run(navigate_node.navigate_node({"intent": "navigate_media"}))
    assert state["navigate_target"] == "media"


# ── WebSocket end to end (graph runs for real; OpenAI is faked) ─────────────

class FakeAsyncOpenAI:
    def __init__(self, transcript, intent):
        async def transcribe(**kwargs):
            return transcript

        async def classify(**kwargs):
            content = json.dumps({"intent": intent, "confidence": 0.93})
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

        self.audio = SimpleNamespace(transcriptions=SimpleNamespace(create=transcribe))
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=classify))


def fake_voice_client(monkeypatch, transcript="next please", intent="next"):
    from app.voice_agent.nodes import intent_node

    client = FakeAsyncOpenAI(transcript, intent)
    monkeypatch.setattr(stt, "get_async_openai_client", lambda: client)
    monkeypatch.setattr(intent_node, "get_async_openai_client", lambda: client)


def audio_message():
    return json.dumps({"type": "audio", "data": base64.b64encode(b"fake-webm").decode()})


def test_websocket_session_flow(client, monkeypatch):
    fake_voice_client(monkeypatch)

    with client.websocket_connect("/ws/voice-agent") as ws:
        ws.send_text(json.dumps({"type": "session_init", "session_id": "s1", "instructions": INSTRUCTIONS}))
        assert ws.receive_json() == {"type": "session_status", "status": "active", "total_chunks": 3}

        ws.send_text(audio_message())
        messages = [ws.receive_json() for _ in range(4)]

        assert messages[0] == {"type": "transcript", "text": "next please"}
        assert messages[1] == {"type": "intent", "intent": "next", "confidence": 0.93}
        assert messages[2]["type"] == "tts_audio" and messages[2]["text"] == "Open your book"
        assert messages[3] == {
            "type": "state_update", "chunk_index": 0, "total": 3, "voice_state": "READING", "intent": "next",
        }

        ws.send_text(json.dumps({"type": "session_end"}))
        assert ws.receive_json()["status"] == "stopped"


def test_websocket_navigation_command(client, monkeypatch):
    fake_voice_client(monkeypatch, transcript="open settings", intent="navigate_settings")

    with client.websocket_connect("/ws/voice-agent") as ws:
        ws.send_text(audio_message())
        types = {}
        for _ in range(5):
            message = ws.receive_json()
            types[message["type"]] = message

    assert types["navigate"] == {"type": "navigate", "target": "settings"}


def test_websocket_rejects_invalid_json(client):
    with client.websocket_connect("/ws/voice-agent") as ws:
        ws.send_text("{not json")
        assert ws.receive_json() == {"type": "error", "message": "Invalid JSON"}
