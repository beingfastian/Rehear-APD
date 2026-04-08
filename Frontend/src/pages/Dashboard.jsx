// Frontend/src/pages/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import { FileText, Upload, X, Loader2, CheckCircle, XCircle, Mic } from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import FileUpload from '../components/shared/FileUpload';

// ── Name Recording Modal ──────────────────────────────────────────────────────
const NameRecordingModal = ({ onConfirm, onClose }) => {
  const [name, setName] = useState('');

  const handleStart = () => {
    if (!name.trim()) return;
    onConfirm(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 animate-modal-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Name Your Recording</h2>
        <p className="text-sm text-slate-500 mb-6">Choose a name to keep your recordings organized.</p>

        <label className="block text-sm font-semibold text-slate-700 mb-2">Recording Name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          placeholder="Enter recording name..."
          className="w-full px-4 py-3 border border-sky-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all mb-5"
        />

        <button
          onClick={handleStart}
          disabled={!name.trim()}
          className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-sky-700 text-white rounded-2xl font-semibold text-sm
                     hover:from-sky-600 hover:to-sky-700 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all shadow-md shadow-sky-200"
        >
          Start Recording
        </button>
      </div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = ({ setCurrentPage }) => {
  const { jobs, isLoadingJobs } = useApp();
  const [showNameModal, setShowNameModal] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');

  const recentActivity = jobs.slice(0, 10);

  useEffect(() => {
    apiService.checkHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  const handleStartRecording = (recordingName) => {
    setShowNameModal(false);
    setCurrentPage('live-recording', { recordingName });
  };

  const handleUploadSuccess = () => setCurrentPage('segment');

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Page title row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
          backendStatus === 'online'   ? 'bg-green-50 text-green-600 border border-green-100'
          : backendStatus === 'offline' ? 'bg-red-50 text-red-600 border border-red-100'
          : 'bg-sky-50 text-slate-500 border border-sky-100'
        }`}>
          {backendStatus === 'online'   && <><CheckCircle className="w-3 h-3" /> API Online</>}
          {backendStatus === 'offline'  && <><XCircle className="w-3 h-3" /> API Offline</>}
          {backendStatus === 'checking' && <><Loader2 className="w-3 h-3 animate-spin" /> Checking...</>}
        </div>
      </div>

      {/* ── Card row ── */}
      {/* Live Listen — full width */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-8 mb-4 text-center">
        <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
          {/* Concentric circle mic icon */}
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-sky-100 absolute" />
            <div className="w-8 h-8 rounded-full border-2 border-gray-300 absolute" />
            <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center">
              <Mic className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1.5">Live Listen</h2>
        <p className="text-sm text-slate-500 mb-5">Capture audio directly from your browser or mic.</p>
        <button
          onClick={() => setShowNameModal(true)}
          className="px-8 py-3 bg-gradient-to-r from-sky-500 to-sky-700 text-white rounded-2xl font-semibold text-sm
                     hover:from-sky-600 hover:to-sky-700 transition-all shadow-md shadow-sky-200"
        >
          Start Recording
        </button>
      </div>

      {/* Two cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Instructional Chunks */}
        <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-8 text-center">
          <div className="w-11 h-11 mx-auto mb-4 bg-sky-50 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-slate-500" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Instructional Chunks</h3>
          <p className="text-sm text-slate-500 mb-5">
            View logical steps and segments generated via AI-driven sentence arrays.
          </p>
          <button
            onClick={() => setCurrentPage('media')}
            className="px-6 py-2.5 border border-sky-200 rounded-2xl text-sm font-medium text-slate-700 hover:bg-sky-50 transition-colors"
          >
            View Chunks
          </button>
        </div>

        {/* Upload Audio */}
        <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-8 text-center">
          <div className="w-11 h-11 mx-auto mb-4 bg-sky-50 rounded-full flex items-center justify-center">
            <Upload className="w-5 h-5 text-slate-500" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Upload Audio</h3>
          <p className="text-sm text-slate-500 mb-5">
            Support for MP3, WAV, and MP4 files up to 500MB.
          </p>
          <FileUpload onSuccess={handleUploadSuccess} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm">
        <div className="px-6 py-4 border-b border-sky-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            Recent activity
            {isLoadingJobs && <Loader2 className="inline w-4 h-4 animate-spin ml-2 text-slate-400" />}
          </h3>
        </div>

        {isLoadingJobs ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading from database…</p>
          </div>
        ) : recentActivity.length > 0 ? (
          <RecentActivityTable data={recentActivity} setCurrentPage={setCurrentPage} />
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400 mb-4">No recordings yet. Upload your first audio file!</p>
            <FileUpload onSuccess={handleUploadSuccess} />
          </div>
        )}
      </div>

      {/* Modal */}
      {showNameModal && (
        <NameRecordingModal
          onConfirm={handleStartRecording}
          onClose={() => setShowNameModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;