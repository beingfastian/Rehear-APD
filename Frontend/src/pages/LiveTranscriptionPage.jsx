// Frontend/src/pages/LiveTranscriptionPage.jsx
// UPDATED: onSessionComplete → set currentJob in context → navigate to segment workspace

import React from 'react';
import { useApp } from '../context/AppContext';
import LiveTranscriptionRecorder from '../components/shared/LiveTranscriptionRecorder';

const LiveTranscriptionPage = ({ setCurrentPage }) => {
  const { showNotification, setCurrentJob } = useApp();

  // Called each time a single instruction is saved (existing behaviour)
  const handleRecordingComplete = (result) => {
    console.log('[LivePage] Instruction saved:', result.job_id);
  };

  // Called once after STOP + all saves finish — navigate to SegmentWorkspace
  const handleSessionComplete = (sessionJob) => {
    console.log('[LivePage] Session complete:', sessionJob);

    // Put the combined session job into global context so SegmentWorkspace can read it
    // We call the raw setter here (not selectJob) because the job is already fully formed
    // with instructions + audio URLs — no DB fetch needed
    setCurrentJob(sessionJob);

    showNotification(
      `${sessionJob.instructions.length} instruction${sessionJob.instructions.length !== 1 ? 's' : ''} ready — opening workspace`,
      'success'
    );

    // Small delay so the user sees the "DONE" banner before navigating
    setTimeout(() => setCurrentPage('segment'), 800);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Live Transcription
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Speak naturally. Instructions are extracted in real time, then automatically
          opened in the Segment Workspace for playback.
        </p>
      </div>

      <LiveTranscriptionRecorder
        onComplete={handleRecordingComplete}
        onSessionComplete={handleSessionComplete}
      />
    </div>
  );
};

export default LiveTranscriptionPage;