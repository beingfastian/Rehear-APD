# WebSocket entry point for the Phase 4 LangGraph voice agent.
#
# Protocol — all messages are JSON strings:
#
#   CLIENT → SERVER
#     { "type": "session_init",  "session_id": str, "instructions": list }
#     { "type": "audio",         "data": "<base64 webm>" }
#     { "type": "session_end" }
#
#   SERVER → CLIENT
#     { "type": "session_status", "status": "active"|"stopped", "total_chunks": int }
#     { "type": "transcript",     "text": str }
#     { "type": "intent",         "intent": str, "confidence": float }
#     { "type": "tts_audio",      "data": "<base64 mp3>", "text": str }
#     { "type": "state_update",   "chunk_index": int, "total": int,
#                                 "voice_state": str, "intent": str }
#     { "type": "navigate",       "target": str }
#     { "type": "error",          "message": str }

import json

from fastapi import WebSocket, WebSocketDisconnect

from .graph import voice_graph
from .state import VoiceAgentState
from .utils.stt import decode_base64_audio


async def voice_agent_ws_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()

    # Per-connection mutable session state
    session: VoiceAgentState = {
        "chunk_index":  -1,
        "total_chunks":  0,
        "voice_state":  "IDLE",
        "instructions": [],
        "session_id":   None,
    }

    async def send(obj: dict) -> None:
        try:
            await websocket.send_text(json.dumps(obj))
        except Exception:
            pass

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await send({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type")

            # ── Session init ────────────────────────────────────────────────
            if msg_type == "session_init":
                instructions = msg.get("instructions") or []
                session["session_id"]   = msg.get("session_id", "session")
                session["instructions"] = instructions
                session["total_chunks"] = len(instructions)
                session["chunk_index"]  = -1
                session["voice_state"]  = "SESSION_ACTIVE"
                await send({
                    "type":         "session_status",
                    "status":       "active",
                    "total_chunks": len(instructions),
                })
                continue

            # ── Session end ─────────────────────────────────────────────────
            if msg_type == "session_end":
                session["voice_state"] = "STOPPED"
                await send({"type": "session_status", "status": "stopped", "total_chunks": 0})
                break

            # ── Audio chunk ─────────────────────────────────────────────────
            if msg_type == "audio":
                b64 = msg.get("data", "")
                audio_bytes = decode_base64_audio(b64)
                if not audio_bytes:
                    continue

                # Run the LangGraph turn
                turn_state: VoiceAgentState = {
                    **session,
                    "audio_data":    audio_bytes,
                    "transcript":    None,
                    "intent":        None,
                    "intent_confidence": None,
                    "tts_text":      None,
                    "tts_audio_b64": None,
                    "navigate_target": None,
                    "error":         None,
                }

                try:
                    result = await voice_graph.ainvoke(turn_state)
                except Exception as e:
                    await send({"type": "error", "message": str(e)})
                    continue

                # Stream results back to client
                if result.get("transcript"):
                    await send({"type": "transcript", "text": result["transcript"]})

                if result.get("intent") and result["intent"] != "unknown":
                    await send({
                        "type":       "intent",
                        "intent":     result["intent"],
                        "confidence": result.get("intent_confidence", 0.0),
                    })

                if result.get("tts_audio_b64"):
                    await send({
                        "type": "tts_audio",
                        "data": result["tts_audio_b64"],
                        "text": result.get("tts_text", ""),
                    })

                if result.get("navigate_target"):
                    await send({"type": "navigate", "target": result["navigate_target"]})

                # Persist updated cursor / state for next turn
                session["chunk_index"] = result.get("chunk_index", session["chunk_index"])
                session["voice_state"] = result.get("voice_state", session["voice_state"])

                await send({
                    "type":        "state_update",
                    "chunk_index": session["chunk_index"],
                    "total":       session["total_chunks"],
                    "voice_state": session["voice_state"],
                    "intent":      result.get("intent", "unknown"),
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await send({"type": "error", "message": str(e)})
        except Exception:
            pass
