// Frontend/src/pages/SegmentWorkspace.jsx
// UPDATED: Auto-plays all steps in sequence when currentJob.fromLive === true
//          (i.e., navigated here from the Live Transcription page)

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Search, Play, Pause, ChevronLeft, ChevronRight, Download, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';

const SegmentWorkspace = () => {
  const { currentJob } = useApp();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef(new Audio());
  const hasTriedToPlay = useRef(false);

  // ─── Auto-play ref ─────────────────────────────────────────────────────────
  // Set to true when the job comes from Live Transcription.
  // Stays true across step changes so every step auto-plays in sequence.
  // Set to false if the user manually pauses.
  const shouldAutoPlayRef = useRef(false);

  // Reset auto-play flag and step index whenever a new job is loaded
  useEffect(() => {
    setCurrentStepIndex(0);
    shouldAutoPlayRef.current = !!currentJob?.fromLive;
    console.log('[AutoPlay] fromLive:', currentJob?.fromLive, '→ shouldAutoPlay:', shouldAutoPlayRef.current);
  }, [currentJob?.id]);

  // Flatten all steps for playback
  const allSteps = currentJob?.instructions?.flatMap((inst, instIdx) =>
    inst.steps.map((step, stepIdx) => ({
      ...step,
      instructionTitle: inst.instruction,
      instIdx,
      stepIdx,
    }))
  ) || [];

  const currentStep = allSteps[currentStepIndex];

  // Load audio when step changes
  useEffect(() => {
    if (!currentStep?.audio) {
      console.log('[Audio] No audio URL for current step');
      return;
    }

    console.log('[Audio] Loading step:', currentStepIndex, currentStep.audio);

    setIsLoadingAudio(true);
    setAudioError(null);
    setIsPlaying(false);
    hasTriedToPlay.current = false;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.crossOrigin = 'anonymous';
    audioRef.current.preload = 'auto';
    audioRef.current.src = currentStep.audio;

    const handleLoadStart    = () => setIsLoadingAudio(true);
    const handleLoadedData   = () => { setIsLoadingAudio(false); setAudioError(null); };
    const handleLoadedMetadata = () => setDuration(audioRef.current.duration);
    const handleTimeUpdate   = () => setCurrentTime(audioRef.current.currentTime);
    const handleWaiting      = () => setIsLoadingAudio(true);
    const handlePlaying      = () => setIsLoadingAudio(false);

    const handleCanPlay = () => {
      console.log('[Audio] Can play');
      setIsLoadingAudio(false);

      // ✅ Auto-play if this job was sent from Live Transcription
      if (shouldAutoPlayRef.current && !hasTriedToPlay.current) {
        hasTriedToPlay.current = true;
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            console.log('[AutoPlay] Started step', currentStepIndex + 1);
          })
          .catch(err => {
            console.error('[AutoPlay] Blocked:', err);
            // Autoplay blocked — user will need to press Play manually
            shouldAutoPlayRef.current = false;
          });
      }
    };

    const handleEnded = () => {
      console.log('[Audio] Ended');
      setIsPlaying(false);

      if (!audioError && currentStepIndex < allSteps.length - 1) {
        setTimeout(() => {
          console.log('[Audio] Advancing to step', currentStepIndex + 2);
          // Keep shouldAutoPlayRef true so the next step also auto-plays
          setCurrentStepIndex(prev => prev + 1);
        }, 500);
      }
    };

    const handleError = () => {
      const errorMsg = audioRef.current.error
        ? `Error ${audioRef.current.error.code}: ${getAudioErrorMessage(audioRef.current.error.code)}`
        : 'Failed to load audio';
      setAudioError(errorMsg);
      setIsLoadingAudio(false);
      setIsPlaying(false);
    };

    audioRef.current.addEventListener('loadstart',       handleLoadStart);
    audioRef.current.addEventListener('loadeddata',      handleLoadedData);
    audioRef.current.addEventListener('loadedmetadata',  handleLoadedMetadata);
    audioRef.current.addEventListener('timeupdate',      handleTimeUpdate);
    audioRef.current.addEventListener('ended',           handleEnded);
    audioRef.current.addEventListener('error',           handleError);
    audioRef.current.addEventListener('canplay',         handleCanPlay);
    audioRef.current.addEventListener('waiting',         handleWaiting);
    audioRef.current.addEventListener('playing',         handlePlaying);

    audioRef.current.load();

    return () => {
      audioRef.current.removeEventListener('loadstart',       handleLoadStart);
      audioRef.current.removeEventListener('loadeddata',      handleLoadedData);
      audioRef.current.removeEventListener('loadedmetadata',  handleLoadedMetadata);
      audioRef.current.removeEventListener('timeupdate',      handleTimeUpdate);
      audioRef.current.removeEventListener('ended',           handleEnded);
      audioRef.current.removeEventListener('error',           handleError);
      audioRef.current.removeEventListener('canplay',         handleCanPlay);
      audioRef.current.removeEventListener('waiting',         handleWaiting);
      audioRef.current.removeEventListener('playing',         handlePlaying);
      audioRef.current.pause();
    };
  }, [currentStepIndex, currentStep?.audio, allSteps.length, audioError]);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getAudioErrorMessage = (code) => {
    switch (code) {
      case 1: return 'MEDIA_ERR_ABORTED';
      case 2: return 'MEDIA_ERR_NETWORK';
      case 3: return 'MEDIA_ERR_DECODE';
      case 4: return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
      default: return 'Unknown error';
    }
  };

  const togglePlay = async () => {
    if (audioError || isLoadingAudio) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      shouldAutoPlayRef.current = false; // user paused — stop auto-play sequence
    } else {
      hasTriedToPlay.current = true;
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        shouldAutoPlayRef.current = true; // user resumed — re-enable auto-advance
      } catch (err) {
        setAudioError(`Playback failed: ${err.message}`);
        setIsPlaying(false);
      }
    }
  };

  const playStep = async (index) => {
    audioRef.current.pause();
    setIsPlaying(false);
    shouldAutoPlayRef.current = true; // clicking a step should also auto-continue
    setCurrentStepIndex(index);
  };

  const previousStep = () => { if (currentStepIndex > 0) playStep(currentStepIndex - 1); };
  const nextStep     = () => { if (currentStepIndex < allSteps.length - 1) playStep(currentStepIndex + 1); };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownloadTranscript = () => {
    const blob = new Blob([currentJob.transcription], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentJob.name}_transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadStep = async (audioUrl, stepText) => {
    try {
      const filename = `${stepText.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}.mp3`;
      await apiService.downloadAudio(audioUrl, filename);
    } catch (error) {
      alert('Download failed: ' + error.message);
    }
  };

  const seekToPosition = (e) => {
    if (audioError || isLoadingAudio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const testAudioURL = () => {
    if (currentStep?.audio) window.open(currentStep.audio, '_blank');
  };

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (!currentJob) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-8 sm:py-12">
          <p className="text-gray-500 text-sm sm:text-base">
            No job selected. Please select a recording from Media Vault.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">

      {/* Title + auto-play badge */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate flex-1">
          {currentJob.name}
        </h1>
        {currentJob.fromLive && (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full whitespace-nowrap flex-shrink-0">
            ▶ Auto-playing
          </span>
        )}
      </div>

      {/* Pipeline Status */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
        {['Audio Ingestion', 'Whisper Transcription', 'Logical Segmenting', 'TTS Generation', 'Final Synth Chunks'].map(label => (
          <button key={label} className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
            {label}
          </button>
        ))}
      </div>

      {/* Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Left column — Player */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">

          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">

            {audioError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 mb-1">Audio Playback Error</p>
                    <p className="text-xs text-red-700 mb-2">{audioError}</p>
                    <div className="flex gap-2">
                      <button onClick={testAudioURL} className="text-xs text-red-600 underline">Test URL</button>
                      <button onClick={() => playStep(currentStepIndex)} className="text-xs text-red-600 underline">Retry</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isLoadingAudio && !audioError && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading audio...
              </div>
            )}

            {/* Progress bar */}
            <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div
                className={`flex-1 bg-gray-200 rounded-full h-2 ${!audioError && !isLoadingAudio ? 'cursor-pointer' : ''}`}
                onClick={seekToPosition}
              >
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <button onClick={previousStep} disabled={currentStepIndex === 0} className="disabled:opacity-30">
                <ChevronLeft className={`w-5 h-5 sm:w-6 sm:h-6 ${currentStepIndex === 0 ? 'text-gray-300' : 'text-gray-600 hover:text-blue-600'}`} />
              </button>

              <button onClick={togglePlay} disabled={isLoadingAudio || !!audioError} className="disabled:opacity-50">
                {isLoadingAudio ? (
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-blue-600" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 hover:text-blue-700" />
                ) : (
                  <Play className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 hover:text-blue-700" />
                )}
              </button>

              <button onClick={nextStep} disabled={currentStepIndex === allSteps.length - 1} className="disabled:opacity-30">
                <ChevronRight className={`w-5 h-5 sm:w-6 sm:h-6 ${currentStepIndex === allSteps.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:text-blue-600'}`} />
              </button>
            </div>

            {/* Time */}
            <div className="flex justify-between items-center mt-3 text-xs sm:text-sm text-gray-600">
              <span className="font-mono">{formatTime(currentTime)}</span>
              <span className="text-xs text-gray-500 truncate max-w-xs px-2">
                Step {currentStepIndex + 1}/{allSteps.length}: {currentStep?.text}
              </span>
              <span className="font-mono">{formatTime(duration)}</span>
            </div>

            {/* Debug */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">Debug Info</summary>
                <div className="mt-2 space-y-1 font-mono">
                  <p>URL: {currentStep?.audio?.substring(0, 60)}...</p>
                  <p>Loading: {isLoadingAudio ? 'Yes' : 'No'}</p>
                  <p>Error: {audioError || 'None'}</p>
                  <p>AutoPlay: {shouldAutoPlayRef.current ? 'On' : 'Off'}</p>
                </div>
              </details>
            </div>
          </div>

          {/* Download transcript */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <button
              onClick={handleDownloadTranscript}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download Full Transcript
            </button>
          </div>

          {/* Transcription */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search transcription..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <div className="p-3 rounded-lg bg-gray-50">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Full Transcription</h4>
                <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap">{currentJob.transcription}</p>
              </div>
              {currentJob.instructions?.map((inst, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-blue-50 border-l-4 border-blue-500">
                  <p className="text-xs font-semibold text-blue-900 mb-2">Instruction {idx + 1}: {inst.instruction}</p>
                  <div className="ml-2 space-y-1">
                    {inst.steps.map((step, stepIdx) => (
                      <p key={stepIdx} className="text-xs text-gray-700">• {step.text}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Step list */}
        <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">
              AI-Generated Learning Modules ({allSteps.length} steps)
            </h3>
            <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
              {allSteps.map((step, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border transition-all ${
                    index === currentStepIndex
                      ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer'
                  }`}
                  onClick={() => index !== currentStepIndex && playStep(index)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 text-xs sm:text-sm">Step {index + 1}</h4>
                    {index === currentStepIndex && isPlaying && (
                      <span className="text-xs text-blue-600 font-semibold animate-pulse">▶ Playing</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{step.instructionTitle}</p>
                  <p className="text-xs sm:text-sm text-gray-700 mb-2">{step.text}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); playStep(index); }}
                      className="flex-1 px-2 sm:px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 flex items-center justify-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Play
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadStep(step.audio, step.text); }}
                      className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SegmentWorkspace;