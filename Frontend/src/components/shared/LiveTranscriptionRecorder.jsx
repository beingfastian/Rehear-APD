// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// UPDATED: Uses processLiveTranscription for instruction-based audio chunks

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
  const [dataSize, setDataSize] = useState(0);

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

      recognition.onerror = (event) => {
        console.error('[Speech Recognition] Error:', event.error);
        if (event.error !== 'no-speech') {
          setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('[Speech Recognition] Not supported in this browser');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
    };
  }, []);

  // --- 2. Start Recording ---
  const startRecording = async () => {
    setError(null);
    setDataSize(0);
    audioChunksRef.current = [];

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder with WAV format
      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          setDataSize(prev => prev + e.data.size);
        }
      };

      mediaRecorder.start(1000); // Collect data every 1 second
      
      // Start speech recognition for live preview
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn('[Speech Recognition] Already running or error:', e);
        }
      }

      setIsRecording(true);
      setLiveText('');

    } catch (err) {
      console.error('[Mic Error]', err);
      setError('Could not access microphone. Please check permissions and try again.');
    }
  };

  // --- 3. Stop Recording ---
  const stopRecording = () => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
    }

    // Stop all audio tracks to release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  // --- 4. Save & Process Recording ---
  const handleSave = async () => {
    // Validation
    if (audioChunksRef.current.length === 0 || dataSize < 1000) {
      setError('Recording is too short or empty. Please record again.');
      return;
    }

    if (!liveText || liveText.trim().length < 10) {
      setError('Not enough speech detected. Please try recording again.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      // Create audio blob from recorded chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Convert to File for upload
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

      console.log('[LiveRecorder] Processing audio file...');
      console.log('[LiveRecorder] File size:', audioFile.size, 'bytes');
      console.log('[LiveRecorder] Transcription preview:', liveText.substring(0, 100));

      // Upload audio file for processing
      // Backend will: transcribe → extract instructions → generate TTS
      const result = await processRecording(audioFile);
      
      console.log('[LiveRecorder] Processing complete:', result);
      
      // Callback to parent component
      if (onComplete) {
        onComplete(result);
      }
      
      // Reset for next recording
      reset();
      
    } catch (err) {
      console.error('[LiveRecorder] Processing error:', err);
      setError(`Processing failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 5. Reset State ---
  const reset = () => {
    setLiveText('');
    setError(null);
    setDataSize(0);
    audioChunksRef.current = [];
  };

  // --- 6. Discard Recording ---
  const handleDiscard = () => {
    reset();
    setIsRecording(false);
  };

  // Auto-scroll transcription
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveText]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
          <Mic className={`w-5 h-5 ${isRecording ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} /> 
          {isRecording ? 'Recording...' : 'Ready to Record'}
        </h2>
        
        {/* Buffer Size Indicator */}
        <div className="flex items-center gap-4">
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Live</span>
            </div>
          )}
          <div className="text-xs font-mono text-gray-400">
            Buffer: {(dataSize / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-center gap-3">
          <AlertCircle className="text-red-600 w-5 h-5 flex-shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Transcription Box */}
      <div className="bg-white border border-gray-200 rounded-lg min-h-[24rem] max-h-96 flex flex-col p-6 overflow-y-auto shadow-inner relative">
        {isProcessing ? (
          <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Processing Your Recording</h3>
            <p className="text-sm text-gray-600 text-center max-w-md">
              Transcribing audio → Extracting instructions → Generating audio chunks
            </p>
            <div className="mt-4 flex gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          <div className="flex-1">
            {liveText ? (
              <p className="font-sans text-lg leading-relaxed text-gray-700 whitespace-pre-wrap">
                {liveText}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 select-none">
                <Mic className="w-16 h-16 mb-4" />
                <p className="text-xl">Start recording to see transcription...</p>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>

      {/* Info Box */}
      {liveText && !isRecording && !isProcessing && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 What happens next:</strong> When you click "Save & Process", 
            the complete audio will be sent to our AI which will extract ONLY the instructional 
            sentences and generate audio chunks for each instruction.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-4 py-4">
        {!isRecording && !isProcessing && !liveText && (
          <button
            onClick={startRecording}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg transition-all hover:scale-105 flex items-center gap-2"
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
              onClick={handleDiscard}
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

      {/* Recording Tips */}
      {!liveText && !isRecording && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">Recording Tips:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Speak clearly and at a moderate pace</li>
            <li>• State instructions as clear, actionable sentences</li>
            <li>• Avoid long pauses between instructions</li>
            <li>• Background noise will be filtered out</li>
            <li>• The AI will automatically extract only instructional content</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptionRecorder;