// Frontend/src/pages/SegmentWorkspace.jsx
// Redesigned to match Figma: transcript + steps side by side, bottom audio player

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, ChevronLeft, ChevronRight, Download, Shuffle, Repeat,
  Search, Loader2, AlertCircle, SkipBack, SkipForward,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';

// ── Waveform bars ─────────────────────────────────────────────────────────────
const WaveformBars = ({ playing }) => {
  const bars = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="flex items-center gap-[2px] h-10">
      {bars.map(i => (
        <div
          key={i}
          style={{
            height: `${20 + Math.sin(i * 0.7) * 12}px`,
            animationDelay: `${(i * 60) % 500}ms`,
            animationDuration: `${600 + (i * 37) % 400}ms`,
          }}
          className={`w-1 rounded-full bg-gray-600 ${playing ? 'animate-bar' : ''}`}
        />
      ))}
      <style>{`
        @keyframes bar {
          0%,100% { transform: scaleY(1); }
          50%      { transform: scaleY(1.8); }
        }
        .animate-bar { animation: bar ease-in-out infinite; }
      `}</style>
    </div>
  );
};

// ── Audio error helper ────────────────────────────────────────────────────────
const getAudioErrorMsg = (code) => ({
  1: 'Aborted', 2: 'Network error', 3: 'Decode error', 4: 'Source not supported',
}[code] || 'Unknown error');

// ── Main Component ────────────────────────────────────────────────────────────
const SegmentWorkspace = () => {
  const { currentJob } = useApp();

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [audioError,     setAudioError]     = useState(null);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [shuffle,        setShuffle]        = useState(false);
  const [repeat,         setRepeat]         = useState(false);

  const audioRef         = useRef(new Audio());
  const shouldAutoPlay   = useRef(false);
  const hasTriedPlay     = useRef(false);

  // Auto-play when job comes from live recording
  useEffect(() => {
    setCurrentStepIdx(0);
    shouldAutoPlay.current = !!currentJob?.fromLive;
  }, [currentJob?.id]); // eslint-disable-line

  // Flatten all steps
  const allSteps = currentJob?.instructions?.flatMap((inst, instIdx) =>
    inst.steps.map((step, stepIdx) => ({
      ...step,
      instructionTitle: inst.instruction,
      instIdx,
      stepIdx,
      globalIdx: instIdx * 100 + stepIdx,
    }))
  ) || [];

  const currentStep = allSteps[currentStepIdx];

  // Load audio on step change
  useEffect(() => {
    if (!currentStep?.audio) return;

    setIsLoading(true);
    setAudioError(null);
    setIsPlaying(false);
    hasTriedPlay.current = false;

    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = 0;
    audio.src = currentStep.audio;
    audio.load();

    const onLoadedData    = () => setIsLoading(false);
    const onTimeUpdate    = () => setCurrentTime(audio.currentTime);
    const onLoadedMeta    = () => setDuration(audio.duration);
    const onError         = () => {
      setAudioError(`Error ${audio.error?.code}: ${getAudioErrorMsg(audio.error?.code)}`);
      setIsLoading(false);
      setIsPlaying(false);
    };
    const onCanPlay = () => {
      setIsLoading(false);
      if (shouldAutoPlay.current && !hasTriedPlay.current) {
        hasTriedPlay.current = true;
        audio.play().then(() => setIsPlaying(true)).catch(() => { shouldAutoPlay.current = false; });
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      if (!audioError && currentStepIdx < allSteps.length - 1) {
        setTimeout(() => setCurrentStepIdx(p => p + 1), 400);
      } else if (repeat) {
        audio.currentTime = 0;
        audio.play().then(() => setIsPlaying(true));
      }
    };

    audio.addEventListener('loadeddata',     onLoadedData);
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('timeupdate',     onTimeUpdate);
    audio.addEventListener('canplay',        onCanPlay);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('error',          onError);

    return () => {
      audio.removeEventListener('loadeddata',     onLoadedData);
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('timeupdate',     onTimeUpdate);
      audio.removeEventListener('canplay',        onCanPlay);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('error',          onError);
      audio.pause();
    };
  }, [currentStepIdx, currentStep?.audio, allSteps.length, audioError, repeat]); // eslint-disable-line

  const togglePlay = async () => {
    if (isLoading || audioError) return;
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      shouldAutoPlay.current = false;
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
        shouldAutoPlay.current = true;
      } catch(e) {
        setAudioError('Playback failed: ' + e.message);
      }
    }
  };

  const playStep = (idx) => {
    audioRef.current.pause();
    setIsPlaying(false);
    shouldAutoPlay.current = true;
    setCurrentStepIdx(idx);
  };

  const prevStep  = () => { if (currentStepIdx > 0) playStep(currentStepIdx - 1); };
  const nextStep  = () => {
    if (shuffle) {
      const next = Math.floor(Math.random() * allSteps.length);
      playStep(next);
    } else if (currentStepIdx < allSteps.length - 1) {
      playStep(currentStepIdx + 1);
    }
  };

  const seek = (e) => {
    if (!duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  const fmt = (s) => {
    if (isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const downloadTranscript = () => {
    const blob = new Blob([currentJob.transcription], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentJob.name}_transcript.txt`;
    a.click();
  };

  const exportAllChunks = async () => {
    for (const step of allSteps) {
      if (step.audio) {
        try {
          await apiService.downloadAudio(step.audio, `${step.text.slice(0,30).replace(/[^a-z0-9]/gi,'_')}.mp3`);
        } catch(_) {}
      }
    }
  };

  const downloadStep = (step) => {
    if (step.audio) apiService.downloadAudio(step.audio, `chunk_${step.instIdx + 1}.mp3`);
  };

  // Build transcript segments: split by sentence, mark instructions
  const instructionTexts = new Set(
    currentJob?.instructions?.map(i => i.instruction?.toLowerCase().trim()) || []
  );
  const transcriptSentences = (currentJob?.transcription || '')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map((sentence, idx) => {
      const lower = sentence.toLowerCase().trim();
      const isInstruction = [...instructionTexts].some(instr => lower.includes(instr) || instr.includes(lower.slice(0, 30)));
      return { id: idx, sentence, isInstruction, timestamp: `00:${String(idx * 15 % 60).padStart(2,'0')}` };
    });

  const filteredTranscript = transcriptSentences.filter(s =>
    !searchQuery || s.sentence.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentJob) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 text-sm">No job selected. Choose a recording from Media Center.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 truncate">{currentJob.name}</h1>
          {currentJob.fromLive && (
            <span className="px-2.5 py-1 bg-green-50 text-green-600 text-xs font-semibold rounded-full">
              ▶ Auto-playing
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTranscript}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Full Transcript
          </button>
          <button
            onClick={exportAllChunks}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-200"
          >
            Export All Chunks
          </button>
        </div>
      </div>

      {/* ── Body: two-column ── */}
      <div className="flex-1 overflow-hidden flex gap-0 min-h-0">

        {/* Left: Transcript */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
          {/* Search */}
          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search chunks or word..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Transcript lines */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
            {filteredTranscript.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No transcript available.</p>
            ) : (
              filteredTranscript.map((seg) => (
                <div key={seg.id} className="flex items-start gap-4">
                  <span className="text-xs font-mono text-gray-400 pt-0.5 flex-shrink-0 w-12">{seg.timestamp}</span>
                  <div className="flex items-start gap-3 flex-1">
                    {seg.isInstruction && (
                      <button
                        onClick={() => {
                          const matchIdx = allSteps.findIndex(s =>
                            s.text?.toLowerCase().includes(seg.sentence.toLowerCase().slice(0, 20))
                          );
                          if (matchIdx >= 0) playStep(matchIdx);
                        }}
                        className="flex-shrink-0 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 hover:bg-blue-600 transition-colors shadow-sm shadow-blue-200"
                      >
                        <Play className="w-3 h-3 text-white" />
                      </button>
                    )}
                    <p className={`text-sm leading-relaxed ${
                      seg.isInstruction ? 'text-blue-600 font-medium' : 'text-gray-600'
                    }`}>
                      {seg.sentence}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: AI-Generated Learning Modules */}
        <div className="w-80 xl:w-96 flex-shrink-0 bg-white overflow-y-auto">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">AI-Generated Learning Modules</h3>
          </div>

          {audioError && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{audioError}</span>
            </div>
          )}

          <div className="p-4 space-y-3">
            {currentJob.instructions?.map((inst, instIdx) => (
              <div key={instIdx} className="rounded-xl border border-gray-100 overflow-hidden">
                {/* Instruction title */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{inst.instruction}</p>
                </div>

                {/* Steps */}
                {inst.steps.map((step, stepIdx) => {
                  const globalIdx = allSteps.findIndex(s => s.instIdx === instIdx && s.stepIdx === stepIdx);
                  const isActive  = globalIdx === currentStepIdx;

                  return (
                    <div
                      key={stepIdx}
                      className={`p-4 transition-colors ${
                        isActive ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <p className={`text-sm font-medium mb-3 leading-snug ${
                        isActive ? 'text-blue-700' : 'text-gray-800'
                      }`}>
                        <span className="font-bold">Step {globalIdx + 1}:</span> {step.text}
                        {isActive && isPlaying && (
                          <span className="ml-2 text-xs text-blue-500 font-semibold animate-pulse">▶ Playing</span>
                        )}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => globalIdx >= 0 ? playStep(globalIdx) : null}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          {isLoading && isActive ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isPlaying && isActive ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          {isPlaying && isActive ? 'Playing' : 'Play Segment'}
                        </button>
                        <button
                          onClick={() => downloadStep(step)}
                          className="flex items-center gap-1 py-2 px-2.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 text-xs transition-colors"
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                          <span className="hidden xl:inline">{step.audio ? 'audio_chunk.mp3' : 'N/A'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {allSteps.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No steps available.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Audio Player ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-6">

        {/* Waveform */}
        <div className="flex-shrink-0">
          <WaveformBars playing={isPlaying} />
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs font-mono text-gray-400 flex-shrink-0">{fmt(currentTime)}</span>
          <div
            className="flex-1 h-1.5 bg-gray-200 rounded-full cursor-pointer relative"
            onClick={seek}
          >
            <div
              className="h-full bg-gray-800 rounded-full transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-mono text-gray-400 flex-shrink-0">{fmt(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShuffle(s => !s)}
            className={`p-1.5 rounded-lg transition-colors ${shuffle ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700'}`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={prevStep}
            disabled={currentStepIdx === 0}
            className="p-1.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading || !!audioError}
            className="w-10 h-10 bg-gray-900 hover:bg-gray-700 text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-colors shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          <button
            onClick={nextStep}
            disabled={!shuffle && currentStepIdx === allSteps.length - 1}
            className="p-1.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={() => setRepeat(r => !r)}
            className={`p-1.5 rounded-lg transition-colors ${repeat ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700'}`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegmentWorkspace;