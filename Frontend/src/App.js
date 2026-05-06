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
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import VerifyResetCodePage from './pages/VerifyResetCodePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthPage from './pages/AuthPage';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';

const AUTH_PAGES = ['login', 'signup', 'forgot-password', 'verify-reset-code', 'reset-password'];

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getStoredToken() {
  return localStorage.getItem('rehear_token');
}

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

  const handleLogout = () => {
    logout();
    navigateTo('login');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-sm border border-sky-100 px-10 py-12 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-4">
            <img src="/rehear-logo.png" alt="Rehear APD" className="h-8 w-auto object-contain" onError={e => { e.target.src = '/rehear-logo.png'; }} />
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
          <Header />

          <div className="flex flex-1 overflow-hidden">
          <Sidebar currentPage={currentPage} setCurrentPage={navigateTo} onLogout={handleLogout} />

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

// ── Root App with auth gate ───────────────────────────────────────────────────
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Check for token in URL (e.g. after OAuth redirect)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      // Validate the URL token against the backend
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${urlToken}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            localStorage.setItem('rehear_token', urlToken);
            localStorage.setItem('rehear_user', JSON.stringify(data.user));
            window.history.replaceState({}, '', window.location.pathname);
            setIsAuthenticated(true);
          }
        })
        .catch(() => {})
        .finally(() => setIsVerifying(false));
      return;
    }

    // Check stored token
    const token = getStoredToken();
    const user  = getStoredUser();

    if (!token || !user) {
      setIsVerifying(false);
      return;
    }

    // Verify token is still valid with the backend
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.ok) {
          setIsAuthenticated(true);
        } else {
          // Token expired or invalid — clear storage
          logout();
        }
      })
      .catch(() => {
        // Backend unreachable — trust local storage to allow offline dev use
        if (token && user) setIsAuthenticated(true);
      })
      .finally(() => setIsVerifying(false));
  }, []);

  const handleAuthenticated = () => setIsAuthenticated(true);
  const handleLogout = () => setIsAuthenticated(false);

  // Loading splash while verifying token
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="text-center">
          <img
            src="/rehear-logo.png"
            alt="Rehear APD"
            className="h-20 w-auto object-contain mx-auto mb-4"
            onError={e => { e.target.src = '/rehear-logo.png'; }}
          />
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AppProvider>
      <AppContent onLogout={handleLogout} />
    </AppProvider>
  );
}

export default App;