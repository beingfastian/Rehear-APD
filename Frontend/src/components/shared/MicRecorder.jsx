// Frontend/src/components/shared/MicRecorder.jsx

import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const MicRecorder = ({ onSuccess }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const { processRecording, isProcessing } = useApp();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        try {
          const job = await processRecording(audioBlob);
          if (onSuccess) {
            onSuccess(job);
          }
        } catch (error) {
          console.error('Processing failed:', error);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Please allow microphone access to record audio');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
      {!isRecording ? (
        <button
          onClick={startRecording}
          disabled={isProcessing}
          className={`w-full sm:w-auto px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Mic className="w-3 h-3 sm:w-4 sm:h-4" />
          Start Recording
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
          <button
            onClick={stopRecording}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition-all"
          >
            <Square className="w-3 h-3 sm:w-4 sm:h-4" />
            Stop Recording
          </button>
          
          <div className="flex items-center justify-center gap-2 py-2 sm:py-0">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs sm:text-sm font-mono text-gray-700">{formatTime(recordingTime)}</span>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-blue-600 py-2 sm:py-0">
          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
          <span className="text-xs sm:text-sm">Processing recording...</span>
        </div>
      )}
    </div>
  );
};

export default MicRecorder;