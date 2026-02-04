// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// Real-time transcription with WebSocket connection to backend

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Save, X, CheckCircle, AlertCircle, PlayCircle } from 'lucide-react';

const LiveTranscriptionRecorder = ({ onComplete }) => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Transcription state
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  // Results state
  const [processedResult, setProcessedResult] = useState(null);
  
  // Error state
  const [error, setError] = useState(null);
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const websocketRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const recordingBlobRef = useRef(null);
  
  // WebSocket connection
  const connectWebSocket = () => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://127.0.0.1:10000/ws/live-transcription';
    
    console.log('[LiveTranscription] Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[LiveTranscription] WebSocket connected');
      setError(null);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[LiveTranscription] Received:', data.type);
      
      switch (data.type) {
        case 'transcription':
          // Append new transcription
          setTranscription(prev => {
            const newText = prev ? `${prev} ${data.text}` : data.text;
            return newText.trim();
          });
          setChunksProcessed(data.chunk_index + 1);
          setIsTranscribing(false);
          break;
          
        case 'stopped':
          console.log('[LiveTranscription] Recording stopped, chunks:', data.chunks_received);
          break;
          
        case 'completed':
          console.log('[LiveTranscription] Processing completed:', data.data);
          setIsProcessing(false);
          
          // Store the processed result to display
          setProcessedResult(data.data);
          
          // Call parent callback with results
          if (onComplete) {
            onComplete({
              transcription: data.data.transcription,
              instructions: data.data.instructions,
              job_id: data.data.job_id,
              audioBlob: recordingBlobRef.current,
              chunks: data.data.instruction_count
            });
          }
          
          // Don't reset immediately - show the results
          break;
          
        case 'discarded':
          console.log('[LiveTranscription] Recording discarded');
          setIsProcessing(false);
          resetRecording();
          break;
          
        case 'error':
          console.error('[LiveTranscription] Server error:', data.message);
          setError(data.message);
          setIsProcessing(false);
          break;
          
        default:
          console.log('[LiveTranscription] Unknown message type:', data.type);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[LiveTranscription] WebSocket error:', error);
      setError('WebSocket connection error. Please check if backend is running.');
    };
    
    ws.onclose = () => {
      console.log('[LiveTranscription] WebSocket disconnected');
    };
    
    websocketRef.current = ws;
  };
  
  // Start recording
  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;
      
      // Connect WebSocket first
      connectWebSocket();
      
      // Wait a bit for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Setup MediaRecorder
      const options = { mimeType: 'audio/webm;codecs=opus' };
      
      // Check if mimeType is supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('[LiveTranscription] Opus not supported, trying default');
        delete options.mimeType;
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Handle audio data - THIS IS KEY FOR CONTINUOUS TRANSCRIPTION
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log('[LiveTranscription] Got audio chunk, size:', event.data.size);
          
          // Store for final save
          audioChunksRef.current.push(event.data);
          
          // Send to WebSocket for live transcription
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            setIsTranscribing(true);
            
            try {
              // Convert Blob to ArrayBuffer
              const arrayBuffer = await event.data.arrayBuffer();
              
              // Send to backend
              websocketRef.current.send(arrayBuffer);
              console.log('[LiveTranscription] Sent chunk to backend');
              
            } catch (error) {
              console.error('[LiveTranscription] Error sending audio:', error);
              setIsTranscribing(false);
            }
          } else {
            console.warn('[LiveTranscription] WebSocket not ready');
          }
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('[LiveTranscription] MediaRecorder error:', event.error);
        setError('Recording error: ' + event.error.message);
      };
      
      // Start recording with 2-second chunks for continuous transcription
      // This will trigger ondataavailable every 2 seconds
      mediaRecorder.start(2000);
      
      setIsRecording(true);
      setRecordingTime(0);
      setTranscription('');
      setChunksProcessed(0);
      setShowControls(false);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log('[LiveTranscription] Recording started with 2-second chunks');
      
    } catch (error) {
      console.error('[LiveTranscription] Failed to start recording:', error);
      setError('Microphone access denied. Please allow microphone access.');
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Create final blob
      setTimeout(() => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        recordingBlobRef.current = audioBlob;
        
        // Send stop signal to backend
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({ action: 'stop' }));
        }
        
        // Show save/discard controls
        setShowControls(true);
        
        console.log('[LiveTranscription] Recording stopped, size:', audioBlob.size);
      }, 500);
    }
  };
  
  // Save and process recording
  const saveRecording = () => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true);
      setShowControls(false);
      
      // Send save command to backend
      websocketRef.current.send(JSON.stringify({ action: 'save' }));
      
      console.log('[LiveTranscription] Processing recording...');
    }
  };
  
  // Discard recording
  const discardRecording = () => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ action: 'discard' }));
    }
    
    resetRecording();
    console.log('[LiveTranscription] Recording discarded');
  };
  
  // Reset everything
  const resetRecording = () => {
    setTranscription('');
    setChunksProcessed(0);
    setRecordingTime(0);
    setShowControls(false);
    setIsTranscribing(false);
    setIsProcessing(false);
    setProcessedResult(null);
    audioChunksRef.current = [];
    recordingBlobRef.current = null;
    
    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
  };
  
  // Start new recording
  const startNewRecording = () => {
    resetRecording();
  };
  
  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);
  
  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">Error</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Recording Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {!isRecording && !showControls && !isProcessing && (
          <div className="text-center">
            <button
              onClick={startRecording}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all flex items-center gap-2 mx-auto"
            >
              <Mic className="w-5 h-5" />
              Start Live Transcription
            </button>
            <p className="text-xs text-gray-600 text-center">
              Click to start recording. You'll see live transcription as you speak (preview only). When you click Save, the complete audio will be processed.
            </p>
          </div>
        )}
        
        {isRecording && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-lg font-mono text-gray-700">{formatTime(recordingTime)}</span>
              </div>
              
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop Recording
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Chunks processed: {chunksProcessed}</span>
              {isTranscribing && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Transcribing...
                </span>
              )}
            </div>
          </div>
        )}
        
        {showControls && !isProcessing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">Recording complete</span>
              </div>
              <span className="text-sm text-gray-500">{formatTime(recordingTime)}</span>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={saveRecording}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save & Process
              </button>
              
              <button
                onClick={discardRecording}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Discard
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              Save to transcribe full audio, generate instructional chunks with TTS audio, and save to database. Or discard to start over.
            </p>
          </div>
        )}
        
        {isProcessing && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Processing complete recording...</p>
            <p className="text-sm text-gray-500 mt-1">
              Transcribing • Detecting instructions • Generating TTS audio
            </p>
          </div>
        )}
      </div>
      
      {/* Live Transcription Display */}
      {transcription && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Live Transcription Preview</h3>
              <p className="text-xs text-gray-500 mt-1">
                Real-time preview • Full transcription happens when you save
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Words: {transcription.split(' ').length}</span>
              <span>•</span>
              <span>Characters: {transcription.length}</span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {transcription}
              {isTranscribing && (
                <span className="inline-block ml-1">
                  <Loader2 className="w-3 h-3 animate-spin inline" />
                </span>
              )}
            </p>
          </div>
          
          {isRecording && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              Transcription updates in real-time as you speak
            </p>
          )}
        </div>
      )}
      
      {/* Instructions */}
      {!isRecording && !showControls && !isProcessing && !error && !processedResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 text-sm mb-2">How it works:</h4>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>Click "Start" to begin recording</li>
            <li>See live transcription appear as you speak (preview only)</li>
            <li>Click "Stop" when finished</li>
            <li>Click "Save & Process" to:</li>
            <ul className="ml-6 mt-1 space-y-1">
              <li>• Transcribe the complete recording</li>
              <li>• Detect instructions with AI</li>
              <li>• Generate audio chunks with TTS</li>
              <li>• Save everything to database</li>
            </ul>
            <li>Or "Discard" to delete and start over</li>
          </ul>
        </div>
      )}
      
      {/* Processed Results - Show Instructions and Audio Chunks */}
      {processedResult && (
        <div className="space-y-4 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Processing Complete!</h3>
            </div>
            <p className="text-sm text-green-800">
              Generated {processedResult.instruction_count} instructions with audio chunks
            </p>
          </div>
          
          {/* Display Instructions with Audio Chunks */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Generated Instructions & Audio Chunks</h3>
            
            {processedResult.instructions && processedResult.instructions.length > 0 ? (
              <div className="space-y-6">
                {processedResult.instructions.map((instruction, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Instruction {idx + 1}: {instruction.instruction}
                    </h4>
                    
                    {instruction.steps && instruction.steps.length > 0 && (
                      <div className="space-y-2">
                        {instruction.steps.map((step, stepIdx) => (
                          <div key={stepIdx} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm text-gray-700 mb-2">
                                  <span className="font-medium">Step {stepIdx + 1}:</span> {step.text}
                                </p>
                                {step.audio && (
                                  <audio 
                                    controls 
                                    className="w-full h-8"
                                    style={{ maxWidth: '300px' }}
                                  >
                                    <source src={step.audio} type="audio/mpeg" />
                                    Your browser does not support audio playback.
                                  </audio>
                                )}
                              </div>
                              {step.audio && (
                                <a
                                  href={step.audio}
                                  download={`step_${idx + 1}_${stepIdx + 1}.mp3`}
                                  className="text-blue-600 hover:text-blue-800 text-xs whitespace-nowrap"
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No instructions detected in the recording.</p>
            )}
          </div>
          
          {/* Start New Recording Button */}
          <div className="text-center">
            <button
              onClick={startNewRecording}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all"
            >
              Start New Recording
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptionRecorder;