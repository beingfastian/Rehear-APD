// Frontend/src/pages/LiveRecordingPage.jsx
// Full-screen recording experience: animated waveform bg, mic button, timer, live transcript

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';

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

      <path
        className="wave4"
        d="M0,150 C360,120 720,170 1080,150 C1260,130 1380,165 1440,150 L1440,180 L0,180 Z"
        fill="rgba(0,0,0,0.04)"
      />
      <path
        className="wave3"
        d="M0,130 C240,100 480,160 720,130 C960,100 1200,160 1440,130 L1440,180 L0,180 Z"
        fill="rgba(0,0,0,0.06)"
      />
      <path
        className="wave2"
        d="M0,110 C200,70 400,150 600,110 C800,70 1000,150 1200,110 C1350,70 1420,130 1440,110 L1440,180 L0,180 Z"
        fill="rgba(0,0,0,0.08)"
      />
      <path
        className="wave1"
        d="M0,90 C180,50 360,130 540,90 C720,50 900,130 1080,90 C1260,50 1380,120 1440,90 L1440,180 L0,180 Z"
        fill="rgba(0,0,0,0.12)"
      />
    </svg>
  </div>
);

// ── Mic Pulse Button ───────────────────────────────────────────────────────────
const MicPulse = ({ active }) => (
  <div className="relative flex items-center justify-center w-28 h-28 mx-auto my-6">
    {active && (
      <>
        <span className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping opacity-40" />
        <span className="absolute inset-3 rounded-full border-2 border-blue-300 animate-ping opacity-30" style={{ animationDelay: '0.3s' }} />
      </>
    )}
    {/* outer ring */}
    <div className="absolute w-28 h-28 rounded-full border-2 border-gray-200" />
    {/* inner ring */}
    <div className="absolute w-20 h-20 rounded-full border-2 border-gray-300" />
    {/* mic circle */}
    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
      ${active ? 'bg-gray-900 shadow-gray-400' : 'bg-gray-800'}`}>
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>
    </div>
  </div>
);

// ── Main LiveRecordingPage ────────────────────────────────────────────────────
const LiveRecordingPage = ({ recordingName, setCurrentPage }) => {
  const { setCurrentJob, showNotification } = useApp();

  const [isRecording, setIsRecording]   = useState(false);
  const [isPaused,    setIsPaused]      = useState(false);
  const [timer,       setTimer]         = useState(0); // seconds
  const [segments,    setSegments]      = useState([]); // { text, isInstruction }
  const [interimText, setInterimText]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error,        setError]        = useState(null);

  const recognitionRef    = useRef(null);
  const timerRef          = useRef(null);
  const isRecordingRef    = useRef(false);
  const fullTranscriptRef = useRef('');
  const filterQueueRef    = useRef([]);
  const filteringRef      = useRef(false);

  // ── Format timer ──────────────────────────────────────────────────────────
  const formatTimer = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  // ── Background instruction filter ─────────────────────────────────────────
  const processFilterQueue = useCallback(async () => {
    if (filteringRef.current || filterQueueRef.current.length === 0) return;
    filteringRef.current = true;
    const text = filterQueueRef.current.join(' ');
    filterQueueRef.current = [];
    try {
      const result = await apiService.filterLiveChunk(text);
      const instructions = result?.instructions || [];
      const instrSet = new Set(instructions.map(s => s.toLowerCase()));

      // update segment highlight
      setSegments(prev => prev.map(seg =>
        instrSet.has(seg.text.toLowerCase()) ? { ...seg, isInstruction: true } : seg
      ));
    } catch(_) {/* silent */}
    finally {
      filteringRef.current = false;
      if (filterQueueRef.current.length > 0) processFilterQueue();
    }
  }, []);

  // ── Init Speech Recognition ───────────────────────────────────────────────
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
            processFilterQueue();
          }
          setInterimText('');
        } else {
          interim += t;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Mic error: ' + e.error);
    };

    rec.onend = () => {
      if (isRecordingRef.current && !isPaused) {
        try { rec.start(); } catch(_) {}
      }
    };

    recognitionRef.current = rec;
    return () => {
      clearInterval(timerRef.current);
    };
  }, [isPaused, processFilterQueue]);

  // ── Start Recording ───────────────────────────────────────────────────────
  const startRecording = () => {
    setError(null);
    setSegments([]);
    setInterimText('');
    fullTranscriptRef.current = '';
    filterQueueRef.current = [];
    isRecordingRef.current = true;
    setIsRecording(true);
    setIsPaused(false);
    setTimer(0);

    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);

    try {
      recognitionRef.current?.start();
    } catch(e) {
      console.error('Start error:', e);
    }
  };

  // Auto-start on mount
  useEffect(() => {
    const timeout = setTimeout(startRecording, 300);
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      isRecordingRef.current = true;
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      try { recognitionRef.current?.start(); } catch(_) {}
    } else {
      setIsPaused(true);
      isRecordingRef.current = false;
      clearInterval(timerRef.current);
      try { recognitionRef.current?.stop(); } catch(_) {}
    }
  };

  // ── Stop & Process ────────────────────────────────────────────────────────
  const stopRecording = async () => {
    isRecordingRef.current = false;
    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setInterimText('');

    try { recognitionRef.current?.stop(); } catch(_) {}

    const transcript = fullTranscriptRef.current.trim();
    if (!transcript) {
      showNotification('No speech detected.', 'warning');
      setCurrentPage('dashboard');
      return;
    }

    setIsProcessing(true);
    try {
      // Extract all instructions from full transcript
      const filterResult = await apiService.filterLiveChunk(transcript);
      const instructions = filterResult?.instructions || [];

      if (instructions.length === 0) {
        showNotification('No instructions found in recording.', 'warning');
        setCurrentPage('dashboard');
        return;
      }

      // Save each instruction + get TTS audio in parallel
      const savePromises = instructions.map(text => apiService.processLiveText(text));
      const results = await Promise.all(savePromises);

      // Build session job
      const sessionJob = {
        id: `live_session_${Date.now()}`,
        name: `${recordingName}.mp3`,
        type: 'Live Transcription',
        duration: formatTimer(timer),
        status: 'Completed',
        transcription: transcript,
        fromLive: true,
        instructions: results.map(r => ({
          instruction: r.instructions[0]?.instruction || '',
          steps: r.instructions[0]?.steps || [],
        })),
        createdAt: new Date().toISOString(),
      };

      await setCurrentJob(sessionJob);
      showNotification(`${instructions.length} instruction${instructions.length !== 1 ? 's' : ''} saved — opening workspace`, 'success');
      setTimeout(() => setCurrentPage('segment'), 500);

    } catch(err) {
      showNotification('Processing failed: ' + err.message, 'error');
      setCurrentPage('dashboard');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full bg-white">

      {/* Waveform background */}
      <WaveformBg active={isRecording && !isPaused} />

      {/* Recording card */}
      <div className="flex-1 flex flex-col items-center px-4 -mt-2 pb-6">

        <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-sm pt-2 pb-6 px-8 text-center">

          {/* Recording name */}
          <h2 className="text-xl font-bold text-gray-900 mb-2 mt-4">{recordingName}</h2>

          {/* Mic animation */}
          <MicPulse active={isRecording && !isPaused} />

          {/* Timer */}
          <div className="font-mono text-4xl font-bold text-gray-900 mb-6 tracking-wider">
            {formatTimer(timer)}
          </div>

          {/* Buttons */}
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="font-semibold text-sm">Processing recording…</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={togglePause}
                className="px-8 py-3 border-2 border-gray-800 text-gray-800 rounded-full font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopRecording}
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold text-sm transition-colors shadow-md shadow-red-200"
              >
                Stop
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Live transcript panel */}
        {(segments.length > 0 || interimText) && (
          <div className="w-full max-w-lg mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Live Transcript</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {segments.map((seg, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed ${
                    seg.isInstruction
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-600'
                  }`}
                >
                  {seg.isInstruction && (
                    <span className="inline-block w-4 h-4 bg-blue-100 rounded-full mr-1.5 align-middle" />
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