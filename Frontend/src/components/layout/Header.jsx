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
          <IconSearch style={{ width: '18px', height: '18px', flexShrink: 0, opacity: 0.5, color: '#6a7380' }} />
          <input
            type="text"
            placeholder="Search lectures or modules..."
            className="flex-1 outline-none bg-transparent"
            style={{ fontFamily: 'Urbanist, sans-serif', fontSize: '13px', color: '#6a7380', fontWeight: 400 }}
          />
        </div>
      </div>

      {/* Right: user only (bell removed) */}
      <div className="flex items-center" style={{ gap: '18px' }}>
        {/* User */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center cursor-pointer"
            style={{ gap: '8px', background: 'none', border: 'none' }}
          >
            <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
              <div
                className="w-full h-full rounded-full flex items-center justify-center text-white font-bold select-none"
                style={{ backgroundColor: '#1674cc', fontSize: '14px' }}
              >
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <div
                className="absolute"
                style={{ bottom: 1, right: 1, backgroundColor: '#129578', borderRadius: '50%', width: '10px', height: '10px', border: '1.5px solid white' }}
              />
            </div>
            <span className="font-semibold whitespace-nowrap" style={{ fontSize: '14px', color: '#343434', lineHeight: 1.3 }}>
              {displayName}
            </span>
            <IconChevronDown style={{ width: '18px', height: '18px', opacity: 0.6, color: '#343434' }} />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 z-50"
              style={{
                width: '220px',
                padding: '0',
                overflow: 'hidden',
                animation: 'dropdownFadeIn 0.15s ease-out',
              }}
            >
              <style>{`
                @keyframes dropdownFadeIn {
                  from { opacity: 0; transform: translateY(-6px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              {/* User info section */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f4' }}>
                <div className="flex items-center" style={{ gap: '10px' }}>
                  <div
                    className="rounded-full flex items-center justify-center text-white font-bold select-none"
                    style={{ width: '36px', height: '36px', backgroundColor: '#1674cc', fontSize: '13px', flexShrink: 0 }}
                  >
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="font-semibold truncate" style={{ fontSize: '13px', color: '#343434', margin: 0 }}>{displayName}</p>
                    <p className="truncate" style={{ fontSize: '11px', color: '#8f95a0', margin: '2px 0 0' }}>{user?.email || ''}</p>
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <div style={{ padding: '6px 8px' }}>
                <button
                  id="header-logout-btn"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center w-full transition-colors"
                  style={{
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: loggingOut ? 'not-allowed' : 'pointer',
                    opacity: loggingOut ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Logout icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M8.9 7.56C9.21 3.96 11.06 2.49 15.11 2.49H15.24C19.71 2.49 21.5 4.28 21.5 8.75V15.27C21.5 19.74 19.71 21.53 15.24 21.53H15.11C11.09 21.53 9.24 20.08 8.91 16.54" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15 12H3.62" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5.85 8.65L2.5 12L5.85 15.35" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="font-semibold" style={{ fontSize: '13px', color: '#ef4444', lineHeight: 1.3 }}>
                    {loggingOut ? 'Logging out…' : 'Log out'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;

