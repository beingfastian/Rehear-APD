// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// OPTIMIZED: Fix #3 — Optimistic UI shows instruction instantly before API confirms

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Loader2, AlertCircle, Sparkles, CheckCircle2, Volume2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import apiService from '../../services/api';

const LiveTranscriptionRecorder = ({ onComplete }) => {
  const { showNotification } = useApp();

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [instructionsList, setInstructionsList] = useState([]);
  // Each item: { id, text, status: 'filtering' | 'saving' | 'saved' | 'error' | 'ignored', isPlaying: bool }
  const [currentBuffer, setCurrentBuffer] = useState('');
  const [error, setError] = useState(null);

  // Refs
  const recognitionRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const currentAudioRef = useRef(null);

  // --- 1. Initialize Speech Recognition ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            processFinalChunk(transcript);
          } else {
            interimTranscript += transcript;
          }
        }
        setCurrentBuffer(interimTranscript);
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.error('Speech API Error:', event.error);
          if (event.error === 'not-allowed') {
            setError('Microphone permission denied.');
          } else {
            setError(`Speech error: ${event.error}`);
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError('Your browser does not support Live Speech. Please use Chrome or Edge.');
    }
  }, []);

  // --- 2. FIX #3: Optimistic UI + Filter + Save + Play ---
  const processFinalChunk = async (rawText) => {
    if (!rawText || !rawText.trim()) return;

    // FIX #3: Show text on screen INSTANTLY — don't wait for the API
    // This removes the visible delay between speaking and seeing the text
    const newId = Date.now();
    setInstructionsList(prev => [
      ...prev,
      { id: newId, text: rawText.trim(), status: 'filtering', isPlaying: false }
    ]);
    setCurrentBuffer('');

    try {
      console.log('[Filter] Analyzing chunk:', rawText);

      // Step 1: Check if instruction (GPT call #1 — the only GPT call now)
      const result = await apiService.filterLiveChunk(rawText);

      if (!result || !result.filtered_text) {
        // Not an instruction — remove it from the list silently
        console.log('[Filter] Ignored filler:', rawText);
        setInstructionsList(prev => prev.filter(item => item.id !== newId));
        return;
      }

      const instruction = result.filtered_text;
      console.log('[Filter] Confirmed instruction:', instruction);

      // Update text to cleaned version and mark as saving
      setInstructionsList(prev =>
        prev.map(item =>
          item.id === newId ? { ...item, text: instruction, status: 'saving' } : item
        )
      );

      // Step 2: Save to S3 (no second GPT call — backend skips detect_instructions now)
      try {
        const saveResult = await apiService.processLiveText(instruction);
        console.log('[S3] Saved! Job ID:', saveResult.job_id);

        // Mark as saved
        setInstructionsList(prev =>
          prev.map(item =>
            item.id === newId ? { ...item, status: 'saved' } : item
          )
        );

        // Step 3: Auto-play TTS audio immediately
        const audioUrl = saveResult.instructions?.[0]?.steps?.[0]?.audio;
        if (audioUrl) {
          playAudio(audioUrl, newId);
        }

        if (onComplete) onComplete(saveResult);

      } catch (saveErr) {
        console.error('[S3] Save failed:', saveErr);
        setInstructionsList(prev =>
          prev.map(item =>
            item.id === newId ? { ...item, status: 'error' } : item
          )
        );
      }

    } catch (err) {
      console.error('[Filter] Failed:', err);
      // Remove the optimistic entry on total failure
      setInstructionsList(prev => prev.filter(item => item.id !== newId));
    }
  };

  // --- 3. Play Audio ---
  const playAudio = (audioUrl, instructionId) => {
    // Stop any currently playing audio first
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;

    setInstructionsList(prev =>
      prev.map(item =>
        item.id === instructionId ? { ...item, isPlaying: true } : item
      )
    );

    audio.play().catch(err => {
      console.error('[Audio] Playback failed:', err);
    });

    audio.onended = () => {
      setInstructionsList(prev =>
        prev.map(item =>
          item.id === instructionId ? { ...item, isPlaying: false } : item
        )
      );
      currentAudioRef.current = null;
    };
  };

  // --- 4. Recording Controls ---
  const startRecording = () => {
    setError(null);
    setInstructionsList([]);
    setCurrentBuffer('');

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Mic start error', err);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setCurrentBuffer('');
    // Nothing to save — every instruction was already saved as it was spoken
  };

  const handleDiscard = () => {
    stopRecording();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setInstructionsList([]);
    setCurrentBuffer('');
    setError(null);
  };

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [instructionsList, currentBuffer]);

  const savingCount = instructionsList.filter(i => i.status === 'saving' || i.status === 'filtering').length;
  const savedCount = instructionsList.filter(i => i.status === 'saved').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
            <Sparkles className={`w-5 h-5 ${isRecording ? 'text-blue-500' : 'text-gray-400'}`} />
            Smart Instruction Filter
          </h2>
          <p className="text-xs text-gray-500">
            Instructions appear instantly, saved to S3, and played automatically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedCount > 0 && (
            <div className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold">
              <CheckCircle2 className="w-3 h-3" />
              {savedCount} saved
            </div>
          )}
          {savingCount > 0 && (
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing...
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold animate-pulse">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
              LISTENING
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-center gap-3">
          <AlertCircle className="text-red-600 w-5 h-5" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Transcription Box */}
      <div className="bg-white border border-gray-200 rounded-lg h-96 flex flex-col p-6 overflow-y-auto shadow-inner relative">

        {/* Empty state */}
        {instructionsList.length === 0 && !currentBuffer && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 select-none">
            <Mic className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl font-medium">Ready to start.</p>
            <p className="text-sm mt-2">
              "Hi! <span className="text-blue-400 font-bold">Go to class.</span> How are you?"
            </p>
            <p className="text-xs mt-1 text-gray-400">
              "Go to class" → appears instantly → saved → plays 🔊
            </p>
          </div>
        )}

        <div className="space-y-3">

          {instructionsList.map((inst, idx) => (
            <div
              key={inst.id}
              className={`flex items-start gap-3 rounded-lg p-2 transition-all duration-300 ${
                inst.isPlaying ? 'bg-blue-50' : ''
              } ${inst.status === 'filtering' ? 'opacity-60' : 'opacity-100'}`}
            >
              {/* Index badge */}
              <div className="min-w-[28px] h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 shadow-sm flex-shrink-0">
                {idx + 1}
              </div>

              {/* Instruction text */}
              <p className="text-lg text-gray-800 font-medium leading-relaxed flex-1 border-b border-gray-100 pb-2">
                {inst.text}
              </p>

              {/* Per-instruction status */}
              <div className="flex-shrink-0 mt-1 min-w-[90px] text-right">
                {inst.status === 'filtering' && (
                  <span className="flex items-center justify-end gap-1 text-xs text-gray-400 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                )}
                {inst.status === 'saving' && (
                  <span className="flex items-center justify-end gap-1 text-xs text-blue-500 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                  </span>
                )}
                {inst.status === 'saved' && inst.isPlaying && (
                  <span className="flex items-center justify-end gap-1 text-xs text-blue-600 font-medium animate-pulse">
                    <Volume2 className="w-3 h-3" /> Playing...
                  </span>
                )}
                {inst.status === 'saved' && !inst.isPlaying && (
                  <span className="flex items-center justify-end gap-1 text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3" /> Saved
                  </span>
                )}
                {inst.status === 'error' && (
                  <span className="flex items-center justify-end gap-1 text-xs text-red-500">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Ghost buffer */}
          {currentBuffer && (
            <div className="flex items-start gap-3 opacity-40">
              <div className="min-w-[28px] h-7 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
              <p className="text-lg text-gray-400 italic leading-relaxed">
                {currentBuffer}...
              </p>
            </div>
          )}
        </div>

        <div ref={transcriptEndRef} />
      </div>

      {/* Controls — no SAVE button */}
      <div className="flex justify-center gap-4 py-4">

        {!isRecording && (
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

        {!isRecording && instructionsList.length > 0 && (
          <button
            onClick={handleDiscard}
            className="px-6 py-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-bold shadow-sm flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" /> DISCARD
          </button>
        )}
      </div>

      {/* Footer summary */}
      {!isRecording && savedCount > 0 && (
        <p className="text-center text-sm text-green-600 font-medium">
          ✅ {savedCount} instruction{savedCount !== 1 ? 's' : ''} saved to S3 and played.
        </p>
      )}

    </div>
  );
};

export default LiveTranscriptionRecorder;