// hooks/useKeywordListener.js
// Dead-simple keyword-only voice listener.
// Opens mic, continuously listens, only reacts to: "start", "next", "back".
// Everything else is silently discarded.

import { useState, useEffect, useRef, useCallback } from 'react';

const KEYWORDS = {
  start: ['start', 'begin', 'play', 'first', 'restart'],
  next:  ['next', 'skip', 'forward'],
  back:  ['back', 'previous', 'go back'],
};

function detectKeyword(transcript) {
  const words = transcript.toLowerCase().trim().split(/\s+/);
  // Check the LAST word spoken (most recent intent)
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    for (const [action, triggers] of Object.entries(KEYWORDS)) {
      if (triggers.includes(w)) return action;
    }
  }
  // Also check full phrase
  const full = transcript.toLowerCase().trim();
  for (const [action, triggers] of Object.entries(KEYWORDS)) {
    if (triggers.some(t => full.includes(t))) return action;
  }
  return null;
}

export default function useKeywordListener({ onStart, onNext, onBack, enabled = true }) {
  const [status, setStatus] = useState({
    micActive: false,
    lastHeard: '',
    lastKeyword: '',
    error: '',
    restarts: 0,
  });

  const handlersRef = useRef({ onStart, onNext, onBack });
  useEffect(() => {
    handlersRef.current = { onStart, onNext, onBack };
  }, [onStart, onNext, onBack]);

  const recRef = useRef(null);
  const activeRef = useRef(false);
  const restartCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      // Stop if disabled
      activeRef.current = false;
      try { recRef.current?.stop(); } catch {}
      setStatus(s => ({ ...s, micActive: false }));
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus(s => ({ ...s, error: 'Speech API not available in this browser' }));
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    recRef.current = rec;

    const clearHeardTimerRef = { current: null };

    const resetClearHeardTimer = () => {
      if (clearHeardTimerRef.current) {
        clearTimeout(clearHeardTimerRef.current);
      }
      clearHeardTimerRef.current = setTimeout(() => {
        if (recRef.current === rec && activeRef.current) {
          setStatus(s => ({ ...s, lastHeard: '' }));
        }
      }, 2000);
    };

    rec.onstart = () => {
      if (recRef.current !== rec) return;
      setStatus(s => ({ ...s, micActive: true, error: '' }));
    };

    rec.onresult = (event) => {
      if (recRef.current !== rec) return;
      resetClearHeardTimer(); // Reset the 2-second silence timer on any speech
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;

        if (!isFinal) {
          // Show interim so user sees mic is hearing them
          setStatus(s => ({ ...s, lastHeard: `…${transcript}` }));
          continue;
        }

        // Final result — check for keyword
        setStatus(s => ({ ...s, lastHeard: transcript }));
        const keyword = detectKeyword(transcript);
        if (keyword) {
          setStatus(s => ({ ...s, lastKeyword: keyword }));
          const h = handlersRef.current;
          if (keyword === 'start') h.onStart?.();
          if (keyword === 'next')  h.onNext?.();
          if (keyword === 'back')  h.onBack?.();

          // Auto-clear the active keyword highlight after 1 second
          setTimeout(() => {
            setStatus(s => s.lastKeyword === keyword ? { ...s, lastKeyword: '' } : s);
          }, 1000);
        }
        // else: silently discard — only keywords matter
      }
    };

    rec.onerror = (e) => {
      if (recRef.current !== rec) return;
      if (e.error === 'no-speech') {
        // Normal — no one spoke, will restart
        return;
      }
      if (e.error === 'aborted') return;
      if (e.error === 'not-allowed') {
        setStatus(s => ({
          ...s,
          micActive: false,
          error: 'Mic blocked — click 🔒 in address bar → Allow microphone',
        }));
        activeRef.current = false;
        return;
      }
      setStatus(s => ({ ...s, error: e.error }));
    };

    rec.onend = () => {
      if (recRef.current !== rec) return;
      if (activeRef.current) {
        restartCountRef.current++;
        setStatus(s => ({ ...s, restarts: restartCountRef.current }));
        // Auto-restart after brief pause
        setTimeout(() => {
          if (recRef.current !== rec || !activeRef.current) return;
          try { rec.start(); } catch (err) {
            setStatus(s => ({ ...s, micActive: false, error: `Restart failed: ${err.message}` }));
          }
        }, 400); // 400ms delay to cleanly allow device release
      } else {
        setStatus(s => ({ ...s, micActive: false }));
      }
    };

    // Start listening
    activeRef.current = true;
    restartCountRef.current = 0;
    try {
      rec.start();
    } catch (err) {
      setStatus(s => ({ ...s, error: `Start failed: ${err.message}` }));
    }

    return () => {
      activeRef.current = false;
      if (clearHeardTimerRef.current) {
        clearTimeout(clearHeardTimerRef.current);
      }
      if (recRef.current === rec) {
        recRef.current = null;
      }
      try { rec.stop(); } catch {}
    };
  }, [enabled]);

  return status;
}
