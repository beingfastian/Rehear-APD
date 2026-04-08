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
import AuthPage from './pages/AuthPage';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';

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
  const { notification, showNotification } = useApp();

  const navigateTo = (page, data = {}) => {
    setCurrentPage(page);
    setPageData(data);
  };

  // Handle sidebar logout
  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <div className="flex h-screen bg-sky-50 overflow-hidden">
      <Sidebar currentPage={currentPage} setCurrentPage={navigateTo} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onLogout={handleLogout} />

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
            src="/APD LOGO.png"
            alt="APD Rehear"
            className="h-20 w-auto object-contain mx-auto mb-4"
            onError={e => { e.target.style.display = 'none'; }}
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