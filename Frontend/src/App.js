// Frontend/src/App.js - UPDATED WITH LIVE TRANSCRIPTION

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import MediaVault from './pages/MediaVault';
import SegmentWorkspace from './pages/SegmentWorkspace';
import LiveTranscriptionPage from './pages/LiveTranscriptionPage'; // NEW IMPORT
import Notification from './components/shared/Notification';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { notification, showNotification } = useApp();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        
        <div className="flex-1 overflow-auto">
          {currentPage === 'dashboard' && (
            <Dashboard setCurrentPage={setCurrentPage} />
          )}
          
          {currentPage === 'media' && (
            <MediaVault setCurrentPage={setCurrentPage} />
          )}
          
          {currentPage === 'segment' && (
            <SegmentWorkspace />
          )}
          
          {/* NEW: Live Transcription Page */}
          {currentPage === 'live-transcription' && (
            <LiveTranscriptionPage setCurrentPage={setCurrentPage} />
          )}
        </div>
      </div>

      {/* Global Notification Toast */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => showNotification(null)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;