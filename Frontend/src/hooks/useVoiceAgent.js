// Frontend/src/hooks/useVoiceAgent.js
// Phase 4 — LangGraph WebSocket agent hook.
// Only active when isAdvancedMode = true in VoiceControlContext.
//
// Protocol (see backend/voice_agent/websocket_handler.py for full spec):
//   CLIENT → SERVER:
//     { type: "session_init",  session_id, instructions }
//     { type: "audio",         data: "<base64 webm>" }
//     { type: "session_end" }
//   SERVER → CLIENT:
//     { type: "session_status", status, total_chunks }
//     { type: "transcript",     text }
//     { type: "intent",         intent, confidence }
//     { type: "tts_audio",      data: "<base64 mp3>", text }
//     { type: "state_update",   chunk_index, total, voice_state, intent }
//     { type: "navigate",       target }
//     { type: "error",          message }

import { useRef, useCallback } from 'react';

// Use a dedicated env var for the voice agent; fall back to same host /ws/voice-agent.
// REACT_APP_WS_URL points to /ws/live-transcription — do NOT reuse it here.
const WS_URL = process.env.REACT_APP_VOICE_AGENT_WS_URL
  || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:10000/ws/voice-agent`;

const CHUNK_MS      = 250;   // audio chunk interval
const RECONNECT_MS  = 3000;  // reconnect delay on drop

export default function useVoiceAgent({ onNavigate } = {}) {
  const wsRef          = useRef(null);
  const mediaRecRef    = useRef(null);
  const reconnTimerRef = useRef(null);
  const mountedRef     = useRef(true);
  const sessionRef     = useRef(null); // { id, instructions }

  // ── Play base64-encoded mp3 audio ────────────────────────────────────────
  const playBase64Audio = useCallback((base64) => {
    try {
      const bytes   = atob(base64);
      const buffer  = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
      const blob    = new Blob([buffer], { type: 'audio/mpeg' });
      const url     = URL.createObjectURL(blob);
      const audio   = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('[VoiceAgent] audio play failed:', e);
    }
  }, []);

  // ── Handle incoming WebSocket messages ───────────────────────────────────
  const handleMessage = useCallback((raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'tts_audio':
        if (msg.data) playBase64Audio(msg.data);
        break;
      case 'navigate':
        if (msg.target && onNavigate) onNavigate(msg.target);
        break;
      case 'error':
        console.warn('[VoiceAgent] server error:', msg.message);
        break;
      default:
        break;
    }
  }, [playBase64Audio, onNavigate]);

  // ── Connect WebSocket ────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    clearTimeout(reconnTimerRef.current);

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      // Re-init session if one was active before reconnect
      if (sessionRef.current) {
        ws.send(JSON.stringify({
          type:         'session_init',
          session_id:   sessionRef.current.id,
          instructions: sessionRef.current.instructions,
        }));
      }
    };
    ws.onmessage = (e) => handleMessage(e.data);
    ws.onclose   = () => {
      if (mountedRef.current && sessionRef.current) {
        // Auto-reconnect while session is active
        reconnTimerRef.current = setTimeout(connect, RECONNECT_MS);
      }
    };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [handleMessage]);

  // ── Init session ─────────────────────────────────────────────────────────
  const initSession = useCallback((sessionId, instructions) => {
    sessionRef.current = { id: sessionId, instructions };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type:         'session_init',
        session_id:   sessionId,
        instructions: instructions,
      }));
    }
  }, []);

  // ── Start recording mic audio ─────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (mediaRecRef.current) return; // already recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec    = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      rec.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result.split(',')[1];
          wsRef.current.send(JSON.stringify({ type: 'audio', data: b64 }));
        };
        reader.readAsDataURL(e.data);
      };

      rec.start(CHUNK_MS);
      mediaRecRef.current = rec;
    } catch (e) {
      console.warn('[VoiceAgent] mic access denied:', e);
    }
  }, []);

  // ── Stop recording ───────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecRef.current) {
      mediaRecRef.current.stop();
      mediaRecRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecRef.current = null;
    }
  }, []);

  // ── Disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    sessionRef.current = null;
    clearTimeout(reconnTimerRef.current);
    stopRecording();
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'session_end' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopRecording]);

  return { connect, disconnect, initSession, startRecording, stopRecording };
}
