// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// FIXED:
//  Bug 1 — SILENCE_DEBOUNCE_MS raised from 2500 → 4000ms
//  Bug 2 — isFlushingRef lock prevents concurrent flushes
//  Bug 3 — recognition.onend auto-restarts mic if still recording
//  Bug 4 — enqueueAudio removed from saveInstruction (no auto-play during recording)
//  Bug 5 — flushPendingBufferRef keeps recognition.onresult closure fresh
//  Bug 6 — checkSessionComplete guards against firing before any saves have started

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Loader2, AlertCircle, Sparkles, CheckCircle2, Volume2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import apiService from '../../services/api';

// FIX 1 — raised from 2500 to 4000 so natural mid-thought pauses don't cut early
const SILENCE_DEBOUNCE_MS = 4000;

const LiveTranscriptionRecorder = ({ onComplete, onSessionComplete }) => {
  const { showNotification } = useApp();

  const [isRecording, setIsRecording] = useState(false);
  const [instructionsList, setInstructionsList] = useState([]);
  const [currentBuffer, setCurrentBuffer] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef       = useRef(null);
  const transcriptEndRef     = useRef(null);
  const silenceTimerRef      = useRef(null);
  const pendingTextRef       = useRef('');

  // FIX 2 — lock so only one flush runs at a time
  const isFlushingRef        = useRef(false);
  // FIX 3 — track whether the mic should be live so onend can restart
  const isRecordingRef       = useRef(false);
  // FIX 5 — always-current ref to flushPendingBuffer for the recognition closure
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
  // FIX 6 — track whether at least one save has been kicked off
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
          // FIX 5 — call via ref so closure always has the latest function
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

    // FIX 3 — if still recording when Chrome kills the session, restart immediately
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
    return () => clearTimeout(silenceTimerRef.current);
  }, []);

  // ─── 2. SESSION COMPLETE CHECK ─────────────────────────────────────────────
  const checkSessionComplete = useCallback(() => {
    if (
      stopRequestedRef.current &&
      pendingSavesRef.current === 0 &&
      !isExtracting &&
      // FIX 6 — only complete if saves were actually started (not just isRecording=false)
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

  // ─── 3. AUDIO QUEUE (kept for the per-item replay button only) ─────────────
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
        isPlayingRef.current   = false;
        currentAudioRef.current = null;
        setInstructionsList(prev =>
          prev.map(item => item.id === itemId ? { ...item, isPlaying: false } : item)
        );
        processAudioQueue();
      });

    audio.onended = () => {
      isPlayingRef.current   = false;
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
    isPlayingRef.current      = false;
    audioQueueRef.current     = [];
    enqueueAudio(url, itemId);
  }, [enqueueAudio]);

  // ─── 4. FLUSH BUFFER → GPT EXTRACTION ─────────────────────────────────────
  const flushPendingBuffer = useCallback(async () => {
    // FIX 2 — bail if a flush is already running; the queued text stays in
    // pendingTextRef and will be picked up by the next silence timer or by stopRecording
    if (isFlushingRef.current) {
      console.log('[Flush] Already flushing — skipping concurrent call');
      return;
    }

    const text = pendingTextRef.current.trim();
    if (!text || text.length < 5) return;

    isFlushingRef.current  = true;
    pendingTextRef.current = '';
    setPendingText('');
    setIsExtracting(true);

    try {
      const result       = await apiService.filterLiveChunk(text);
      const instructions = result?.instructions || [];

      if (instructions.length === 0) return;

      const newItems = instructions.map(instructionText => ({
        id: Date.now() + Math.random(),
        text: instructionText,
        status: 'saving',
        isPlaying: false,
        audioUrl: null,
      }));

      setInstructionsList(prev => [...prev, ...newItems]);

      // FIX 6 — mark that at least one save cycle has started
      saveEverStartedRef.current = true;

      // Run saves in parallel — order in the UI is preserved by item ids
      await Promise.all(newItems.map(item => saveInstruction(item.id, item.text)));

    } catch (err) {
      console.error('[Flush] Failed:', err);
    } finally {
      setIsExtracting(false);
      isFlushingRef.current = false;
    }
  }, []); // eslint-disable-line

  // FIX 5 — keep the ref current so the recognition closure always calls latest
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

      // FIX 4 — DO NOT call enqueueAudio here.
      // Audio must NOT play out loud while the teacher is still recording.
      // Playback is only triggered by the Play button in SegmentWorkspace.

      if (onComplete) onComplete(saveResult);

    } catch (err) {
      console.error('[S3] Save failed:', err);
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
    pendingTextRef.current       = '';
    audioQueueRef.current        = [];
    isPlayingRef.current         = false;
    isFlushingRef.current        = false;   // FIX 2 — reset lock on new session
    saveEverStartedRef.current   = false;   // FIX 6 — reset guard
    sessionInstructionsRef.current = [];
    pendingSavesRef.current      = 0;
    stopRequestedRef.current     = false;
    clearTimeout(silenceTimerRef.current);

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        isRecordingRef.current = true;  // FIX 3 — set before start so onend knows
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Mic start error', err);
        isRecordingRef.current = false;
      }
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;     // FIX 3 — prevent onend from restarting
    if (recognitionRef.current) recognitionRef.current.stop();
    clearTimeout(silenceTimerRef.current);
    setIsRecording(false);
    setCurrentBuffer('');

    stopRequestedRef.current = true;

    // Flush any speech that was buffered when Stop was pressed, then check complete
    if (pendingTextRef.current.trim()) {
      flushPendingBuffer().then(() => checkSessionComplete());
    } else {
      checkSessionComplete();
    }
  };

  const handleDiscard = () => {
    isRecordingRef.current = false;     // FIX 3 — prevent restart on discard
    if (recognitionRef.current) recognitionRef.current.stop();
    clearTimeout(silenceTimerRef.current);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    pendingTextRef.current         = '';
    audioQueueRef.current          = [];
    isPlayingRef.current           = false;
    isFlushingRef.current          = false;
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
          isRecording              ? 'bg-red-100 text-red-700 animate-pulse'
          : isExtracting || stillSaving ? 'bg-yellow-100 text-yellow-700'
          : isSessionComplete      ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-500'
        }`}>
          {isRecording    ? '● RECORDING'
           : isExtracting  ? '⟳ EXTRACTING...'
           : stillSaving   ? '⟳ SAVING...'
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