// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// IMPROVED VERSION - Better error handling and reset functionality

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Volume2, AlertCircle, RefreshCw } from 'lucide-react';

const LiveTranscriptionRecorder = ({ onComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [currentChunk, setCurrentChunk] = useState('');
  const [status, setStatus] = useState('idle'); // idle, connecting, recording, processing, complete, error
  const [error, setError] = useState(null);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const processingTimeoutRef = useRef(null);

  // WebSocket URL - update based on your backend
  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:10000/ws/live-transcription';

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
  };

  const resetRecording = () => {
    console.log('[LiveTranscription] Resetting...');
    cleanup();
    
    setIsRecording(false);
    setRecordingTime(0);
    setLiveTranscription('');
    setCurrentChunk('');
    setStatus('idle');
    setError(null);
    setChunksProcessed(0);
    setConnectionStatus('disconnected');
    audioChunksRef.current = [];
  };

  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        console.log('[LiveTranscription] Connecting to WebSocket:', WS_URL);
        setConnectionStatus('connecting');
        
        const ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
          console.log('[LiveTranscription] WebSocket connected');
          setConnectionStatus('connected');
          setStatus('connected');
          
          // Send configuration
          ws.send(JSON.stringify({
            type: 'config',
            sampleRate: 16000,
            channels: 1
          }));
          
          resolve(ws);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[LiveTranscription] Received:', data.type);
            
            switch (data.type) {
              case 'config_ack':
                console.log('[LiveTranscription] Config acknowledged');
                break;
              
              case 'transcription':
                // Clear processing timeout since we got a response
                if (processingTimeoutRef.current) {
                  clearTimeout(processingTimeoutRef.current);
                }
                
                // Update live transcription
                if (data.is_final) {
                  setLiveTranscription(prev => prev + ' ' + data.text);
                  setCurrentChunk('');
                } else {
                  setCurrentChunk(data.text);
                  setLiveTranscription(prev => prev + ' ' + data.text);
                }
                setChunksProcessed(data.chunk + 1);
                break;
              
              case 'complete':
                console.log('[LiveTranscription] Complete:', data.full_text);
                
                // Clear processing timeout
                if (processingTimeoutRef.current) {
                  clearTimeout(processingTimeoutRef.current);
                }
                
                setLiveTranscription(data.full_text);
                setStatus('complete');
                setConnectionStatus('disconnected');
                
                // Call completion callback with full transcription
                if (onComplete) {
                  onComplete({
                    transcription: data.full_text,
                    chunks: data.total_chunks,
                    audioBlob: new Blob(audioChunksRef.current, { type: 'audio/wav' })
                  });
                }
                break;
              
              case 'error':
                console.error('[LiveTranscription] Server error:', data.message);
                setError(data.message);
                setStatus('error');
                setConnectionStatus('disconnected');
                break;
              
              default:
                console.log('[LiveTranscription] Unknown message type:', data.type);
            }
          } catch (e) {
            console.error('[LiveTranscription] Failed to parse message:', e);
          }
        };
        
        ws.onerror = (error) => {
          console.error('[LiveTranscription] WebSocket error:', error);
          setError('WebSocket connection failed. Is backend running?');
          setStatus('error');
          setConnectionStatus('disconnected');
          reject(error);
        };
        
        ws.onclose = () => {
          console.log('[LiveTranscription] WebSocket closed');
          setConnectionStatus('disconnected');
          if (status === 'recording') {
            setStatus('disconnected');
            setError('Connection lost during recording');
          }
        };
        
        wsRef.current = ws;
        
      } catch (error) {
        console.error('[LiveTranscription] Failed to create WebSocket:', error);
        setConnectionStatus('disconnected');
        reject(error);
      }
    });
  };

  const startRecording = async () => {
    try {
      setError(null);
      setLiveTranscription('');
      setCurrentChunk('');
      setChunksProcessed(0);
      audioChunksRef.current = [];
      setStatus('connecting');
      
      // Connect WebSocket first
      await connectWebSocket();
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      streamRef.current = stream;
      
      // Create AudioContext for processing
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle data available (send to WebSocket)
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Store for final blob
          audioChunksRef.current.push(event.data);
          
          // Convert to ArrayBuffer and send via WebSocket
          const arrayBuffer = await event.data.arrayBuffer();
          wsRef.current.send(arrayBuffer);
        }
      };
      
      // Start recording with time slice (send chunks every 500ms)
      mediaRecorder.start(500);
      
      setIsRecording(true);
      setStatus('recording');
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log('[LiveTranscription] Recording started');
      
    } catch (error) {
      console.error('[LiveTranscription] Failed to start recording:', error);
      setError(error.message || 'Failed to access microphone');
      setStatus('error');
      setConnectionStatus('disconnected');
    }
  };

  const stopRecording = () => {
    console.log('[LiveTranscription] Stopping recording');
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    // Send stop signal to WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    
    setIsRecording(false);
    setStatus('processing');
    
    // Set timeout for processing (30 seconds max)
    processingTimeoutRef.current = setTimeout(() => {
      if (status === 'processing') {
        setError('Processing timeout - transcription took too long. Try a shorter recording.');
        setStatus('error');
      }
    }, 30000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Connection Status Indicator */}
      {connectionStatus !== 'disconnected' && (
        <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
          connectionStatus === 'connected' 
            ? 'bg-green-50 text-green-700' 
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
          }`} />
          {connectionStatus === 'connected' ? 'Connected to server' : 'Connecting...'}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={status === 'connecting' || status === 'processing'}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              status === 'connecting' || status === 'processing'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {status === 'connecting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Live Recording
              </>
            )}
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
            <button
              onClick={stopRecording}
              className="w-full sm:w-auto px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition-all"
            >
              <Square className="w-4 h-4" />
              Stop Recording
            </button>
            
            <div className="flex items-center justify-center gap-2 py-2 sm:py-0">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-mono text-gray-700">{formatTime(recordingTime)}</span>
              <Volume2 className="w-4 h-4 text-red-500 animate-pulse" />
            </div>
            
            <span className="text-xs text-gray-500 text-center sm:text-left">
              {chunksProcessed} chunks processed
            </span>
          </div>
        )}

        {/* Reset Button - Show when stuck or error */}
        {(status === 'processing' || status === 'error' || status === 'complete') && (
          <button
            onClick={resetRecording}
            className="w-full sm:w-auto px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-600"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-xs text-red-700">{error}</p>
            <button
              onClick={resetRecording}
              className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
            >
              Click here to reset and try again
            </button>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <div className="flex-1">
            <span className="text-sm text-blue-700">Processing final transcription...</span>
            <p className="text-xs text-blue-600 mt-1">This may take up to 30 seconds</p>
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
          <span className="text-sm text-green-700 font-medium">Transcription complete!</span>
        </div>
      )}

      {/* Live Transcription Display */}
      {(isRecording || liveTranscription) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">
              Live Transcription
              {isRecording && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  (updates every 3 seconds)
                </span>
              )}
            </h3>
            
            {isRecording && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            )}
          </div>
          
          <div className="min-h-[100px] max-h-[300px] overflow-y-auto bg-gray-50 rounded p-3">
            {liveTranscription ? (
              <p className="text-sm text-gray-800 leading-relaxed">
                {liveTranscription}
                {currentChunk && (
                  <span className="text-blue-600 font-medium animate-pulse">
                    {' '}{currentChunk}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">
                Speak into your microphone... transcription will appear here in real-time
              </p>
            )}
          </div>
          
          {liveTranscription && (
            <div className="mt-2 text-xs text-gray-500">
              Words: {liveTranscription.split(' ').filter(w => w).length} | 
              Characters: {liveTranscription.length}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!isRecording && !liveTranscription && status === 'idle' && (
        <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="font-medium text-blue-900 mb-1">🎙️ Live Transcription Feature</p>
          <ul className="text-xs space-y-1 text-blue-800 ml-4 list-disc">
            <li>Click "Start Live Recording" to begin</li>
            <li>Speak clearly into your microphone</li>
            <li>Transcription appears in real-time as you speak</li>
            <li>Audio is processed in 3-second chunks</li>
            <li>Click "Stop Recording" when done</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptionRecorder;