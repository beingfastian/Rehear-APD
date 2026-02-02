// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// COMPLETELY FIXED VERSION - Proper audio format and error handling

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Volume2, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';

const LiveTranscriptionRecorder = ({ onComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [currentChunk, setCurrentChunk] = useState('');
  const [status, setStatus] = useState('idle'); // idle, connecting, recording, processing, complete, error
  const [error, setError] = useState(null);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [debugLogs, setDebugLogs] = useState([]);
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const processingTimeoutRef = useRef(null);

  // WebSocket URL - handles both development and production
  const getWebSocketURL = () => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';
    const wsUrl = process.env.REACT_APP_WS_URL;
    
    if (wsUrl) {
      return wsUrl;
    }
    
    // Convert HTTP URL to WebSocket URL
    const url = new URL(apiUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/live-transcription`;
  };

  const WS_URL = getWebSocketURL();

  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
    setDebugLogs(prev => [...prev.slice(-20), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    addDebugLog(`WebSocket URL: ${WS_URL}`);
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    addDebugLog('Cleaning up resources...');
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        addDebugLog(`Error stopping recorder: ${e.message}`);
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addDebugLog(`Stopped track: ${track.kind}`);
      });
    }
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        addDebugLog(`Error closing AudioContext: ${e.message}`);
      }
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      addDebugLog('WebSocket closed');
    }
  };

  const resetRecording = () => {
    addDebugLog('Resetting recording...');
    cleanup();
    
    setIsRecording(false);
    setRecordingTime(0);
    setLiveTranscription('');
    setCurrentChunk('');
    setStatus('idle');
    setError(null);
    setChunksProcessed(0);
    setConnectionStatus('disconnected');
    setDebugLogs([]);
    audioChunksRef.current = [];
  };

  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        addDebugLog(`Connecting to: ${WS_URL}`);
        setConnectionStatus('connecting');
        
        const ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
          addDebugLog('WebSocket connected successfully');
          setConnectionStatus('connected');
          setStatus('connected');
          
          // Send configuration
          const config = {
            type: 'config',
            sampleRate: 16000,
            channels: 1
          };
          
          addDebugLog(`Sending config: ${JSON.stringify(config)}`);
          ws.send(JSON.stringify(config));
          
          resolve(ws);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            addDebugLog(`Received: ${data.type} ${data.code || ''}`);
            
            switch (data.type) {
              case 'config_ack':
                addDebugLog('Configuration acknowledged by server');
                break;
              
              case 'transcription':
                 if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);

                 if (data.is_final) {
                   setLiveTranscription(prev => (prev + ' ' + data.text).trim());
                   setCurrentChunk('');
                 } else {
                   setCurrentChunk(data.text);
                 }
             
                 setChunksProcessed((data.chunk ?? 0) + 1);
                 break;


              
              case 'complete':
                addDebugLog(`Complete! Total chunks: ${data.total_chunks}`);
                
                if (processingTimeoutRef.current) {
                  clearTimeout(processingTimeoutRef.current);
                }
                
                setLiveTranscription(data.full_text);
                setStatus('complete');
                setConnectionStatus('disconnected');
                
                const recordedMime = mediaRecorderRef.current?.mimeType || 'audio/webm';
                if (onComplete) {
                  onComplete({
                    transcription: data.full_text,
                    chunks: data.total_chunks,
                    audioBlob: new Blob(audioChunksRef.current, { type: recordedMime })
                });
                }
                break;
              
              case 'error':
                addDebugLog(`Server error: ${data.message} (${data.code})`);
                setError(`Server error: ${data.message}`);
                setStatus('error');
                setConnectionStatus('disconnected');
                
                if (data.code === 'NO_API_KEY') {
                  setError('Backend is missing OpenAI API key. Please configure OPENAI_API_KEY in backend/.env file');
                }
                break;
              
              default:
                addDebugLog(`Unknown message type: ${data.type}`);
            }
          } catch (e) {
            addDebugLog(`Failed to parse message: ${e.message}`);
          }
        };
        
        ws.onerror = (error) => {
          addDebugLog(`WebSocket error: ${error}`);
          setError(`Connection failed. Is backend running at ${WS_URL}?`);
          setStatus('error');
          setConnectionStatus('disconnected');
          reject(error);
        };
        
        ws.onclose = (event) => {
          addDebugLog(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
          setConnectionStatus('disconnected');
          
          if (mediaRecorderRef.current?.state === 'recording') {
            setStatus('disconnected');
            setError('Connection lost during recording');
          }
        };
        
        wsRef.current = ws;
        
      } catch (error) {
        addDebugLog(`Failed to create WebSocket: ${error.message}`);
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
      
      addDebugLog('Starting recording process...');
      
      // Connect WebSocket first
      await connectWebSocket();
      
      addDebugLog('Requesting microphone access...');
      
      // Get microphone access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })
      
      addDebugLog('Microphone access granted');
      streamRef.current = stream;
      
      // Get audio settings
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      addDebugLog(`Audio track: ${settings.sampleRate}Hz, ${settings.channelCount} channel(s)`);
      
      // Create MediaRecorder with best available format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }
      
      addDebugLog(`Using MIME type: ${mimeType || 'default'}`);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 16000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle data available
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          addDebugLog(`Audio chunk available: ${event.data.size} bytes`);
          
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            // Store for final blob
            audioChunksRef.current.push(event.data);
            
            // Send via WebSocket
            const arrayBuffer = await event.data.arrayBuffer();
            addDebugLog(`Sending ${arrayBuffer.byteLength} bytes to server`);
            wsRef.current.send(arrayBuffer);
          } else {
            addDebugLog('WebSocket not open, cannot send audio');
          }
        }
      };
      
      mediaRecorder.onerror = (event) => {
        addDebugLog(`MediaRecorder error: ${event.error}`);
        setError(`Recording error: ${event.error.name}`);
      };
      
      // Start recording with time slice (send chunks every 1000ms)
      mediaRecorder.start(1000);
      addDebugLog('MediaRecorder started');
      
      setIsRecording(true);
      setStatus('recording');
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      addDebugLog('Recording started successfully');
      
    } catch (error) {
      addDebugLog(`Failed to start recording: ${error.message}`);
      
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(error.message || 'Failed to start recording');
      }
      
      setStatus('error');
      setConnectionStatus('disconnected');
    }
  };

  const stopRecording = () => {
    addDebugLog('Stopping recording...');
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      addDebugLog('MediaRecorder stopped');
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addDebugLog(`Stopped ${track.kind} track`);
      });
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    // Send stop signal to WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addDebugLog('Sending stop signal to server');
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    
    setIsRecording(false);
    setStatus('processing');
    
    // Set timeout for processing (30 seconds max)
    processingTimeoutRef.current = setTimeout(() => {
      if (status === 'processing') {
        addDebugLog('Processing timeout reached');
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
      {/* Connection Status */}
      {connectionStatus !== 'disconnected' && (
        <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
          connectionStatus === 'connected' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
          }`} />
          {connectionStatus === 'connected' ? '✅ Connected to server' : '🔄 Connecting...'}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={status === 'connecting' || status === 'processing'}
            className={`w-full sm:w-auto px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              status === 'connecting' || status === 'processing'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
            }`}
          >
            {status === 'connecting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting to server...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Start Live Recording
              </>
            )}
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
            <button
              onClick={stopRecording}
              className="w-full sm:w-auto px-4 py-3 bg-red-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
            >
              <Square className="w-5 h-5" />
              Stop Recording
            </button>
            
            <div className="flex items-center justify-center gap-3 py-2 sm:py-0 bg-red-50 rounded-lg px-4 border border-red-200">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-mono text-red-700 font-semibold">{formatTime(recordingTime)}</span>
              <Volume2 className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            
            <span className="text-xs text-gray-500 text-center sm:text-left bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              📊 {chunksProcessed} chunks processed
            </span>
          </div>
        )}

        {/* Reset Button */}
        {(status === 'processing' || status === 'error' || status === 'complete') && (
          <button
            onClick={resetRecording}
            className="w-full sm:w-auto px-4 py-3 bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-700 shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            Start New Recording
          </button>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 mb-1">❌ Error</p>
            <p className="text-xs text-red-700 mb-2">{error}</p>
            <button
              onClick={resetRecording}
              className="text-xs text-red-600 hover:text-red-700 underline font-medium"
            >
              → Reset and try again
            </button>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center gap-3 shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-blue-700">Processing final transcription...</span>
            <p className="text-xs text-blue-600 mt-1">⏱️ This may take up to 30 seconds</p>
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg flex items-center gap-3 shadow-sm">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <span className="text-sm text-green-700 font-semibold">✅ Transcription complete!</span>
        </div>
      )}

      {/* Live Transcription Display */}
      {(isRecording || liveTranscription || currentChunk) && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              📝 Live Transcription
              {isRecording && (
                <span className="text-xs text-gray-500 font-normal bg-gray-100 px-2 py-1 rounded">
                  Updates every 3 seconds
                </span>
              )}
            </h3>
            
            {isRecording && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            )}
          </div>
          
          <div className="min-h-[120px] max-h-[400px] overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
            {(liveTranscription || currentChunk)? (
            <p className="text-sm text-gray-800 leading-relaxed">
            {liveTranscription}
                {currentChunk ? (
              <span className="tecase 'transcription':xt-blue-600 font-semibold animate-pulse">
               {(liveTranscription ? " " : "")}{currentChunk}
             </span>
             ) : null}
            </p>
            ) : (
              <p className="text-sm text-gray-400 italic flex items-center justify-center h-full">
                🎤 Speak into your microphone... transcription will appear here
            </p>
            )}
          </div>
          
          {liveTranscription && (
            <div className="mt-3 flex gap-4 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
              <span>📊 Words: {liveTranscription.split(' ').filter(w => w).length}</span>
              <span>📏 Characters: {liveTranscription.length}</span>
              <span>🎯 Chunks: {chunksProcessed}</span>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!isRecording && !liveTranscription && status === 'idle' && (
        <div className="text-sm text-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4 shadow-sm">
          <p className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            🎙️ Live Transcription Feature
          </p>
          <ul className="text-xs space-y-1.5 text-blue-800 ml-1">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">▸</span>
              <span>Click "Start Live Recording" to begin</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">▸</span>
              <span>Speak clearly into your microphone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">▸</span>
              <span>Transcription appears in real-time as you speak</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">▸</span>
              <span>Audio is processed in 3-second chunks for accuracy</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">▸</span>
              <span>Click "Stop Recording" when finished</span>
            </li>
          </ul>
        </div>
      )}

      {/* Debug Panel */}
      <details className="bg-gray-100 rounded-lg p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
          🔍 Debug Logs ({debugLogs.length})
        </summary>
        <div className="mt-2 bg-black text-green-400 p-3 rounded font-mono text-xs max-h-64 overflow-y-auto">
          {debugLogs.length > 0 ? (
            debugLogs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))
          ) : (
            <div className="text-gray-500">No logs yet...</div>
          )}
        </div>
      </details>
    </div>
  );
};

export default LiveTranscriptionRecorder;
