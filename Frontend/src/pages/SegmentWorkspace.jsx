// Frontend/src/pages/SegmentWorkspace.jsx - AUDIO PLAYBACK FIXED

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

  // Flatten all steps for playback
  const allSteps = currentJob?.instructions?.flatMap((inst, instIdx) =>
    inst.steps.map((step, stepIdx) => ({
      ...step,
      instructionTitle: inst.instruction,
      instIdx,
      stepIdx
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
    
    // Reset states
    setIsLoadingAudio(true);
    setAudioError(null);
    setIsPlaying(false);
    hasTriedToPlay.current = false;
    
    // Stop current audio
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    
    // Configure audio element
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.preload = "auto";
    audioRef.current.src = currentStep.audio;

    // Event handlers
    const handleLoadStart = () => {
      console.log('[Audio] Loading started');
      setIsLoadingAudio(true);
    };

    const handleLoadedData = () => {
      console.log('[Audio] Data loaded successfully');
      setIsLoadingAudio(false);
      setAudioError(null);
    };

    const handleLoadedMetadata = () => {
      const audioDuration = audioRef.current.duration;
      console.log('[Audio] Duration:', audioDuration);
      setDuration(audioDuration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audioRef.current.currentTime);
    };

    const handleEnded = () => {
      console.log('[Audio] Playback ended');
      setIsPlaying(false);
      
      // Only auto-advance if we successfully played
      if (!audioError && currentStepIndex < allSteps.length - 1) {
        setTimeout(() => {
          console.log('[Audio] Auto-advancing to next step');
          setCurrentStepIndex(prev => prev + 1);
        }, 500);
      }
    };

    const handleError = (e) => {
      console.error('[Audio] Error:', e);
      const errorMsg = audioRef.current.error 
        ? `Error ${audioRef.current.error.code}: ${getAudioErrorMessage(audioRef.current.error.code)}`
        : 'Failed to load audio';
      
      setAudioError(errorMsg);
      setIsLoadingAudio(false);
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      console.log('[Audio] Can play - ready to start');
      setIsLoadingAudio(false);
    };

    const handleWaiting = () => {
      console.log('[Audio] Waiting for data...');
      setIsLoadingAudio(true);
    };

    const handlePlaying = () => {
      console.log('[Audio] Playing');
      setIsLoadingAudio(false);
    };

    // Attach event listeners
    audioRef.current.addEventListener('loadstart', handleLoadStart);
    audioRef.current.addEventListener('loadeddata', handleLoadedData);
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);
    audioRef.current.addEventListener('canplay', handleCanPlay);
    audioRef.current.addEventListener('waiting', handleWaiting);
    audioRef.current.addEventListener('playing', handlePlaying);

    // Load the audio
    audioRef.current.load();

    // Cleanup
    return () => {
      audioRef.current.removeEventListener('loadstart', handleLoadStart);
      audioRef.current.removeEventListener('loadeddata', handleLoadedData);
      audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.removeEventListener('ended', handleEnded);
      audioRef.current.removeEventListener('error', handleError);
      audioRef.current.removeEventListener('canplay', handleCanPlay);
      audioRef.current.removeEventListener('waiting', handleWaiting);
      audioRef.current.removeEventListener('playing', handlePlaying);
      audioRef.current.pause();
    };
  }, [currentStepIndex, currentStep?.audio, allSteps.length, audioError]);

  const getAudioErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 1: return 'MEDIA_ERR_ABORTED - Download aborted';
      case 2: return 'MEDIA_ERR_NETWORK - Network error';
      case 3: return 'MEDIA_ERR_DECODE - Decode error';
      case 4: return 'MEDIA_ERR_SRC_NOT_SUPPORTED - Format not supported or CORS issue';
      default: return 'Unknown error';
    }
  };

  const togglePlay = async () => {
    if (audioError) {
      console.log('[Audio] Cannot play due to error:', audioError);
      return;
    }

    if (isLoadingAudio) {
      console.log('[Audio] Still loading, please wait');
      return;
    }

    if (isPlaying) {
      console.log('[Audio] Pausing');
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      console.log('[Audio] Attempting to play');
      hasTriedToPlay.current = true;
      
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        console.log('[Audio] Playing successfully');
      } catch (err) {
        console.error('[Audio] Play failed:', err);
        setAudioError(`Playback failed: ${err.message}`);
        setIsPlaying(false);
      }
    }
  };

  const playStep = async (index) => {
    console.log('[Audio] Switching to step:', index);
    
    // Stop current playback
    audioRef.current.pause();
    setIsPlaying(false);
    
    // Change step
    setCurrentStepIndex(index);
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      playStep(currentStepIndex - 1);
    }
  };

  const nextStep = () => {
    if (currentStepIndex < allSteps.length - 1) {
      playStep(currentStepIndex + 1);
    }
  };

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
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * duration;
  };

  const testAudioURL = () => {
    if (currentStep?.audio) {
      console.log('[Debug] Testing audio URL:', currentStep.audio);
      window.open(currentStep.audio, '_blank');
    }
  };

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
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 truncate">
        {currentJob.name}
      </h1>

      {/* Pipeline Status */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
        <button className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <Mic className="w-3 h-3 sm:w-4 sm:h-4" /> Audio Ingestion
        </button>
        <button className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
          Whisper Transcription
        </button>
        <button className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
          Logical Segmenting
        </button>
        <button className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0">
          Final Synth Chunks
        </button>
      </div>

      {/* Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">

          {/* Audio Player */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            
            {/* Error Display */}
            {audioError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 mb-1">Audio Playback Error</p>
                    <p className="text-xs text-red-700 mb-2">{audioError}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={testAudioURL}
                        className="text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Test URL in new tab
                      </button>
                      <button
                        onClick={() => playStep(currentStepIndex)}
                        className="text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoadingAudio && !audioError && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading audio...
              </div>
            )}

            {/* Progress Bar */}
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

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <button 
                onClick={previousStep} 
                disabled={currentStepIndex === 0}
                className="disabled:opacity-30"
              >
                <ChevronLeft className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  currentStepIndex === 0
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-600 cursor-pointer hover:text-blue-600'
                }`} />
              </button>
              
              <button 
                onClick={togglePlay} 
                disabled={isLoadingAudio || audioError}
                className="disabled:opacity-50"
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-blue-600" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 sm:w-8 sm:h-8 cursor-pointer text-blue-600 hover:text-blue-700" />
                ) : (
                  <Play className="w-6 h-6 sm:w-8 sm:h-8 cursor-pointer text-blue-600 hover:text-blue-700" />
                )}
              </button>
              
              <button 
                onClick={nextStep} 
                disabled={currentStepIndex === allSteps.length - 1}
                className="disabled:opacity-30"
              >
                <ChevronRight className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  currentStepIndex === allSteps.length - 1
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-600 cursor-pointer hover:text-blue-600'
                }`} />
              </button>
            </div>

            {/* Time Display */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-3 sm:mt-4 gap-2 text-xs sm:text-sm text-gray-600">
              <span className="font-mono">{formatTime(currentTime)}</span>
              <span className="text-center text-xs text-gray-500 px-2 truncate max-w-xs">
                Step {currentStepIndex + 1}/{allSteps.length}: {currentStep?.text}
              </span>
              <span className="font-mono">{formatTime(duration)}</span>
            </div>

            {/* Debug Info */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">Debug Info</summary>
                <div className="mt-2 space-y-1 font-mono">
                  <p>URL: {currentStep?.audio?.substring(0, 60)}...</p>
                  <p>Loading: {isLoadingAudio ? 'Yes' : 'No'}</p>
                  <p>Error: {audioError || 'None'}</p>
                  <p>Ready State: {audioRef.current?.readyState}</p>
                  <p>Network State: {audioRef.current?.networkState}</p>
                </div>
              </details>
            </div>
          </div>

          {/* Download Transcript */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <button 
              onClick={handleDownloadTranscript}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Full Transcript
            </button>
          </div>

          {/* Transcription */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <div className="relative mb-4">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search transcription..."
                className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="space-y-3 sm:space-y-4 max-h-64 sm:max-h-96 overflow-y-auto">
              <div className="p-3 sm:p-4 rounded-lg bg-gray-50">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Full Transcription</h4>
                <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap">
                  {currentJob.transcription}
                </p>
              </div>

              {currentJob.instructions?.map((inst, idx) => (
                <div key={idx} className="p-3 sm:p-4 rounded-lg bg-blue-50 border-l-4 border-blue-500">
                  <p className="text-xs sm:text-sm font-semibold text-blue-900 mb-2">
                    Instruction {idx + 1}: {inst.instruction}
                  </p>
                  <div className="ml-2 sm:ml-4 space-y-1">
                    {inst.steps.map((step, stepIdx) => (
                      <p key={stepIdx} className="text-xs sm:text-sm text-gray-700">
                        • {step.text}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column - Learning Modules */}
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
                  <h4 className="font-medium text-gray-900 mb-1 text-xs sm:text-sm">
                    Step {index + 1}
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    {step.instructionTitle}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">
                    {step.text}
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        playStep(index);
                      }}
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-500 text-white rounded text-xs sm:text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Play className="w-3 h-3 sm:w-4 sm:h-4" /> Play
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadStep(step.audio, step.text);
                      }}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded text-xs sm:text-sm hover:bg-gray-50"
                    >
                      <Download className="w-3 h-3 sm:w-4 sm:h-4" />
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