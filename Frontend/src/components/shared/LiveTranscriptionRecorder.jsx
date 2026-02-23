// Frontend/src/components/shared/LiveTranscriptionRecorder.jsx
// DEBUG VERSION - shows exactly where the pipeline breaks

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Loader2, AlertCircle, Sparkles, CheckCircle, Volume2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import apiService from '../../services/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';
const CHUNK_INTERVAL_MS = 5000;

const LiveTranscriptionRecorder = ({ onComplete }) => {

  const [isRecording, setIsRecording] = useState(false);
  const [instructionsList, setInstructionsList] = useState([]);
  const [currentBuffer, setCurrentBuffer] = useState('');
  const [error, setError] = useState(null);
  const [debugLog, setDebugLog] = useState([]);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isRecordingRef = useRef(false);
  const processFinalChunkRef = useRef(null);
  const transcriptEndRef = useRef(null);

  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);

  const log = (msg, type = 'info') => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLog(prev => [...prev.slice(-20), { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  // --- Audio Queue ---
  const playNext = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    const url = audioQueueRef.current.shift();
    if (!url) return;
    isPlayingRef.current = true;
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    audio.onended = () => { isPlayingRef.current = false; currentAudioRef.current = null; playNext(); };
    audio.onerror = () => { isPlayingRef.current = false; currentAudioRef.current = null; playNext(); };
    audio.play().catch(() => { isPlayingRef.current = false; playNext(); });
  }, []);

  const queueAudio = useCallback((url) => {
    if (!url) return;
    audioQueueRef.current.push(url);
    playNext();
  }, [playNext]);

  // --- Main chunk processor ---
  const processFinalChunk = useCallback(async (audioBlob) => {
    log(`📦 Chunk received: ${audioBlob.size} bytes, type: ${audioBlob.type}`, 'info');

    if (!audioBlob || audioBlob.size < 1000) {
      log(`⏭️ Chunk too small (${audioBlob?.size} bytes), skipping`, 'warn');
      return;
    }

    setCurrentBuffer('transcribing...');

    try {
      // Step 1: Whisper transcription
      log(`🎤 Sending to /transcribe-chunk...`, 'info');
      const formData = new FormData();
      formData.append('file', audioBlob, 'chunk.webm');

      const transcribeRes = await fetch(`${API_BASE_URL}/transcribe-chunk`, {
        method: 'POST',
        body: formData,
      });

      log(`📡 /transcribe-chunk status: ${transcribeRes.status}`, transcribeRes.ok ? 'success' : 'error');

      if (!transcribeRes.ok) {
        const errText = await transcribeRes.text();
        log(`❌ Transcribe failed: ${errText}`, 'error');
        setCurrentBuffer('');
        return;
      }

      const transcribeData = await transcribeRes.json();
      log(`📝 Whisper result: "${transcribeData.text || 'empty'}"`, 'info');
      setCurrentBuffer('');

      if (!transcribeData.text || !transcribeData.text.trim()) {
        log(`⏭️ Empty transcription, skipping`, 'warn');
        return;
      }

      // Step 2: Filter
      log(`🔍 Filtering: "${transcribeData.text.substring(0, 60)}"`, 'info');
      const filterResult = await apiService.filterLiveChunk(transcribeData.text);
      log(`🔍 Filter result: "${filterResult?.filtered_text || 'empty'}"`, filterResult?.filtered_text ? 'success' : 'warn');

      if (!filterResult?.filtered_text?.trim()) {
        log(`⏭️ Not an instruction, skipped`, 'warn');
        return;
      }

      const instruction = filterResult.filtered_text.trim();
      const instructionId = Date.now() + Math.random();

      setInstructionsList(prev => [
        ...prev,
        { id: instructionId, text: instruction, status: 'saving', audioUrl: null }
      ]);

      // Step 3: Save + TTS
      log(`💾 Saving: "${instruction}"`, 'info');
      try {
        const saveResult = await apiService.processLiveText(instruction);
        const audioUrl = saveResult?.instructions?.[0]?.steps?.[0]?.audio || null;
        log(`✅ Saved! job_id: ${saveResult.job_id}, audio: ${audioUrl ? 'yes' : 'no'}`, 'success');

        setInstructionsList(prev =>
          prev.map(item =>
            item.id === instructionId ? { ...item, status: 'saved', audioUrl } : item
          )
        );

        if (audioUrl) {
          log(`🔊 Queuing audio for playback`, 'success');
          queueAudio(audioUrl);
        }

        if (onComplete) onComplete(saveResult);

      } catch (saveErr) {
        log(`❌ Save failed: ${saveErr.message}`, 'error');
        setInstructionsList(prev =>
          prev.map(item =>
            item.id === instructionId ? { ...item, status: 'error' } : item
          )
        );
      }

    } catch (err) {
      log(`❌ Pipeline error: ${err.message}`, 'error');
      setCurrentBuffer('');
    }
  }, [onComplete, queueAudio]);

  useEffect(() => {
    processFinalChunkRef.current = processFinalChunk;
  }, [processFinalChunk]);

  // --- Start Recording ---
  const startRecording = async () => {
    setError(null);
    setInstructionsList([]);
    setCurrentBuffer('');
    setDebugLog([]);
    audioQueueRef.current = [];

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      isPlayingRef.current = false;
    }

    try {
      log('🎙️ Requesting mic access...', 'info');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;
      log('✅ Mic access granted', 'success');

      // Detect supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : '';

      log(`🎞️ Using mimeType: ${mimeType || 'browser default'}`, 'info');

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        log(`📦 ondataavailable fired: ${e.data?.size || 0} bytes`, 'info');
        if (e.data && e.data.size > 1000 && isRecordingRef.current) {
          processFinalChunkRef.current?.(e.data);
        } else {
          log(`⏭️ Skipped chunk: size=${e.data?.size}, recording=${isRecordingRef.current}`, 'warn');
        }
      };

      mediaRecorder.onstart = () => log('▶️ MediaRecorder started', 'success');
      mediaRecorder.onstop = () => log('⏹️ MediaRecorder stopped', 'warn');
      mediaRecorder.onerror = (e) => log(`❌ MediaRecorder error: ${e.error}`, 'error');

      mediaRecorder.start(CHUNK_INTERVAL_MS);
      log(`⏱️ Recording, chunk every ${CHUNK_INTERVAL_MS / 1000}s`, 'info');

      isRecordingRef.current = true;
      setIsRecording(true);

    } catch (err) {
      log(`❌ Mic failed: ${err.name} - ${err.message}`, 'error');
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow mic access.');
      } else {
        setError('Could not start recording: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    log('⏹️ Stop pressed', 'warn');
    isRecordingRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setCurrentBuffer('');
  };

  const handleDiscard = () => {
    stopRecording();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      isPlayingRef.current = false;
    }
    audioQueueRef.current = [];
    setInstructionsList([]);
    setCurrentBuffer('');
    setError(null);
    setDebugLog([]);
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [instructionsList, currentBuffer]);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const savedCount = instructionsList.filter(i => i.status === 'saved').length;
  const savingCount = instructionsList.filter(i => i.status === 'saving').length;
  const errorCount = instructionsList.filter(i => i.status === 'error').length;

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
            Powered by Whisper — accurate transcription every {CHUNK_INTERVAL_MS / 1000}s.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {instructionsList.length > 0 && (
            <div className="text-xs text-right">
              {savedCount > 0 && <div className="text-green-600 font-medium">✅ {savedCount} saved</div>}
              {savingCount > 0 && <div className="text-blue-500 animate-pulse">💾 {savingCount} saving...</div>}
              {errorCount > 0 && <div className="text-red-500">❌ {errorCount} failed</div>}
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold animate-pulse">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
              RECORDING
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-center gap-3">
          <AlertCircle className="text-red-600 w-5 h-5 flex-shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Debug Panel */}
      {debugLog.length > 0 && (
        <div className="bg-gray-900 text-xs font-mono rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
          <div className="text-gray-400 mb-1 font-bold">DEBUG LOG</div>
          {debugLog.map((entry, i) => (
            <div key={i} className={
              entry.type === 'error' ? 'text-red-400' :
              entry.type === 'success' ? 'text-green-400' :
              entry.type === 'warn' ? 'text-yellow-400' :
              'text-gray-300'
            }>
              [{entry.time}] {entry.msg}
            </div>
          ))}
        </div>
      )}

      {/* Transcription Box */}
      <div className="bg-white border border-gray-200 rounded-lg h-80 flex flex-col p-6 overflow-y-auto shadow-inner">

        {instructionsList.length === 0 && !currentBuffer && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 select-none">
            <Mic className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl font-medium">Ready to start.</p>
            <p className="text-sm mt-2">Speak naturally — results appear every {CHUNK_INTERVAL_MS / 1000} seconds.</p>
          </div>
        )}

        <div className="space-y-4">
          {instructionsList.map((item, idx) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="min-w-[28px] h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                {idx + 1}
              </div>
              <p className="text-lg text-gray-800 font-medium leading-relaxed flex-1 border-b border-gray-50 pb-2">
                {item.text}
              </p>
              <div className="mt-1 flex-shrink-0 flex items-center gap-1">
                {item.status === 'saving' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                {item.status === 'saved' && <><CheckCircle className="w-4 h-4 text-green-500" /><Volume2 className="w-4 h-4 text-blue-400" /></>}
                {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>
          ))}

          {currentBuffer && (
            <div className="flex items-center gap-3 opacity-50">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <p className="text-sm text-gray-400 italic">{currentBuffer}</p>
            </div>
          )}
        </div>

        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 py-4">
        {!isRecording && (
          <button onClick={startRecording}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg flex items-center gap-2">
            <Mic className="w-6 h-6" />
            {instructionsList.length > 0 ? 'RESUME' : 'START'}
          </button>
        )}

        {isRecording && (
          <button onClick={stopRecording}
            className="px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-full font-bold shadow-lg flex items-center gap-2">
            <Square className="w-5 h-5" /> STOP
          </button>
        )}

        {!isRecording && instructionsList.length > 0 && (
          <button onClick={handleDiscard}
            className="px-6 py-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-bold shadow-sm flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> DISCARD
          </button>
        )}
      </div>

    </div>
  );
};

export default LiveTranscriptionRecorder;