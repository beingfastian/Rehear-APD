// Frontend/src/pages/LiveRecordingPage.jsx
// UPDATED: Incremental TTS generation + instruction playback during pause

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  Loader2, CheckCircle2, AlertCircle, Mic,
} from 'lucide-react';

// ── Animated Waveform Background ─────────────────────────────────────────────
const WaveformBg = ({ active }) => (
  <div className="w-full h-48 sm:h-56 overflow-hidden relative select-none">
    <svg
      viewBox="0 0 1440 180"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className="w-full h-full"
    >
      <defs>
        <style>{`
          .wave1 { animation: wave1 3.5s ease-in-out infinite; }
          .wave2 { animation: wave2 4s ease-in-out infinite; }
          .wave3 { animation: wave3 5s ease-in-out infinite; }
          .wave4 { animation: wave4 3s ease-in-out infinite; }
          @keyframes wave1 {
            0%,100% { d: path("M0,90 C180,50 360,130 540,90 C720,50 900,130 1080,90 C1260,50 1380,120 1440,90 L1440,180 L0,180 Z"); }
            50%      { d: path("M0,90 C180,130 360,50 540,90 C720,130 900,50 1080,90 C1260,130 1380,60 1440,90 L1440,180 L0,180 Z"); }
          }
          @keyframes wave2 {
            0%,100% { d: path("M0,110 C200,70 400,150 600,110 C800,70 1000,150 1200,110 C1350,70 1420,130 1440,110 L1440,180 L0,180 Z"); }
            50%      { d: path("M0,110 C200,150 400,70 600,110 C800,150 1000,70 1200,110 C1350,150 1420,70 1440,110 L1440,180 L0,180 Z"); }
          }
          @keyframes wave3 {
            0%,100% { d: path("M0,130 C240,100 480,160 720,130 C960,100 1200,160 1440,130 L1440,180 L0,180 Z"); }
            50%      { d: path("M0,130 C240,160 480,100 720,130 C960,160 1200,100 1440,130 L1440,180 L0,180 Z"); }
          }
          @keyframes wave4 {
            0%,100% { d: path("M0,150 C360,120 720,170 1080,150 C1260,130 1380,165 1440,150 L1440,180 L0,180 Z"); }
            50%      { d: path("M0,150 C360,170 720,120 1080,150 C1260,170 1380,130 1440,150 L1440,180 L0,180 Z"); }
          }
        `}</style>
      </defs>
      <path className="wave4" d="M0,150 C360,120 720,170 1080,150 C1260,130 1380,165 1440,150 L1440,180 L0,180 Z" fill={active ? "rgba(59,130,246,0.05)" : "rgba(0,0,0,0.04)"} />
      <path className="wave3" d="M0,130 C240,100 480,160 720,130 C960,100 1200,160 1440,130 L1440,180 L0,180 Z" fill={active ? "rgba(59,130,246,0.07)" : "rgba(0,0,0,0.06)"} />
      <path className="wave2" d="M0,110 C200,70 400,150 600,110 C800,70 1000,150 1200,110 C1350,70 1420,130 1440,110 L1440,180 L0,180 Z" fill={active ? "rgba(59,130,246,0.09)" : "rgba(0,0,0,0.08)"} />
      <path className="wave1" d="M0,90 C180,50 360,130 540,90 C720,50 900,130 1080,90 C1260,50 1380,120 1440,90 L1440,180 L0,180 Z" fill={active ? "rgba(59,130,246,0.13)" : "rgba(0,0,0,0.12)"} />
    </svg>
  </div>
);

// ── Mic Pulse Button ──────────────────────────────────────────────────────────
const MicPulse = ({ active, paused }) => (
  <div className="relative flex items-center justify-center w-28 h-28 mx-auto my-4">
    {active && !paused && (
      <>
        <span className="absolute inset-0 rounded-full border-2 border-sky-200 animate-ping opacity-40" />
        <span className="absolute inset-3 rounded-full border-2 border-sky-300 animate-ping opacity-30" style={{ animationDelay: '0.3s' }} />
      </>
    )}
    <div className="absolute w-28 h-28 rounded-full border-2 border-gray-200" />
    <div className="absolute w-20 h-20 rounded-full border-2 border-gray-300" />
    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
      ${paused ? 'bg-amber-500' : active ? 'bg-gray-900' : 'bg-gray-700'}`}>
      {paused ? (
        <Pause className="w-6 h-6 text-white" />
      ) : (
        <Mic className="w-6 h-6 text-white" />
      )}
    </div>
  </div>
);

// ── Instruction Player Panel (shown when paused) ──────────────────────────────
const InstructionPlayerPanel = ({ instructions, onResume, onStop, isProcessing }) => {
  // Track current instruction by ID to stay stable as 'saving' → 'saved' transitions happen
  const [currentId, setCurrentId]     = useState(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const audioRef                      = useRef(new Audio());
  const listRef                       = useRef(null);

  const saved = instructions.filter(i => i.status === 'saved' && i.audioUrl);

  // Auto-select first saved instruction when none selected
  useEffect(() => {
    if (!currentId && saved.length > 0) {
      setCurrentId(saved[0].id);
    }
  }, [saved.length, currentId]);

  const curr    = saved.find(i => i.id === currentId) || saved[0] || null;
  const currIdx = saved.indexOf(curr);

  // Load audio whenever the current instruction changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!curr?.audioUrl) {
      audio.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    audio.pause();
    audio.src = curr.audioUrl;
    audio.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const onMeta  = () => setDuration(audio.duration || 0);
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      if (currIdx < saved.length - 1) {
        setCurrentId(saved[currIdx + 1].id);
      }
    };
    const onError = () => { setIsPlaying(false); };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('error',          onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('error',          onError);
      audio.pause();
    };
  }, [curr?.audioUrl]); // eslint-disable-line

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!curr) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('[Player] play blocked:', err));
    }
  };

  const goTo = (id) => {
    audioRef.current.pause();
    setIsPlaying(false);
    setCurrentId(id);
  };

  const goPrev = () => {
    if (currIdx > 0) goTo(saved[currIdx - 1].id);
  };

  const goNext = () => {
    if (currIdx < saved.length - 1) goTo(saved[currIdx + 1].id);
  };

  const seek = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const fmt = (s) =>
    isNaN(s) || s === 0 ? '0:00'
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const savingCount = instructions.filter(i => i.status === 'saving').length;

  return (
    <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">⏸ Paused — Review Instructions</p>
          <p className="text-xs text-amber-700 mt-0.5">
            {saved.length} instruction{saved.length !== 1 ? 's' : ''} ready
            {savingCount > 0 && ` · ${savingCount} generating audio…`}
          </p>
        </div>
        {savingCount > 0 && (
          <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
        )}
      </div>

      {/* Instruction list */}
      <div ref={listRef} className="max-h-52 overflow-y-auto bg-gray-50/80 p-3 space-y-2">
        {instructions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No instructions detected yet. Resume and keep talking.
          </p>
        ) : (
          instructions.map((inst, i) => {
            const isActive    = inst.id === currentId;
            const isClickable = inst.status === 'saved' && !!inst.audioUrl;
            return (
              <div
                key={inst.id}
                onClick={() => isClickable && goTo(inst.id)}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all
                  ${isActive && isClickable ? 'bg-sky-50 border-sky-200 shadow-sm' : 'bg-white border-gray-100'}
                  ${isClickable ? 'cursor-pointer hover:border-sky-200' : 'opacity-60 cursor-default'}
                `}
              >
                {/* Status icon */}
                <div className="flex-shrink-0 mt-0.5 w-5 flex items-center">
                  {inst.status === 'saving' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  {inst.status === 'error'  && <AlertCircle className="w-4 h-4 text-red-400" />}
                  {inst.status === 'saved'  && isActive && isPlaying
                    ? <Volume2 className="w-4 h-4 text-sky-500" />
                    : inst.status === 'saved'
                    ? <CheckCircle2 className={`w-4 h-4 ${isActive ? 'text-sky-500' : 'text-green-500'}`} />
                    : null}
                </div>

                {/* Text */}
                <span className="text-sm leading-snug flex-1 min-w-0">
                  <span className="text-xs font-bold text-gray-400 mr-1">{i + 1}.</span>
                  <span className={isActive && isClickable ? 'text-sky-700 font-medium' : 'text-gray-700'}>
                    {inst.text}
                  </span>
                </span>

                {/* Playing badge */}
                {isActive && isPlaying && (
                  <span className="text-xs text-sky-500 font-semibold animate-pulse flex-shrink-0 self-center">
                    ▶
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Audio player */}
      {saved.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          {/* Track label */}
          <p className="text-xs text-gray-400 truncate">
            {curr
              ? `${currIdx + 1} / ${saved.length} — ${curr.text.slice(0, 65)}${curr.text.length > 65 ? '…' : ''}`
              : 'Select an instruction above'}
          </p>

          {/* Progress bar */}
          <div>
            <div
              className="w-full h-1.5 bg-gray-200 rounded-full cursor-pointer mb-1"
              onClick={seek}
            >
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-100"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-5">
            <button
              onClick={goPrev}
              disabled={currIdx <= 0}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors rounded-lg hover:bg-gray-100"
              title="Previous"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              disabled={!curr}
              className="w-12 h-12 bg-gray-900 hover:bg-gray-700 text-white rounded-full flex items-center justify-center
                         disabled:opacity-40 transition-colors shadow-sm"
            >
              {isPlaying
                ? <Pause className="w-5 h-5" />
                : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              onClick={goNext}
              disabled={currIdx >= saved.length - 1}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors rounded-lg hover:bg-gray-100"
              title="Next"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 pb-5 pt-1 grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            audioRef.current.pause();
            onResume();
          }}
          disabled={isProcessing}
          className="py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm
                     transition-colors shadow-sm shadow-sky-200 flex items-center justify-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />
          Resume
        </button>
        <button
          onClick={() => {
            audioRef.current.pause();
            onStop();
          }}
          disabled={isProcessing}
          className="py-3 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold text-sm
                     transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : (
            'Stop & Save'
          )}
        </button>
      </div>
    </div>
  );
};

// ── Main LiveRecordingPage ────────────────────────────────────────────────────
const LiveRecordingPage = ({ recordingName, setCurrentPage }) => {
  const { setCurrentJob, showNotification } = useApp();

  // Recording state
  const [isRecording, setIsRecording]   = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [timer, setTimer]               = useState(0);
  const [segments, setSegments]         = useState([]);   // live transcript lines
  const [interimText, setInterimText]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError]               = useState(null);

  // Instructions with incremental TTS
  // Each item: { id, text, audioUrl: null|string, status: 'saving'|'saved'|'error' }
  const [instructions, setInstructions] = useState([]);

  // Refs
  const recognitionRef    = useRef(null);
  const timerIntervalRef  = useRef(null);
  const timerValueRef     = useRef(0);          // always-current timer value for Stop handler
  const isRecordingRef    = useRef(false);
  const fullTranscriptRef = useRef('');
  const filterQueueRef    = useRef([]);
  const filteringRef      = useRef(false);
  const pendingTTSRef     = useRef(0);
  const instructionsRef   = useRef([]);         // mirror of instructions state for Stop handler

  // Keep instructionsRef in sync with state
  useEffect(() => { instructionsRef.current = instructions; }, [instructions]);

  // ── Timer helpers ────────────────────────────────────────────────────────────
  const formatTimer = (s) => {
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const startTimer = useCallback(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimer(t => {
        const next = t + 1;
        timerValueRef.current = next;
        return next;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(timerIntervalRef.current);
  }, []);

  // ── Background TTS generation ─────────────────────────────────────────────
  const generateTTSBackground = useCallback(async (itemId, text) => {
    pendingTTSRef.current++;
    try {
      const result   = await apiService.processLiveText(text);
      const audioUrl = result?.instructions?.[0]?.steps?.[0]?.audio || null;
      setInstructions(prev =>
        prev.map(i => i.id === itemId
          ? { ...i, audioUrl, status: audioUrl ? 'saved' : 'error' }
          : i
        )
      );
    } catch (_) {
      setInstructions(prev =>
        prev.map(i => i.id === itemId ? { ...i, status: 'error' } : i)
      );
    } finally {
      pendingTTSRef.current--;
    }
  }, []);

  // ── Filter queue processor ────────────────────────────────────────────────
  // Kept in a ref so the speech recognition closure always calls the latest version
  const processFilterQueueRef = useRef(null);

  const processFilterQueue = useCallback(async () => {
    if (filteringRef.current || filterQueueRef.current.length === 0) return;
    filteringRef.current = true;

    const text = filterQueueRef.current.join(' ').trim();
    filterQueueRef.current = [];

    try {
      const result   = await apiService.filterLiveChunk(text);
      const detected = result?.instructions || [];

      if (detected.length > 0) {
        // Highlight matching segments in the transcript
        const instrSet = new Set(detected.map(s => s.toLowerCase()));
        setSegments(prev =>
          prev.map(seg =>
            instrSet.has(seg.text.toLowerCase()) ? { ...seg, isInstruction: true } : seg
          )
        );

        // Add to instructions list and fire background TTS
        const newItems = detected.map(t => ({
          id:       Date.now() + Math.random(),
          text:     t,
          audioUrl: null,
          status:   'saving',
        }));
        setInstructions(prev => [...prev, ...newItems]);
        newItems.forEach(item => generateTTSBackground(item.id, item.text));
      }
    } catch (_) { /* silent */ }
    finally {
      filteringRef.current = false;
      // If more text arrived while we were filtering, process it
      if (filterQueueRef.current.length > 0) {
        processFilterQueueRef.current?.();
      }
    }
  }, [generateTTSBackground]);

  useEffect(() => { processFilterQueueRef.current = processFilterQueue; }, [processFilterQueue]);

  // ── Init Speech Recognition ──────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('Live speech not supported. Please use Chrome or Edge.');
      return;
    }

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const trimmed = t.trim();
          if (trimmed) {
            fullTranscriptRef.current += ' ' + trimmed;
            setSegments(prev => [...prev, { text: trimmed, isInstruction: false }]);
            filterQueueRef.current.push(trimmed);
            processFilterQueueRef.current?.();
          }
          setInterimText('');
        } else {
          interim += t;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError('Mic error: ' + e.error);
      }
    };

    // Auto-restart if Chrome kills the session while we're still recording
    rec.onend = () => {
      if (isRecordingRef.current) {
        try { rec.start(); } catch (_) {}
      }
    };

    recognitionRef.current = rec;
    return () => { clearInterval(timerIntervalRef.current); };
  }, []); // eslint-disable-line

  // ── Start Recording ──────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    setError(null);
    setSegments([]);
    setInterimText('');
    setInstructions([]);
    fullTranscriptRef.current = '';
    filterQueueRef.current    = [];
    filteringRef.current      = false;
    pendingTTSRef.current     = 0;
    timerValueRef.current     = 0;
    isRecordingRef.current    = true;

    setIsRecording(true);
    setIsPaused(false);
    setTimer(0);
    startTimer();

    try { recognitionRef.current?.start(); } catch (e) { console.error(e); }
  }, [startTimer]);

  // Auto-start on mount
  useEffect(() => {
    const t = setTimeout(startRecording, 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // ── Pause ────────────────────────────────────────────────────────────────
  const handlePause = useCallback(async () => {
    isRecordingRef.current = false;
    stopTimer();
    setIsRecording(false);
    setIsPaused(true);
    setInterimText('');

    try { recognitionRef.current?.stop(); } catch (_) {}

    // Flush any remaining text in the filter queue
    if (filterQueueRef.current.length > 0) {
      // Don't await — let it run in background; player shows spinner while saving
      processFilterQueueRef.current?.();
    }
  }, [stopTimer]);

  // ── Resume ───────────────────────────────────────────────────────────────
  const handleResume = useCallback(() => {
    isRecordingRef.current = true;
    setIsPaused(false);
    setIsRecording(true);
    startTimer();

    try { recognitionRef.current?.start(); } catch (_) {}
  }, [startTimer]);

  // ── Stop & Save ──────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    // Stop everything
    isRecordingRef.current = false;
    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    setInterimText('');
    try { recognitionRef.current?.stop(); } catch (_) {}

    const currentInstructions = instructionsRef.current;

    if (currentInstructions.length === 0 && !fullTranscriptRef.current.trim()) {
      showNotification('No speech detected.', 'warning');
      setCurrentPage('dashboard');
      return;
    }

    setIsProcessing(true);

    try {
      // Wait for pending TTS saves — up to 5 seconds
      let waited = 0;
      while (pendingTTSRef.current > 0 && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }

      const finalInstructions = instructionsRef.current.filter(
        i => i.status === 'saved' && i.audioUrl
      );

      if (finalInstructions.length === 0) {
        showNotification('No instructions found in recording.', 'warning');
        setCurrentPage('dashboard');
        return;
      }

      const sessionJob = {
        id:           `live_session_${Date.now()}`,
        name:         `${recordingName}.mp3`,
        type:         'Live Transcription',
        duration:     formatTimer(timerValueRef.current),
        status:       'Completed',
        transcription: fullTranscriptRef.current.trim(),
        fromLive:     true,
        instructions: finalInstructions.map(i => ({
          instruction: i.text,
          steps:       [{ text: i.text, audio: i.audioUrl }],
        })),
        createdAt: new Date().toISOString(),
      };

      await setCurrentJob(sessionJob);
      showNotification(
        `${finalInstructions.length} instruction${finalInstructions.length !== 1 ? 's' : ''} saved — opening workspace`,
        'success'
      );
      setTimeout(() => setCurrentPage('segment'), 500);

    } catch (err) {
      showNotification('Processing failed: ' + err.message, 'error');
      setCurrentPage('dashboard');
    } finally {
      setIsProcessing(false);
    }
  }, [recordingName, setCurrentJob, showNotification, setCurrentPage, stopTimer]);

  // ── Derived values for UI ────────────────────────────────────────────────
  const savedCount  = instructions.filter(i => i.status === 'saved').length;
  const savingCount = instructions.filter(i => i.status === 'saving').length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full bg-white">
      <WaveformBg active={isRecording && !isPaused} />

      <div className="flex-1 flex flex-col items-center px-4 -mt-2 pb-6 gap-4">

        {/* ── Recording card ── */}
        <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-sm px-8 pt-2 pb-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 mt-4 mb-1 truncate">{recordingName}</h2>

          <MicPulse active={isRecording || isPaused} paused={isPaused} />

          {/* Timer */}
          <div className="font-mono text-4xl font-bold text-gray-900 tracking-wider mb-2">
            {formatTimer(timer)}
          </div>

          {/* Status badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5 ${
            isPaused      ? 'bg-amber-100 text-amber-700'
            : isRecording ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-500'
          }`}>
            {isPaused ? (
              '⏸ Paused'
            ) : isRecording ? (
              <><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Recording</>
            ) : (
              '○ Idle'
            )}
          </div>

          {/* Instruction counter (visible while recording or paused) */}
          {(isRecording || isPaused) && instructions.length > 0 && (
            <div className="mb-4 text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{savedCount}</span>
              {' '}instruction{savedCount !== 1 ? 's' : ''} captured
              {savingCount > 0 && (
                <span className="ml-2 text-sky-500 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                  generating audio…
                </span>
              )}
            </div>
          )}

          {/* Controls — shown only when actively recording (not paused) */}
          {!isPaused && !isProcessing && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePause}
                className="px-7 py-3 border-2 border-gray-800 text-gray-800 rounded-full font-semibold text-sm
                           hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
              <button
                onClick={handleStop}
                className="px-7 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold text-sm
                           transition-colors shadow-md shadow-red-200"
              >
                Stop
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sky-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-semibold text-sm">Saving to workspace…</span>
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* ── Player panel (replaces transcript when paused) ── */}
        {isPaused && (
          <InstructionPlayerPanel
            instructions={instructions}
            onResume={handleResume}
            onStop={handleStop}
            isProcessing={isProcessing}
          />
        )}

        {/* ── Live transcript panel (only during active recording) ── */}
        {!isPaused && (segments.length > 0 || interimText) && (
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
              Live Transcript
            </h3>
            <div className="space-y-3 max-h-56 overflow-y-auto">
              {segments.map((seg, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed ${
                    seg.isInstruction ? 'text-sky-600 font-medium' : 'text-gray-600'
                  }`}
                >
                  {seg.isInstruction && (
                    <span className="inline-block w-2 h-2 bg-sky-400 rounded-full mr-1.5 align-middle" />
                  )}
                  {seg.text}
                </p>
              ))}
              {interimText && (
                <p className="text-sm text-gray-300 italic">{interimText}…</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};


export default LiveRecordingPage;