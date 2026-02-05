import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Save, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const LiveTranscriptionRecorder = ({ onComplete }) => {
  const { processRecording } = useApp();
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [dataSize, setDataSize] = useState(0); // Track recording size

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptEndRef = useRef(null);

  // --- 1. Initialize Live Speech (Preview Engine) ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript;
        }
        setLiveText(finalTranscript);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // --- 2. Start Recording (With Safety Checks) ---
  const startRecording = async () => {
    setError(null);
    setDataSize(0);
    audioChunksRef.current = []; // Clear previous data

    try {
      // Get a fresh stream every time
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Store ref to close later

      // Use standard WebM format
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          setDataSize(prev => prev + e.data.size); // Track that data is flowing
        }
      };

      mediaRecorder.start(1000); // Slice chunks every 1s to ensure data flow
      
      // Start Live Preview
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {/* ignore if already running */}
      }

      setIsRecording(true);
      setLiveText(""); 

    } catch (err) {
      console.error("Mic Error:", err);
      setError("Could not access microphone. Please refresh.");
    }
  };

  // --- 3. Stop Recording (Clean Shutdown) ---
  const stopRecording = () => {
    // Stop Media Recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop Speech Recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // CRITICAL: Stop all tracks to release mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  // --- 4. Process Recording ---
  const handleSave = async () => {
    // Validation: Did we actually record audio?
    if (audioChunksRef.current.length === 0 || dataSize < 1000) {
      setError("Recording is too short or empty. Please record again.");
      return;
    }

    setIsProcessing(true);
    
    try {
      // FIX: Use 'audio/webm' (Browser Native) to avoid file corruption
      // The backend (FFmpeg) handles .webm perfectly fine even if saved as .wav
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Create a File object to ensure backend treats it right
      const audioFile = new File([audioBlob], "recording.webm", { type: "audio/webm" });

      // Call context function (Make sure processRecording accepts a File/Blob)
      // If your AppContext expects a Blob, audioBlob is fine.
      const result = await processRecording(audioFile);
      
      console.log("Success:", result);
      if (onComplete) onComplete(result);
      
    } catch (err) {
      console.error(err);
      setError("Processing Failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setLiveText("");
    setError(null);
    setDataSize(0);
    audioChunksRef.current = [];
  };

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveText]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
          <Mic className={`w-5 h-5 ${isRecording ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} /> 
          {isRecording ? 'Listening...' : 'Live Transcriber'}
        </h2>
        
        {/* Debug Info: Show if audio bytes are actually being captured */}
        <div className="text-xs font-mono text-gray-400">
          Buffer: {(dataSize / 1024).toFixed(1)} KB
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="text-red-600 w-5 h-5" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Transcription Box */}
      <div className="bg-white border border-gray-200 rounded-lg h-96 flex flex-col p-6 overflow-y-auto shadow-inner relative">
        <p className="font-sans text-xl leading-relaxed text-gray-700 whitespace-pre-wrap">
          {liveText || <span className="text-gray-300 select-none">Start speaking...</span>}
        </p>
        <div ref={transcriptEndRef} />
        
        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-gray-800">Generating AI Instructions...</h3>
            <p className="text-sm text-gray-500">Transcribing • Analyzing • Chunking</p>
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
            <Mic className="w-6 h-6" /> START RECORDING
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

        {!isRecording && liveText && !isProcessing && (
          <div className="flex gap-4">
             <button
              onClick={reset}
              className="px-6 py-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-bold shadow-sm flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" /> DISCARD
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg flex items-center gap-2"
            >
              <Save className="w-6 h-6" /> SAVE & PROCESS
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTranscriptionRecorder;