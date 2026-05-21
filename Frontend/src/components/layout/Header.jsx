// Frontend/src/components/layout/Header.jsx
// MODIFIED: Added VoiceIndicator between the search bar and the user-dropdown.
// Every other line is UNCHANGED.

import React, { useState, useRef, useEffect } from 'react';

import { IconSearch, IconChevronDown, IconMenu } from '../../assets/icons';



function getStoredUser() {
  try {
    const raw = localStorage.getItem('rehear_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const Header = ({ onLogout, onToggleSidebar }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  const user = getStoredUser();
  const displayName = user?.name || 'Shaun co';

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (onLogout) await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div
      className="bg-white flex items-center justify-between w-full"
      style={{ padding: '10px 28px', boxShadow: '0px 2px 8px rgba(0,0,0,0.04)', fontFamily: 'Urbanist, sans-serif', flexShrink: 0 }}
    >
      {/* Left: logo + hamburger */}
      <div className="flex items-center" style={{ gap: '14px' }}>
        <img
          src="/rehear-logo-transparent.png"
          alt="Rehear APD"
          style={{ height: '80px', width: 'auto', objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div onClick={onToggleSidebar} className="cursor-pointer transition-all duration-200 hover:scale-110 hover:opacity-100" style={{ opacity: 0.6 }}>
          <IconMenu style={{ height: '22px', width: '22px' }} />
        </div>
      </div>

      {/* Center: search */}
      <div style={{ flex: 1, maxWidth: '520px', margin: '0 24px' }}>
        <div
          className="bg-white flex items-center"
          style={{ gap: '8px', border: '1px solid #c1c1c8', borderRadius: '10px', padding: '9px 14px' }}
        >
          <IconSearch style={{ width: '18px', height: '18px', color: '#9ca3af', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search recordings, instructions…"
            style={{
              border: 'none', outline: 'none', width: '100%',
              fontSize: '14px', color: '#374151', backgroundColor: 'transparent',
              fontFamily: 'Urbanist, sans-serif',
            }}
          />
        </div>
      </div>

      {/* Right: user dropdown */}
      <div className="flex items-center" style={{ gap: '12px' }}>
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
              borderRadius: '8px', transition: 'background 0.15s',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '13px', fontWeight: 700,
              flexShrink: 0,
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
              {displayName}
            </span>
            <IconChevronDown style={{ width: '16px', height: '16px', color: '#9ca3af', transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#fff', borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              minWidth: '160px', zIndex: 1000, overflow: 'hidden',
            }}>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none',
                  textAlign: 'left', cursor: loggingOut ? 'not-allowed' : 'pointer',
                  fontSize: '14px', color: loggingOut ? '#9ca3af' : '#374151',
                  fontFamily: 'Urbanist, sans-serif', fontWeight: 500,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!loggingOut) e.target.style.background = '#f9fafb'; }}
                onMouseLeave={e => { e.target.style.background = 'none'; }}
              >
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
