// Frontend/src/pages/LiveTranscriptionPage.jsx
// Live transcription with preview - actual processing happens on save

import React from 'react';
import { useApp } from '../context/AppContext';
import LiveTranscriptionRecorder from '../components/shared/LiveTranscriptionRecorder';
import { FileText, Zap, Database } from 'lucide-react';

const LiveTranscriptionPage = ({ setCurrentPage }) => {
  const { showNotification } = useApp();

  const handleRecordingComplete = async (result) => {
    console.log('[LiveTranscription] Recording processed:', result);
    
    // The recording has already been processed and saved to database
    // result contains: job_id, transcription, instructions, etc.
    
    showNotification(
      `Recording processed successfully! ${result.instruction_count} instructions created.`, 
      'success'
    );
    
    // Optionally navigate to segment workspace to view the results
    // setCurrentPage('segment');
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Live Transcription
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          See real-time transcription preview as you speak. When you save, the complete audio is processed.
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Live Preview</h3>
          <p className="text-xs text-gray-600">
            See transcription appear in real-time as you speak
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Full Processing</h3>
          <p className="text-xs text-gray-600">
            Complete transcription, instruction detection & TTS on save
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
            <Database className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1 text-sm">Auto-Save</h3>
          <p className="text-xs text-gray-600">
            Everything saved to database with S3 audio chunks
          </p>
        </div>
      </div>

      {/* Main Recording Area */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <LiveTranscriptionRecorder onComplete={handleRecordingComplete} />
      </div>

      {/* How It Works */}
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3 text-base flex items-center gap-2">
          <span className="text-2xl">💡</span>
          How This Works
        </h3>
        
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Live Transcription Preview</p>
              <p className="text-xs text-gray-600 mt-1">
                As you speak, audio is sent in 3-second chunks for quick transcription. This gives you a real-time preview of what's being captured.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Stop & Review</p>
              <p className="text-xs text-gray-600 mt-1">
                When you stop recording, you can review the live preview. This is just a preview - not the final transcription.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Save & Full Processing</p>
              <p className="text-xs text-gray-600 mt-1">
                Click "Save & Process" and the complete audio is re-transcribed for accuracy, instructions are detected with AI, TTS audio is generated for each step, and everything is saved to the database.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
              4
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Access Anywhere</p>
              <p className="text-xs text-gray-600 mt-1">
                Your processed recording appears in the Segment Workspace with all audio chunks ready to play or download.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">
          Why This Approach?
        </h3>
        <ul className="text-xs text-gray-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Instant Feedback:</strong> See transcription in real-time so you know your audio is being captured</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Better Accuracy:</strong> Full audio is re-transcribed on save for maximum accuracy</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Complete Processing:</strong> Instruction detection and TTS only happen on confirmed recordings</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Save Costs:</strong> Only pay for full processing when you're sure you want to keep the recording</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default LiveTranscriptionPage;