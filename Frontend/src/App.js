// Frontend/src/App.js

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import MediaVault from './pages/MediaVault';
import SegmentWorkspace from './pages/SegmentWorkspace';
import LiveRecordingPage from './pages/LiveRecordingPage';
import Notification from './components/shared/Notification';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageData, setPageData] = useState({});
  const { notification, showNotification } = useApp();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            localStorage.setItem('rehear_token', token);
            localStorage.setItem('rehear_user', JSON.stringify(data.user));
            window.history.replaceState({}, '', window.location.pathname);
          }
        })
        .catch(() => {});
    }
  }, []);

  const navigateTo = (page, data = {}) => {
    setCurrentPage(page);
    setPageData(data);
  };

  return (
    <div className="flex h-screen bg-sky-50 overflow-hidden">
      <Sidebar currentPage={currentPage} setCurrentPage={navigateTo} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <div className="flex-1 overflow-auto">
          {currentPage === 'dashboard' && (
            <Dashboard setCurrentPage={navigateTo} />
          )}
          {currentPage === 'media' && (
            <MediaVault setCurrentPage={navigateTo} />
          )}
          {currentPage === 'segment' && (
            <SegmentWorkspace />
          )}
          {currentPage === 'live-recording' && (
            <LiveRecordingPage
              recordingName={pageData.recordingName || 'New Recording'}
              setCurrentPage={navigateTo}
            />
          )}
        </div>
      </div>

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