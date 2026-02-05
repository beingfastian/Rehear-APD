// Frontend/src/pages/LiveTranscriptionPage.jsx

import React from 'react';
// FIX: Correct import path (one level up to src/context)
import { useApp } from '../context/AppContext'; 
import LiveTranscriptionRecorder from '../components/shared/LiveTranscriptionRecorder';

const LiveTranscriptionPage = ({ setCurrentPage }) => {
  const { showNotification } = useApp();

  const handleRecordingComplete = (result) => {
    console.log('[LivePage] Recording processed:', result);
    
    // The result contains { instruction_count, transcription, etc. }
    const count = result.instruction_count || 0;
    
    showNotification(
      `Success! ${count} instruction${count !== 1 ? 's' : ''} extracted from your speech.`, 
      'success'
    );
    
    // Optional: Auto-redirect to the segment workspace to view the result
    // setCurrentPage('segment');
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Live Transcription
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Speak naturally. The AI will listen, filter out filler words, and generate concise instructional audio steps instantly.
        </p>
      </div>

      {/* The Recorder Component */}
      <LiveTranscriptionRecorder onComplete={handleRecordingComplete} />

      {/* Key Benefits Section */}
      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
          How it works
        </h3>
        <ul className="text-sm text-gray-600 space-y-3">
          <li className="flex items-start gap-3">
            <div className="bg-blue-100 p-1 rounded-full mt-0.5">
              <span className="text-blue-600 font-bold text-xs">1</span>
            </div>
            <span><strong>Live Preview:</strong> Your browser generates text instantly while you speak.</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="bg-blue-100 p-1 rounded-full mt-0.5">
              <span className="text-blue-600 font-bold text-xs">2</span>
            </div>
            <span><strong>Smart Filter:</strong> When you click Save, the text is sent to the AI.</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="bg-blue-100 p-1 rounded-full mt-0.5">
              <span className="text-blue-600 font-bold text-xs">3</span>
            </div>
            <span><strong>Logic Extraction:</strong> The AI discards filler words ("um", "uh") and keeps only the instructions.</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="bg-green-100 p-1 rounded-full mt-0.5">
              <span className="text-green-600 font-bold text-xs">4</span>
            </div>
            <span><strong>Instant Audio:</strong> High-quality TTS is generated for every instruction step.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default LiveTranscriptionPage;