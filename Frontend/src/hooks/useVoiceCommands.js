// useVoiceCommands — Phase 1 voice command layer.
//
// Runs a DEDICATED SpeechRecognition instance (separate from the live
// transcription instance) that only listens for the 5 control commands.
// The live mic stream for transcription is untouched.
//
// AEC guard (Phase 1 / software-only):
//   - While TTS is playing: confidence threshold raised from 0.75 → 0.90
//   - For 1.5s after TTS ends (cooldown): same raised threshold applies
//   This is ttsPlayer's _isTTSActive flag.  Phase 2 will add WebRTC loopback AEC.
//
// Commands recognised (fuzzy match via includes / startsWith):
//   "next"          → onNext()
//   "back"          → onBack()
//   "rehear"        → onRehear()
//   "start session" → onStartSession()
//   "end session"   → onEndSession()

import { useEffect, useRef, useCallback, useState } from 'react';
import { isTTSActive } from '../utils/ttsPlayer';

const NORMAL_CONFIDENCE    = 0.75;
const TTS_CONFIDENCE       = 0.90; // raised threshold while TTS is active

// Map of keyword patterns → command key.
// Checked in order; first match wins.
const COMMAND_MAP = [
  { key: 'start_session', patterns: ['start session', 'start a session', 'new session'] },
  { key: 'end_session',   patterns: ['end session', 'stop session', 'finish session'] },
  { key: 'rehear',        patterns: ['rehear', 're-hear', 'replay', 'from start', 'from beginning'] },
  { key: 'back',          patterns: ['back', 'previous', 'go back', 'repeat'] },
  { key: 'next',          patterns: ['next', 'skip', 'forward', 'go next'] },
];

function matchCommand(transcript) {
  const full = transcript.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const words = full.split(/\s+/);
  for (const { key, patterns } of COMMAND_MAP) {
    if (patterns.includes(full)) {
      return key;
    }
    for (const pattern of patterns) {
      const patternWords = pattern.split(/\s+/);
      for (let i = 0; i <= words.length - patternWords.length; i++) {
        let match = true;
        for (let j = 0; j < patternWords.length; j++) {
          if (words[i + j] !== patternWords[j]) {
            match = false;
            break;
          }
        }
        if (match) return key;
      }
    }
  }
  return null;
}

export function useVoiceCommands({
  enabled = false,
  onNext,
  onBack,
  onRehear,
  onStartSession,
  onEndSession,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState(null);

  const recognitionRef  = useRef(null);
  const isActiveRef     = useRef(false); // tracks whether we want it running
  const handlersRef     = useRef({});
  const lastTriggeredIndexRef = useRef(-1);

  // Keep handlers current without restarting recognition.
  useEffect(() => {
    handlersRef.current = { onNext, onBack, onRehear, onStartSession, onEndSession };
  }, [onNext, onBack, onRehear, onStartSession, onEndSession]);

  // Dispatch a recognised command.
  const dispatch = useCallback((command) => {
    setLastCommand(command);
    const h = handlersRef.current;
    switch (command) {
      case 'next':          h.onNext?.();         break;
      case 'back':          h.onBack?.();         break;
      case 'rehear':        h.onRehear?.();       break;
      case 'start_session': h.onStartSession?.(); break;
      case 'end_session':   h.onEndSession?.();   break;
      default: break;
    }
  }, []);

  // Set up the recognition instance once.
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true; // show interim results so we can trigger snappily
    rec.lang           = 'en-US';

    rec.onstart = () => {
      if (recognitionRef.current !== rec) return;
      lastTriggeredIndexRef.current = -1;
      setIsListening(true);
    };

    rec.onresult = (event) => {
      if (recognitionRef.current !== rec) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result     = event.results[i][0];
        const transcript = result.transcript;
        const confidence = result.confidence ?? 1;

        if (i <= lastTriggeredIndexRef.current) continue;

        const threshold = isTTSActive() ? TTS_CONFIDENCE : 0.20;
        if (confidence < threshold) continue;

        const command = matchCommand(transcript);
        if (command) {
          lastTriggeredIndexRef.current = i;
          dispatch(command);
        }
      }
    };

    rec.onerror = (e) => {
      if (recognitionRef.current !== rec) return;
      if (e.error === 'no-speech') return; // normal — ignore
      if (e.error === 'aborted')   return; // we stopped it — ignore
      console.warn('[VoiceCommands] error:', e.error);
    };

    // Auto-restart while still active (Chrome terminates after ~60s of silence).
    rec.onend = () => {
      if (recognitionRef.current !== rec) return;
      if (isActiveRef.current) {
        setTimeout(() => {
          if (recognitionRef.current === rec && isActiveRef.current) {
            try { rec.start(); } catch { /* already started race */ }
          }
        }, 400);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;
    return () => {
      isActiveRef.current = false;
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
      }
      try { rec.stop(); } catch { }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isActiveRef.current) return;
    isActiveRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch { /* already running */ }
  }, []);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    try { recognitionRef.current?.stop(); } catch { }
    setIsListening(false);
  }, []);

  // Start/stop based on `enabled` prop.
  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
  }, [enabled, startListening, stopListening]);

  return { isListening, lastCommand };
}
