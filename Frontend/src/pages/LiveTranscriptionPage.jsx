// Frontend/src/pages/LiveTranscriptionPage.jsx
// Dedicated page for live transcription feature

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import LiveTranscriptionRecorder from '../components/shared/LiveTranscriptionRecorder';
import { FileText, Download, CheckCircle } from 'lucide-react';

const LiveTranscriptionPage = ({ setCurrentPage }) => {
  const { processRecording, showNotification } = useApp();
  const [completedTranscription, setCompletedTranscription] = useState(null);
  const [isProcessingInstructions, setIsProcessingInstructions] = useState(false);

  const handleRecordingComplete = async (result) => {
    console.log('[LiveTranscription] Recording complete:', result);
    
    setCompletedTranscription({
      text: result.transcription,
      chunks: result.chunks,
      timestamp: new Date().toISOString()
    });
    
    showNotification('Live transcription complete!', 'success');
    
    // Optionally process the audio for instructions
    // This will create the full job with TTS chunks
    setIsProcessingInstructions(true);
    
    try {
      const job = await processRecording(result.audioBlob);
      showNotification('Audio processed successfully! View in Segment Workspace.', 'success');
      
      // Optionally navigate to segment workspace
      // setCurrentPage('segment');
    } catch (error) {
      console.error('[LiveTranscription] Failed to process instructions:', error);
      showNotification('Failed to process instructions', 'error');
    } finally {
      setIsProcessingInstructions(false);
    }
  };

  const handleDownloadTranscript = () => {
    if (!completedTranscription) return;
    
    const blob = new Blob([completedTranscription.text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `live_transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleStartNew = () => {
    setCompletedTranscription(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Live Transcription
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Record audio and see real-time transcription as you speak
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Real-time</h3>
          <p className="text-xs text-gray-600">
            See transcription appear as you speak
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Accurate</h3>
          <p className="text-xs text-gray-600">
            Powered by OpenAI Whisper AI
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
            <Download className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Export</h3>
          <p className="text-xs text-gray-600">
            Download transcript when done
          </p>
        </div>
      </div>

      {/* Main Recording Area */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <LiveTranscriptionRecorder onComplete={handleRecordingComplete} />
      </div>

      {/* Completed Transcription */}
      {completedTranscription && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Completed Transcription
            </h2>
            
            <div className="flex gap-2">
              <button
                onClick={handleDownloadTranscript}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              
              <button
                onClick={handleStartNew}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
              >
                New Recording
              </button>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
            <span>
              <strong>Words:</strong> {completedTranscription.text.split(' ').length}
            </span>
            <span>
              <strong>Characters:</strong> {completedTranscription.text.length}
            </span>
            <span>
              <strong>Chunks:</strong> {completedTranscription.chunks}
            </span>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {completedTranscription.text}
            </p>
          </div>

          {isProcessingInstructions && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Processing instructions and generating audio chunks...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Technical Info */}
      <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          How it works
        </h3>
        <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
          <li>Audio is captured from your microphone in real-time</li>
          <li>Every 3 seconds, audio chunk is sent to OpenAI Whisper for transcription</li>
          <li>Transcription appears immediately as it's processed</li>
          <li>Small overlap between chunks ensures no words are missed</li>
          <li>Final transcript is assembled from all chunks</li>
          <li>WebSocket connection ensures low-latency communication</li>
        </ul>
      </div>
    </div>
  );
};

export default LiveTranscriptionPage;
