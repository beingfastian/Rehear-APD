import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import FileUpload from '../components/shared/FileUpload';

import { IconSparkles, IconBook, IconUpload } from '../assets/icons';

/* ── Name Recording Modal ─────────────────────────────────────────────────── */
const NameRecordingModal = ({ onConfirm, onClose }) => {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white w-full max-w-lg mx-4 p-8 animate-modal-in"
        style={{ borderRadius: '24px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
      >
        {/* Close — top-right, outside content flow */}
        <button
          onClick={onClose}
          className="absolute text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded-lg transition-colors"
          style={{ top: '16px', right: '16px', padding: '6px' }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header — centered, no border */}
        <div className="text-center mb-6 px-4 pt-2">
          <h2
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: 'Urbanist, Inter, sans-serif', color: '#1a1a2e' }}
          >
            Session Identification
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ fontFamily: 'Urbanist, Inter, sans-serif', color: '#6a7380' }}
          >
            Assign a name to your lesson or training session for automated organization.
          </p>
        </div>

        {/* Label */}
        <label
          className="block text-sm font-bold mb-2"
          style={{ fontFamily: 'Urbanist, Inter, sans-serif', color: '#343434' }}
        >
          Lesson Name
        </label>

        {/* Pill input */}
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          placeholder="Enter lesson name..."
          className="w-full px-5 py-3.5 text-sm outline-none transition-all mb-5"
          style={{
            border: '1px solid #c1c1c8',
            borderRadius: '999px',
            fontFamily: 'Urbanist, Inter, sans-serif',
            color: '#343434',
          }}
        />

        {/* Gradient pill button */}
        <button
          onClick={() => name.trim() && onConfirm(name.trim())}
          disabled={!name.trim()}
          className="w-full py-3.5 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Urbanist, Inter, sans-serif',
            borderRadius: '999px',
            background: 'linear-gradient(104deg, #57a0ef 1.33%, #98d3ff 127.72%)',
            border: 'none',
            fontSize: '15px',
          }}
        >
          Initialize Assistant
        </button>
      </div>
    </div>
  );
};
/* ── Dashboard ────────────────────────────────────────────────────────────── */
const Dashboard = ({ setCurrentPage }) => {
  const { jobs, isLoadingJobs } = useApp();
  const [showNameModal, setShowNameModal] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');

  const recentActivity = jobs.slice(0, 50);

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
    <div className="min-h-full" style={{ padding: '40px', backgroundColor: '#f6f6f9', fontFamily: 'Urbanist, sans-serif' }}>

      {/* Page title */}
      <div className="flex items-center justify-center relative" style={{ marginBottom: '43px' }}>
        <h1 className="font-bold whitespace-nowrap" style={{ fontSize: '34px', color: '#343434', lineHeight: 1.3 }}>
          Learning Hub Overview
        </h1>
        <div
          className="flex items-center gap-2 font-semibold absolute right-0"
          style={{
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            backgroundColor: backendStatus === 'online' ? '#f1fdfb' : backendStatus === 'offline' ? '#fff0f0' : '#f6f6f9',
            color:           backendStatus === 'online' ? '#129578' : backendStatus === 'offline' ? '#fb4248' : '#6a7380',
            border: `1px solid ${backendStatus === 'online' ? '#129578' : backendStatus === 'offline' ? '#fb4248' : '#c1c1c8'}`,
          }}
        >
          {backendStatus === 'online'   && <><CheckCircle style={{ width: 12, height: 12 }} /> API Online</>}
          {backendStatus === 'offline'  && <><XCircle    style={{ width: 12, height: 12 }} /> API Offline</>}
          {backendStatus === 'checking' && <><Loader2    style={{ width: 12, height: 12 }} className="animate-spin" /> Checking...</>}
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: '24px' }}>

        {/* Smart Lesson Capture — full width */}
        <div className="flex flex-col items-center" style={{ backgroundColor: 'white', borderRadius: '24px', padding: '24px 32px', gap: '16px', overflow: 'hidden' }}>
          <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconSparkles style={{ width: '100%', height: '100%', color: '#1674cc' }} />
          </div>
          <p className="font-bold whitespace-nowrap" style={{ fontSize: '24px', color: '#343434', lineHeight: 1.3 }}>Smart Lesson Capture</p>
          <p className="text-center" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: '#6a7380', maxWidth: '600px', lineHeight: 'normal' }}>
            AI-driven listening: Automatically identifies instructional steps and sequences in real-time.
          </p>
          <button
            onClick={() => setShowNameModal(true)}
            className="flex items-center justify-center font-semibold text-white"
            style={{
              height: '56px', width: '283px', borderRadius: '48px', fontSize: '16px',
              fontFamily: 'Urbanist, sans-serif',
              border: '1px solid #f6ee08',
              background: 'linear-gradient(104deg, #57a0ef 1.33%, #98d3ff 127.72%)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Begin Session
          </button>
        </div>

        {/* Two side-by-side cards */}
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '32px', padding: '0 10px' }}>

          {/* Instructions */}
          <div className="flex flex-col items-center" style={{ backgroundColor: 'white', borderRadius: '24px', padding: '24px 32px', gap: '16px', overflow: 'hidden' }}>
            <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBook style={{ width: '100%', height: '100%', color: '#1674cc' }} />
            </div>
            <p className="font-bold whitespace-nowrap" style={{ fontSize: '24px', color: '#343434', lineHeight: 1.3 }}>Instructional Chunks</p>
            <p className="text-center" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: '#6a7380', lineHeight: 'normal' }}>
              View logical steps and segments generated via AI-driven sentence arrays.
            </p>
            <button
              onClick={() => setCurrentPage('media')}
              className="flex items-center justify-center font-semibold"
              style={{
                height: '56px', width: '230px', borderRadius: '48px', fontSize: '16px',
                fontFamily: 'Urbanist, sans-serif', color: '#242424',
                border: '1px solid #1674cc', backgroundColor: 'transparent', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f1fd'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              View Chunks →
            </button>
          </div>

          {/* Upload Audio */}
          <div className="flex flex-col items-center" style={{ backgroundColor: 'white', borderRadius: '24px', padding: '24px 32px', gap: '16px', overflow: 'hidden' }}>
            <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconUpload style={{ width: '100%', height: '100%', color: '#1674cc' }} />
            </div>
            <p className="font-bold whitespace-nowrap" style={{ fontSize: '24px', color: '#343434', lineHeight: 1.3 }}>Upload Audio</p>
            <p className="text-center" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: '#6a7380', lineHeight: 'normal' }}>
              Support for MP3, WAV, and MP4 files up to 500MB.
            </p>
            <FileUpload
              onSuccess={handleUploadSuccess}
              customButton={
                <button
                  className="flex items-center justify-center font-semibold"
                  style={{
                    height: '56px', width: '230px', borderRadius: '48px', fontSize: '16px',
                    fontFamily: 'Urbanist, sans-serif', color: '#242424',
                    border: '1px solid #1674cc', backgroundColor: 'transparent', cursor: 'pointer',
                  }}
                >
                  Upload Files +
                </button>
              }
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ backgroundColor: 'white', border: '1px solid #c1c1c8', borderRadius: '20px', overflow: 'hidden' }}>
          {isLoadingJobs ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#1674cc' }} />
              <p style={{ fontSize: '14px', color: '#6a7380' }}>Loading from database…</p>
            </div>
          ) : recentActivity.length > 0 ? (
            <RecentActivityTable data={recentActivity} setCurrentPage={setCurrentPage} />
          ) : (
            <div className="text-center" style={{ padding: '48px 24px' }}>
              <p className="font-bold mb-2" style={{ fontSize: '24px', color: '#222132' }}>Recent activity</p>
              <p className="mb-6" style={{ fontSize: '14px', color: '#6a7380' }}>No recordings yet. Upload your first audio file!</p>
              <FileUpload onSuccess={handleUploadSuccess} />
            </div>
          )}
        </div>
      </div>

      {showNameModal && (
        <NameRecordingModal onConfirm={handleStartRecording} onClose={() => setShowNameModal(false)} />
      )}
    </div>
  );
};

export default Dashboard;
