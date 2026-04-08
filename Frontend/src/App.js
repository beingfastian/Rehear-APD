// Frontend/src/App.js

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import HelpCenterPage from './pages/HelpCenterPage';
import MediaVault from './pages/MediaVault';
import SegmentWorkspace from './pages/SegmentWorkspace';
import SettingsPage from './pages/SettingsPage';
import SignupPage from './pages/SignupPage';
import LiveRecordingPage from './pages/LiveRecordingPage';
import Notification from './components/shared/Notification';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageData, setPageData] = useState({});
  const { isAuthenticated, isAuthReady, logout, notification, showNotification } = useApp();

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated && !['login', 'signup'].includes(currentPage)) {
      setCurrentPage('login');
      setPageData({});
    }

    if (isAuthenticated && ['login', 'signup'].includes(currentPage)) {
      setCurrentPage('dashboard');
      setPageData({});
    }
  }, [currentPage, isAuthReady, isAuthenticated]);

  const navigateTo = (page, data = {}) => {
    setCurrentPage(page);
    setPageData(data);
  };

  const handleLogout = () => {
    logout();
    navigateTo('login');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-sm border border-sky-100 px-10 py-12 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-4">
            <img src="/APD LOGO.png" alt="APD Tool" className="h-8 w-auto object-contain" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Restoring your session</h1>
          <p className="text-sm text-gray-500 mt-2">Checking your account state before loading the workspace.</p>
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

  const isAuthPage = !isAuthenticated || currentPage === 'login' || currentPage === 'signup';

  return (
    <>
      {isAuthPage ? (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(135deg,_#f8fbff_0%,_#eef6ff_45%,_#f9fbff_100%)]">
          {currentPage === 'signup' ? (
            <SignupPage setCurrentPage={navigateTo} />
          ) : (
            <LoginPage setCurrentPage={navigateTo} />
          )}
        </div>
      ) : (
        <div className="flex h-screen bg-sky-50 overflow-hidden">
          <Sidebar currentPage={currentPage} setCurrentPage={navigateTo} onLogout={handleLogout} />

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
              {currentPage === 'settings' && (
                <SettingsPage setCurrentPage={navigateTo} />
              )}
              {currentPage === 'help' && (
                <HelpCenterPage setCurrentPage={navigateTo} />
              )}
              {currentPage === 'live-recording' && (
                <LiveRecordingPage
                  recordingName={pageData.recordingName || 'New Recording'}
                  setCurrentPage={navigateTo}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => showNotification(null)}
        />
      )}
    </>
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