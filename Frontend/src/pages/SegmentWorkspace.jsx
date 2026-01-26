// Frontend/src/pages/SegmentWorkspace.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Search, Play, Pause, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
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
    if (currentStep?.audio) {
      setIsLoadingAudio(true);
      setAudioError(null);
      
      // Configure audio element
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.preload = "auto";
      audioRef.current.src = currentStep.audio;
      audioRef.current.load();

      audioRef.current.onloadstart = () => {
        console.log('[Audio] Loading started:', currentStep.audio);
      };

      audioRef.current.onloadeddata = () => {
        console.log('[Audio] Data loaded');
        setIsLoadingAudio(false);
      };

      audioRef.current.onloadedmetadata = () => {
        setDuration(audioRef.current.duration);
        console.log('[Audio] Duration:', audioRef.current.duration);
      };

      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current.currentTime);
      };

      audioRef.current.onended = () => {
        setIsPlaying(false);
        // Auto-play next step
        if (currentStepIndex < allSteps.length - 1) {
          setTimeout(() => {
            setCurrentStepIndex(prev => prev + 1);
          }, 500);
        }
      };

      audioRef.current.onerror = (e) => {
        console.error('[Audio] Error loading:', e);
        setAudioError('Failed to load audio. Please check your S3 CORS configuration.');
        setIsLoadingAudio(false);
        setIsPlaying(false);
      };

      audioRef.current.oncanplay = () => {
        console.log('[Audio] Can play');
      };
    }

    return () => {
      audioRef.current.pause();
    };
  }, [currentStep, currentStepIndex, allSteps.length]);

  const togglePlay = () => {
    if (audioError) {
      alert('Cannot play audio: ' + audioError);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            console.log('[Audio] Playing successfully');
          })
          .catch(err => {
            console.error('[Audio] Play error:', err);
            setAudioError('Playback failed: ' + err.message);
            setIsPlaying(false);
          });
      }
    }
  };

  const playStep = (index) => {
    setCurrentStepIndex(index);
    // Will auto-play after audio loads if was playing
    if (isPlaying) {
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 300);
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const nextStep = () => {
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
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
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * duration;
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

      {/* Pipeline Status - Horizontal scroll on mobile */}
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

      {/* Responsive Grid - Stack on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Left column - Order matters for mobile: player first */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">

          {/* Audio Player - Shown first on mobile */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:order-last">
            
            {/* Error Display */}
            {audioError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {audioError}
              </div>
            )}

            {/* Progress Bar */}
            <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div 
                className="flex-1 bg-gray-200 rounded-full h-2 cursor-pointer"
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
                disabled={currentStepIndex === 0 || isLoadingAudio}
              >
                <ChevronLeft className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  currentStepIndex === 0 || isLoadingAudio
                    ? 'text-gray-300' 
                    : 'text-gray-600 cursor-pointer hover:text-blue-600'
                }`} />
              </button>
              
              <button onClick={togglePlay} disabled={isLoadingAudio}>
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
                disabled={currentStepIndex === allSteps.length - 1 || isLoadingAudio}
              >
                <ChevronRight className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  currentStepIndex === allSteps.length - 1 || isLoadingAudio
                    ? 'text-gray-300' 
                    : 'text-gray-600 cursor-pointer hover:text-blue-600'
                }`} />
              </button>
            </div>

            {/* Time Display */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-3 sm:mt-4 gap-2 text-xs sm:text-sm text-gray-600">
              <span className="font-mono">{formatTime(currentTime)}</span>
              <span className="text-center text-xs text-gray-500 px-2">
                Step {currentStepIndex + 1}/{allSteps.length}: {currentStep?.text}
              </span>
              <span className="font-mono">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Download Transcript Button */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <button 
              onClick={handleDownloadTranscript}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Full Transcript
            </button>
          </div>

          {/* Transcription Search and Display */}
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
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    index === currentStepIndex
                      ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => playStep(index)}
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
                      disabled={isLoadingAudio && index === currentStepIndex}
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-500 text-white rounded text-xs sm:text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isLoadingAudio && index === currentStepIndex ? (
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="w-3 h-3 sm:w-4 sm:h-4" /> Play
                        </>
                      )}
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