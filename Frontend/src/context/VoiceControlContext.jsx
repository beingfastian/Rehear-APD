// Frontend/src/context/VoiceControlContext.jsx
// Phase 3 — Web Speech API voice control system.
//
// Provides:
//   voiceState        STOPPED | IDLE | SESSION_ACTIVE | READING | END_OF_CHUNKS
//   currentChunkIndex index of the chunk currently being read (or -1)
//   isAdvancedMode    when true, Phase 4 LangGraph agent is used instead
//   activateSession(instructions)  load chunks into the queue
//   deactivateSession()            clear queue, return to IDLE
//   nextChunk / prevChunk / rehear imperative playback controls
//   toggleVoice()                  STOPPED ↔ IDLE toggle
//   setIsAdvancedMode(bool)

import React, {
  createContext, useContext, useRef, useState, useCallback, useEffect,
} from 'react';
import {
  VOICE_STATES, matchVoiceCommand, speakText, stopSpeaking,
} from '../utils/voiceUtils';

const VoiceControlContext = createContext(null);

export function useVoiceControl() {
  const ctx = useContext(VoiceControlContext);
  if (!ctx) throw new Error('useVoiceControl must be inside VoiceControlProvider');
  return ctx;
}

export function VoiceControlProvider({ children, onNavigate }) {
  const [voiceState,        setVoiceState]        = useState(VOICE_STATES.IDLE); // start listening immediately
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [isAdvancedMode,    setIsAdvancedMode]     = useState(false);

  // ── Debug info (shown in floating panel) ─────────────────────────────────
  const [debugInfo, setDebugInfo] = useState({
    micStatus: 'initializing',  // 'initializing' | 'listening' | 'denied' | 'unavailable' | 'error'
    lastHeard: '',
    lastCommand: '',
    lastError: '',
  });

  const chunksRef       = useRef([]);           // loaded instruction objects
  const recognitionRef  = useRef(null);
  const isActiveRef     = useRef(false);         // should recognition keep running
  const voiceStateRef   = useRef(VOICE_STATES.IDLE);
  const lastTriggeredIndexRef = useRef(-1);

  // Keep ref in sync so recognition callbacks have current state without stale closures
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);

  // ── Speech synthesis helpers ─────────────────────────────────────────────
  const readChunk = useCallback((idx) => {
    const chunks = chunksRef.current;
    if (!chunks.length) return;
    const clampedIdx = Math.max(0, Math.min(idx, chunks.length - 1));
    const text = chunks[clampedIdx]?.instruction || chunks[clampedIdx]?.text || '';
    if (!text) return;

    setCurrentChunkIndex(clampedIdx);
    setVoiceState(VOICE_STATES.READING);

    speakText(text, {
      onEnd: () => {
        // Return to SESSION_ACTIVE unless the user stopped voice
        if (voiceStateRef.current !== VOICE_STATES.STOPPED) {
          setVoiceState(VOICE_STATES.SESSION_ACTIVE);
        }
      },
    });
  }, []);

  const sayFeedback = useCallback((text) => {
    speakText(text, {
      onEnd: () => {
        if (voiceStateRef.current !== VOICE_STATES.STOPPED) {
          setVoiceState(
            chunksRef.current.length > 0
              ? VOICE_STATES.SESSION_ACTIVE
              : VOICE_STATES.IDLE
          );
        }
      },
    });
  }, []);

  // ── Public playback controls ─────────────────────────────────────────────
  const rehear = useCallback(() => {
    if (!chunksRef.current.length) { sayFeedback('No instructions loaded'); return; }
    readChunk(0);
  }, [readChunk, sayFeedback]);

  const nextChunk = useCallback(() => {
    const idx = currentChunkIndex;
    const total = chunksRef.current.length;
    if (!total) { sayFeedback('No instructions loaded'); return; }
    if (idx >= total - 1) {
      setVoiceState(VOICE_STATES.END_OF_CHUNKS);
      sayFeedback('No more instructions');
      return;
    }
    readChunk(idx + 1);
  }, [currentChunkIndex, readChunk, sayFeedback]);

  const prevChunk = useCallback(() => {
    const idx = currentChunkIndex;
    const total = chunksRef.current.length;
    if (!total) { sayFeedback('No instructions loaded'); return; }
    readChunk(Math.max(0, idx - 1));
  }, [currentChunkIndex, readChunk, sayFeedback]);

  // ── Session management ───────────────────────────────────────────────────
  const activateSession = useCallback((instructions) => {
    chunksRef.current = instructions || [];
    setCurrentChunkIndex(-1);
    if (voiceStateRef.current !== VOICE_STATES.STOPPED) {
      setVoiceState(VOICE_STATES.SESSION_ACTIVE);
    }
  }, []);

  const deactivateSession = useCallback(() => {
    chunksRef.current = [];
    setCurrentChunkIndex(-1);
    stopSpeaking();
    if (voiceStateRef.current !== VOICE_STATES.STOPPED) {
      setVoiceState(VOICE_STATES.IDLE);
    }
  }, []);

  // ── Stable ref for handlers — avoids recreating recognition on every render ─
  const handlersRef = useRef({});
  useEffect(() => {
    handlersRef.current = { rehear, nextChunk, prevChunk, onNavigate };
  }, [rehear, nextChunk, prevChunk, onNavigate]);

  // ── Recognition command dispatcher (calls via ref — always fresh) ─────────
  const dispatchCommand = useCallback((cmd, transcript) => {
    console.log('[VoiceControl] command:', cmd, '| heard:', transcript);
    const h = handlersRef.current;
    switch (cmd) {
      case 'rehear':              h.rehear?.();    break;
      case 'next':                h.nextChunk?.(); break;
      case 'back':                h.prevChunk?.(); break;
      case 'stop':
        stopSpeaking();
        setVoiceState(VOICE_STATES.STOPPED);
        isActiveRef.current = false;
        try { recognitionRef.current?.stop(); } catch { }
        break;
      case 'navigate_dashboard':  h.onNavigate?.('dashboard');       break;
      case 'navigate_media':      h.onNavigate?.('media');           break;
      case 'navigate_workspace':  h.onNavigate?.('segment');         break;
      case 'navigate_settings':   h.onNavigate?.('settings');        break;
      case 'navigate_help':       h.onNavigate?.('help');            break;
      case 'navigate_live':       h.onNavigate?.('live-recording');  break;
      default: break;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SpeechRecognition setup — created ONCE, auto-starts ──────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('[VoiceControl] SpeechRecognition API not available in this browser');
      setDebugInfo(d => ({ ...d, micStatus: 'unavailable', lastError: 'SpeechRecognition API not available' }));
      return;
    }
    console.log('[VoiceControl] Creating SpeechRecognition instance…');

    let restartCount = 0;

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;  // show interim results so we can see mic is hearing
    rec.lang           = 'en-US';

    rec.onstart = () => {
      console.log('[VoiceControl] 🎙️ Mic STARTED — listening for commands');
      lastTriggeredIndexRef.current = -1;
      setDebugInfo(d => ({ ...d, micStatus: 'listening', lastError: '' }));
    };

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence ?? 1;
        const isFinal = event.results[i].isFinal;

        // Show interim results in debug so we know mic is hearing
        setDebugInfo(d => ({ ...d, lastHeard: isFinal ? transcript : `…${transcript}` }));

        if (i <= lastTriggeredIndexRef.current) {
          continue;
        }

        console.log('[VoiceControl] heard:', transcript, '| confidence:', confidence, '| state:', voiceStateRef.current);
        // Skip low-confidence results during TTS playback (AEC guard)
        if (voiceStateRef.current === VOICE_STATES.READING && confidence < 0.90) {
          console.log('[VoiceControl] ⏩ Skipped (AEC guard, reading state)');
          continue;
        }

        const cmd = matchVoiceCommand(transcript);
        if (cmd) {
          console.log('[VoiceControl] ✅ command:', cmd, '| transcript:', transcript);
          lastTriggeredIndexRef.current = i;
          setDebugInfo(d => ({ ...d, lastCommand: cmd, lastHeard: transcript }));
          dispatchCommand(cmd, transcript);
        } else if (isFinal) {
          console.log('[VoiceControl] ❌ no command matched for final:', transcript);
          setDebugInfo(d => ({ ...d, lastCommand: '(no match)' }));
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') {
        // Still track it in debug so we know mic is cycling
        setDebugInfo(d => ({ ...d, lastError: `no-speech (restart #${restartCount})` }));
        return;
      }
      if (e.error === 'aborted') {
        console.log('[VoiceControl] Recognition aborted (normal during restart)');
        return;
      }
      console.warn('[VoiceControl] ⚠️ error:', e.error);
      if (e.error === 'not-allowed') {
        console.error('[VoiceControl] 🚫 Microphone permission DENIED.');
        setDebugInfo(d => ({ ...d, micStatus: 'denied', lastError: 'Mic permission DENIED — click 🔒 in address bar → Allow' }));
      } else {
        setDebugInfo(d => ({ ...d, lastError: `error: ${e.error}` }));
      }
    };

    rec.onend = () => {
      restartCount++;
      console.log('[VoiceControl] Recognition ended. isActive:', isActiveRef.current, '| restarts:', restartCount);
      setDebugInfo(d => ({ ...d, micStatus: isActiveRef.current ? 'restarting' : 'stopped' }));
      if (isActiveRef.current) {
        console.log('[VoiceControl] Restarting recognition…');
        setTimeout(() => {
          try { rec.start(); } catch (err) {
            console.warn('[VoiceControl] Restart failed:', err.message);
            setDebugInfo(d => ({ ...d, micStatus: 'error', lastError: `restart failed: ${err.message}` }));
          }
        }, 300); // slightly longer delay to avoid rapid restart issues
      }
    };

    recognitionRef.current = rec;

    // Auto-start if voice state is not STOPPED (initial state is IDLE)
    if (voiceStateRef.current !== VOICE_STATES.STOPPED) {
      console.log('[VoiceControl] Auto-starting recognition (initial state:', voiceStateRef.current, ')');
      isActiveRef.current = true;
      try {
        rec.start();
      } catch (err) {
        console.warn('[VoiceControl] Initial start failed:', err.message);
      }
    }

    return () => {
      console.log('[VoiceControl] Cleanup — stopping recognition');
      isActiveRef.current = false;
      try { rec.stop(); } catch { }
    };
  }, [dispatchCommand]);

  // Start / stop recognition when voiceState changes AFTER initial mount
  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    if (voiceState === VOICE_STATES.STOPPED) {
      console.log('[VoiceControl] State → STOPPED, stopping recognition');
      isActiveRef.current = false;
      try { rec.stop(); } catch { }
    } else if (!isActiveRef.current) {
      console.log('[VoiceControl] State →', voiceState, ', starting recognition');
      isActiveRef.current = true;
      try { rec.start(); } catch (err) {
        console.warn('[VoiceControl] Start failed (may already be running):', err.message);
      }
    }
  }, [voiceState]);

  // ── Toggle voice on/off ──────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (voiceState === VOICE_STATES.STOPPED) {
      setVoiceState(
        chunksRef.current.length > 0
          ? VOICE_STATES.SESSION_ACTIVE
          : VOICE_STATES.IDLE
      );
    } else {
      stopSpeaking();
      setVoiceState(VOICE_STATES.STOPPED);
    }
  }, [voiceState]);

  const value = {
    voiceState,
    currentChunkIndex,
    isAdvancedMode,
    setIsAdvancedMode,
    activateSession,
    deactivateSession,
    toggleVoice,
    rehear,
    nextChunk,
    prevChunk,
    debugInfo,
  };

  return (
    <VoiceControlContext.Provider value={value}>
      {children}
    </VoiceControlContext.Provider>
  );
}
