// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// PERFORMANCE FIXES applied on top of existing bug fixes:
//  Perf 1 — SILENCE_DEBOUNCE_MS reduced 4000 → 2500ms
//  Perf 2 — isFilteringRef replaces isFlushingRef: lock held ONLY during GPT filter call (~1s)
//           not during TTS saves (was 3-6s). TTS saves now fire-and-forget.
//  Perf 3 — Auto-retry: if filter is in progress when new text arrives, schedule a 300ms retry
//           so accumulated text is flushed immediately once the filter finishes
//  Perf 4 — Auto-flush after filter: if text accumulated while filter ran, flush it in 100ms
//  Perf 5 — Error recovery: restore pendingText on filter failure so the text is not lost
//
// Bugs preserved from previous version:
//  Bug 1 (debounce) — now LOWER (2500ms) for performance
//  Bug 2 (lock)     — isFilteringRef is the new, narrower lock
//  Bug 3 (onend)    — recognition.onend auto-restarts mic if still recording
//  Bug 4 (no autoplay) — enqueueAudio removed from saveInstruction
//  Bug 5 (ref)      — flushPendingBufferRef keeps closure fresh
//  Bug 6 (guard)    — saveEverStartedRef still guards checkSessionComplete

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Loader2, AlertCircle, Sparkles, CheckCircle2, Volume2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import apiService from '../../services/api';

// PERF 1 — reduced from 4000 to 2500ms for snappier response
const SILENCE_DEBOUNCE_MS = 2500;

const LiveTranscriptionRecorder = ({ onComplete, onSessionComplete }) => {
  const { showNotification } = useApp();

  const [isRecording, setIsRecording] = useState(false);
  const [instructionsList, setInstructionsList] = useState([]);
  const [currentBuffer, setCurrentBuffer] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef        = useRef(null);
  const transcriptEndRef      = useRef(null);
  const silenceTimerRef       = useRef(null);
  const pendingTextRef        = useRef('');

  // PERF 2 — narrow lock: only held during GPT filter call (~1s), NOT during TTS saves
  const isFilteringRef        = useRef(false);
  // PERF 3 — retry timer: schedules a re-flush if filter is busy when silence fires
  const retryTimerRef         = useRef(null);
  // Bug 3 — track whether the mic should be live so onend can restart
  const isRecordingRef        = useRef(false);
  // Bug 5 — always-current ref to flushPendingBuffer for the recognition closure
  const flushPendingBufferRef = useRef(null);

  // ─── Audio queue refs ──────────────────────────────────────────────────────
  const audioQueueRef    = useRef([]);
  const isPlayingRef     = useRef(false);
  const currentAudioRef  = useRef(null);
  const audioUnlockedRef = useRef(false);

  // ─── Session tracking refs ─────────────────────────────────────────────────
  const sessionInstructionsRef = useRef([]);
  const pendingSavesRef        = useRef(0);
  const stopRequestedRef       = useRef(false);
  // Bug 6 — track whether at least one save has been kicked off
  const saveEverStartedRef     = useRef(false);

  // ─── 1. INIT SPEECH RECOGNITION ───────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Your browser does not support Live Speech. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const updated = (pendingTextRef.current + ' ' + transcript).trim();
          pendingTextRef.current = updated;
          setPendingText(updated);
          setCurrentBuffer('');
          clearTimeout(silenceTimerRef.current);
          // Bug 5 — call via ref so closure always has the latest function
          silenceTimerRef.current = setTimeout(
            () => flushPendingBufferRef.current?.(),
            SILENCE_DEBOUNCE_MS
          );
        } else {
          interimTranscript += transcript;
        }
      }
      setCurrentBuffer(interimTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
      } else if (event.error !== 'no-speech') {
        console.warn('[Recognition] error:', event.error);
      }
    };

    // Bug 3 — if still recording when Chrome kills the session, restart immediately
    recognition.onend = () => {
      if (isRecordingRef.current) {
        console.log('[Recognition] onend fired while still recording — restarting mic');
        try {
          recognition.start();
        } catch (err) {
          console.error('[Recognition] restart failed:', err);
        }
      }
    };

    recognitionRef.current = recognition;
    return () => {
      clearTimeout(silenceTimerRef.current);
      clearTimeout(retryTimerRef.current);
    };
  }, []);

  // ─── 2. SESSION COMPLETE CHECK ─────────────────────────────────────────────
  const checkSessionComplete = useCallback(() => {
    if (
      stopRequestedRef.current &&
      pendingSavesRef.current === 0 &&
      !isExtracting &&
      // Bug 6 — only complete if saves were actually started
      saveEverStartedRef.current &&
      sessionInstructionsRef.current.length > 0
    ) {
      const sessionJob = {
        id: `live_session_${Date.now()}`,
        name: `Live Session — ${new Date().toLocaleTimeString()}`,
        type: 'Live Transcription',
        duration: '00:00',
        status: 'Completed',
        transcription: sessionInstructionsRef.current.map(i => i.text).join('. '),
        fromLive: true,
        instructions: sessionInstructionsRef.current.map(inst => ({
          instruction: inst.text,
          steps: [{ text: inst.text, audio: inst.audioUrl }],
        })),
      };

      setIsSessionComplete(true);
      if (onSessionComplete) onSessionComplete(sessionJob);
    }
  }, [isExtracting, onSessionComplete]);

  useEffect(() => {
    if (!isExtracting) checkSessionComplete();
  }, [isExtracting, checkSessionComplete]);

  // ─── 3. AUDIO QUEUE (per-item replay button only) ──────────────────────────
  const processAudioQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const { url, itemId } = audioQueueRef.current.shift();
    isPlayingRef.current = true;

    const audio = new Audio(url);
    currentAudioRef.current = audio;

    setInstructionsList(prev =>
      prev.map(item => item.id === itemId ? { ...item, isPlaying: true } : item)
    );

    audio.play()
      .then(() => console.log('[Audio] Playing'))
      .catch(err => {
        console.error('[Audio] Blocked:', err);
        isPlayingRef.current    = false;
        currentAudioRef.current = null;
        setInstructionsList(prev =>
          prev.map(item => item.id === itemId ? { ...item, isPlaying: false } : item)
        );
        processAudioQueue();
      });

    audio.onended = () => {
      isPlayingRef.current    = false;
      currentAudioRef.current = null;
      setInstructionsList(prev =>
        prev.map(item => item.id === itemId ? { ...item, isPlaying: false } : item)
      );
      processAudioQueue();
    };
  }, []);

  const enqueueAudio = useCallback((url, itemId) => {
    audioQueueRef.current.push({ url, itemId });
    processAudioQueue();
  }, [processAudioQueue]);

  const replayAudio = useCallback((url, itemId) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    isPlayingRef.current  = false;
    audioQueueRef.current = [];
    enqueueAudio(url, itemId);
  }, [enqueueAudio]);

  // ─── 4. FLUSH BUFFER → GPT EXTRACTION ─────────────────────────────────────
  const flushPendingBuffer = useCallback(async () => {
    // PERF 2 — only the filter call is locked now, NOT the TTS saves
    if (isFilteringRef.current) {
      // PERF 3 — schedule a retry so accumulated text doesn't get dropped
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(
        () => flushPendingBufferRef.current?.(),
        300
      );
      return;
    }

    const text = pendingTextRef.current.trim();
    if (!text || text.length < 5) return;

    isFilteringRef.current = true;
    pendingTextRef.current = '';
    setPendingText('');
    setIsExtracting(true);

    try {
      const result       = await apiService.filterLiveChunk(text);
      const instructions = result?.instructions || [];

      if (instructions.length > 0) {
        const newItems = instructions.map(instructionText => ({
          id: Date.now() + Math.random(),
          text: instructionText,
          status: 'saving',
          isPlaying: false,
          audioUrl: null,
        }));

        setInstructionsList(prev => [...prev, ...newItems]);

        // Bug 6 — mark that at least one save cycle has started
        saveEverStartedRef.current = true;

        // PERF 2 + PERF 4 — fire-and-forget: do NOT await saves.
        // Lock is released immediately after the GPT filter call so the next
        // silence window can start a new filter cycle right away.
        // TTS saves run in the background via pendingSavesRef counter.
        newItems.forEach(item => saveInstruction(item.id, item.text));
      }
    } catch (err) {
      console.error('[Flush] Failed:', err);
      // PERF 5 — restore text on failure so it can be retried
      pendingTextRef.current = text;
      setPendingText(text);
    } finally {
      setIsExtracting(false);
      isFilteringRef.current = false;

      // PERF 4 — if new speech arrived while filter was running, flush immediately
      if (pendingTextRef.current.trim().length >= 5) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(
          () => flushPendingBufferRef.current?.(),
          100
        );
      }
    }
  }, []); // eslint-disable-line

  // Bug 5 — keep the ref current so the recognition closure always calls latest
  useEffect(() => {
    flushPendingBufferRef.current = flushPendingBuffer;
  }, [flushPendingBuffer]);

  // ─── 5. SAVE SINGLE INSTRUCTION ───────────────────────────────────────────
  const saveInstruction = async (itemId, instructionText) => {
    pendingSavesRef.current++;

    try {
      const saveResult = await apiService.processLiveText(instructionText);
      const audioUrl   = saveResult.instructions?.[0]?.steps?.[0]?.audio || null;

      setInstructionsList(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, status: 'saved', audioUrl } : item
        )
      );

      // Accumulate into session
      sessionInstructionsRef.current.push({ text: instructionText, audioUrl });

      // Bug 4 — DO NOT call enqueueAudio here. Audio must NOT play while recording.
      if (onComplete) onComplete(saveResult);

    } catch (err) {
      console.error('[Save] Failed:', err);
      setInstructionsList(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, status: 'error' } : item
        )
      );
    } finally {
      pendingSavesRef.current--;
      checkSessionComplete();
    }
  };

  // ─── 6. RECORDING CONTROLS ────────────────────────────────────────────────
  const unlockAudio = () => {
    if (!audioUnlockedRef.current) {
      const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      silent.play().catch(() => {});
      audioUnlockedRef.current = true;
    }
  };

  const startRecording = () => {
    unlockAudio();
    setError(null);
    setIsSessionComplete(false);
    setInstructionsList([]);
    setCurrentBuffer('');
    setPendingText('');
    pendingTextRef.current         = '';
    audioQueueRef.current          = [];
    isPlayingRef.current           = false;
    isFilteringRef.current         = false;   // PERF 2 — reset filter lock
    saveEverStartedRef.current     = false;   // Bug 6 — reset guard
    sessionInstructionsRef.current = [];
    pendingSavesRef.current        = 0;
    stopRequestedRef.current       = false;
    clearTimeout(silenceTimerRef.current);
    clearTimeout(retryTimerRef.current);     // PERF 3 — clear retry timer

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        isRecordingRef.current = true;  // Bug 3 — set before start so onend knows
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Mic start error', err);
        isRecordingRef.current = false;
      }
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;     // Bug 3 — prevent onend from restarting
    if (recognitionRef.current) recognitionRef.current.stop();
    clearTimeout(silenceTimerRef.current);
    clearTimeout(retryTimerRef.current);
    setIsRecording(false);
    setCurrentBuffer('');

    stopRequestedRef.current = true;

    // Flush any speech buffered when Stop was pressed, then check session complete
    if (pendingTextRef.current.trim()) {
      flushPendingBuffer().then(() => checkSessionComplete());
    } else {
      checkSessionComplete();
    }
  };

  const handleDiscard = () => {
    isRecordingRef.current = false;     // Bug 3 — prevent restart on discard
    if (recognitionRef.current) recognitionRef.current.stop();
    clearTimeout(silenceTimerRef.current);
    clearTimeout(retryTimerRef.current);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    pendingTextRef.current         = '';
    audioQueueRef.current          = [];
    isPlayingRef.current           = false;
    isFilteringRef.current         = false;
    saveEverStartedRef.current     = false;
    sessionInstructionsRef.current = [];
    pendingSavesRef.current        = 0;
    stopRequestedRef.current       = false;
    setInstructionsList([]);
    setCurrentBuffer('');
    setPendingText('');
    setIsRecording(false);
    setIsSessionComplete(false);
    setError(null);
  };

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [instructionsList, currentBuffer, pendingText]);

  const savedCount  = instructionsList.filter(i => i.status === 'saved').length;
  const stillSaving = instructionsList.some(i => i.status === 'saving') || isExtracting;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
            <Sparkles className={`w-5 h-5 ${isRecording ? 'text-blue-500' : 'text-gray-400'}`} />
            Smart Instruction Filter
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Speak naturally — instructions are captured after each {SILENCE_DEBOUNCE_MS / 1000}s pause.
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isRecording                   ? 'bg-red-100 text-red-700 animate-pulse'
          : isExtracting || stillSaving ? 'bg-yellow-100 text-yellow-700'
          : isSessionComplete           ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-500'
        }`}>
          {isRecording      ? '● RECORDING'
           : isExtracting   ? '⟳ EXTRACTING...'
           : stillSaving    ? '⟳ SAVING...'
           : isSessionComplete ? '✓ DONE'
           : '○ IDLE'}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Session complete banner */}
      {isSessionComplete && (
        <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">
            ✅ {savedCount} instruction{savedCount !== 1 ? 's' : ''} ready — opening workspace...
          </p>
          <ArrowRight className="w-4 h-4 text-green-600 animate-bounce" />
        </div>
      )}

      {/* Instructions area */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm min-h-[200px] max-h-[400px] overflow-y-auto p-4 space-y-3">

        {instructionsList.length === 0 && !currentBuffer && !pendingText && !isExtracting && (
          <p className="text-center text-gray-400 text-sm mt-8">
            {isRecording ? 'Speak now...' : 'Press START and speak your instructions.'}
          </p>
        )}

        {instructionsList.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className="min-w-[28px] h-7 flex items-center justify-center mt-0.5">
              {item.status === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              ) : item.status === 'saved' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
            </div>
            <p className={`flex-1 text-base leading-relaxed ${
              item.status === 'saved'  ? 'text-gray-800' :
              item.status === 'error'  ? 'text-red-600'  : 'text-gray-500'
            }`}>{item.text}</p>
            {item.status === 'saved' && item.audioUrl && (
              <button
                onClick={() => replayAudio(item.audioUrl, item.id)}
                className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
                title="Replay"
              >
                <Volume2 className={`w-4 h-4 ${item.isPlaying ? 'text-blue-500' : ''}`} />
              </button>
            )}
          </div>
        ))}

        {pendingText && !isExtracting && (
          <div className="flex items-start gap-3 opacity-50">
            <div className="min-w-[28px] h-7 flex items-center justify-center">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
            </div>
            <p className="text-base text-orange-700 italic">
              {pendingText}
              <span className="text-xs text-orange-400 ml-2">
                (processing in {SILENCE_DEBOUNCE_MS / 1000}s...)
              </span>
            </p>
          </div>
        )}

        {isExtracting && (
          <div className="flex items-center gap-3 opacity-60">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <p className="text-sm text-blue-500 italic">Extracting instructions...</p>
          </div>
        )}

        {currentBuffer && (
          <div className="flex items-start gap-3 opacity-40">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400 mt-1" />
            <p className="text-lg text-gray-400 italic">{currentBuffer}...</p>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 py-4">
        {!isRecording && !isSessionComplete && (
          <button
            onClick={startRecording}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
          >
            <Mic className="w-6 h-6" />
            {instructionsList.length > 0 ? 'RESUME' : 'START'}
          </button>
        )}
        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-full font-bold shadow-lg flex items-center gap-2"
          >
            <Square className="w-5 h-5" /> STOP
          </button>
        )}
        {!isRecording && instructionsList.length > 0 && !isSessionComplete && (
          <button
            onClick={handleDiscard}
            className="px-6 py-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-bold shadow-sm flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" /> DISCARD
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveTranscriptionRecorder;