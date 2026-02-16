// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// UPDATED: Real-time Instruction Filtering (Smart Mode)

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Save, Trash2, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import apiService from '../../services/api'; // Import API directly for fast chunk filtering

const LiveTranscriptionRecorder = ({ onComplete }) => {
  // Use the text-based processor for the final save
  const { processLiveTranscription } = useApp();

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [instructionsList, setInstructionsList] = useState([]); // Stores ONLY filtered instructions
  const [currentBuffer, setCurrentBuffer] = useState(''); // Shows what you are currently saying (before filtering)
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Refs
  const recognitionRef = useRef(null);
  const transcriptEndRef = useRef(null);

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

        // Process results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            // A sentence was finished. Send it to the Smart Filter!
            processFinalChunk(transcript);
          } else {
            // Still speaking this sentence (Interim)
            interimTranscript += transcript;
          }
        }
        setCurrentBuffer(interimTranscript);
      };

      recognition.onerror = (event) => {
        // Ignore 'no-speech' errors as they happen frequently during pauses
        if (event.error !== 'no-speech') {
          console.error("Speech API Error:", event.error);
          if (event.error === 'not-allowed') {
            setError("Microphone permission denied.");
          } else {
            setError(`Speech error: ${event.error}`);
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError("Your browser does not support Live Speech. Please use Chrome or Edge.");
    }
  }, []);

  // --- 2. Live Filtering Logic ---
  const processFinalChunk = async (rawText) => {
    if (!rawText || !rawText.trim()) return;

    try {
      console.log("Analyzing chunk:", rawText);

      // Call the fast backend endpoint to check if this is an instruction
      const result = await apiService.filterLiveChunk(rawText);

      if (result && result.filtered_text) {
        // It IS an instruction! Add to our clean list.
        console.log("Instruction detected:", result.filtered_text);
        setInstructionsList(prev => [...prev, result.filtered_text]);
      } else {
        console.log("Ignored conversational filler:", rawText);
      }
    } catch (err) {
      console.error("Filter failed", err);
    }
  };

  // --- 3. Recording Controls ---
  const startRecording = () => {
    setError(null);
    setInstructionsList([]);
    setCurrentBuffer("");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Mic start error", err);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setCurrentBuffer(""); // Clear buffer on stop
  };

  const handleDiscard = () => {
    stopRecording();
    setInstructionsList([]);
    setCurrentBuffer("");
    setError(null);
  };

  // --- 4. Save & Process (TEXT ONLY) ---
  const handleSave = async () => {
    // Validation
    if (instructionsList.length === 0) {
      setError("No valid instructions detected. Please speak some actionable steps.");
      return;
    }

    setIsProcessing(true);

    try {
      // Combine the filtered list into a full text block
      // We send this to the main processor to generate the Audio/TTS structure properly
      const fullText = instructionsList.join(". ");
      console.log("Saving filtered logic:", fullText);

      const result = await processLiveTranscription(fullText);

      console.log("Success:", result);
      if (onComplete) {
        onComplete(result);
      }

      // Reset after success
      setInstructionsList([]);

    } catch (err) {
      console.error(err);
      setError("Processing Failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [instructionsList, currentBuffer]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header / Status */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
            <Sparkles className={`w-5 h-5 ${isRecording ? 'text-blue-500' : 'text-gray-400'}`} />
            Smart Instruction Filter
          </h2>
          <p className="text-xs text-gray-500">I listen to everything, but I only write down instructions.</p>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold animate-pulse">
            <span className="w-2 h-2 bg-red-600 rounded-full"></span>
            LISTENING
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="text-red-600 w-5 h-5" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* The "Magic" Transcription Box */}
      <div className="bg-white border border-gray-200 rounded-lg h-96 flex flex-col p-6 overflow-y-auto shadow-inner relative">

        {/* Placeholder state */}
        {instructionsList.length === 0 && !currentBuffer && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 select-none">
            <Mic className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl font-medium">Ready to start.</p>
            <p className="text-sm mt-2">"Hi! <span className="text-blue-400 font-bold">Open the file.</span> How are you?"</p>
            <p className="text-xs mt-1 text-gray-400">(I will only capture "Open the file")</p>
          </div>
        )}

        <div className="space-y-4">
          {/* 1. Render the Filtered Instructions (The "Real" content) */}
          {instructionsList.map((inst, idx) => (
            <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="min-w-[28px] h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 shadow-sm">
                {idx + 1}
              </div>
              <p className="text-lg text-gray-800 font-medium leading-relaxed border-b border-gray-50 pb-2 w-full">
                {inst}
              </p>
            </div>
          ))}

          {/* 2. Render the "Ghost" Buffer (What you are currently saying) */}
          {currentBuffer && (
            <div className="flex items-start gap-3 opacity-50">
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

        {/* Loading Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-gray-800">Finalizing Logic...</h3>
            <p className="text-sm text-gray-500">Generating audio steps</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 py-4">
        {!isRecording && !isProcessing && (
          <button
            onClick={startRecording}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
          >
            <Mic className="w-6 h-6" /> {instructionsList.length > 0 ? "RESUME" : "START"}
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-full font-bold shadow-lg flex items-center gap-2"
          >
            <Square className="w-5 h-5" /> PAUSE
          </button>
        )}

        {!isRecording && instructionsList.length > 0 && !isProcessing && (
          <div className="flex gap-4">
             <button
              onClick={handleDiscard}
              className="px-6 py-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-bold shadow-sm flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" /> DISCARD
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg flex items-center gap-2"
            >
              <Save className="w-6 h-6" /> SAVE STEPS
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTranscriptionRecorder;