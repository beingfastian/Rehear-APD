import React, { useState } from 'react';

import { IconCategory, IconFolder, IconEdit, IconSettings, IconHelp, IconLogout } from '../../assets/icons';

const menuItems = [
  { id: 'dashboard', icon: IconCategory,    label: 'Learning Hub' },
  { id: 'media',     icon: IconFolder,      label: 'Resource Library' },
  { id: 'segment',   icon: IconEdit,        label: 'Module Editor' },
  { id: 'settings',  icon: IconSettings,    label: 'Settings' },
  { id: 'help',      icon: IconHelp,        label: 'Help Center' },
];

const Sidebar = ({ currentPage, setCurrentPage, onLogout, isCollapsed }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const effectivelyCollapsed = isCollapsed && !isHovered;

  const navigate = (page) => {
    setCurrentPage(page);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (onLogout) await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 12H21M3 6H21M3 18H21" stroke="#343434" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setMobileOpen(false)} />
      )}

      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-white h-full flex flex-col transform transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: effectivelyCollapsed ? '80px' : '220px', fontFamily: 'Urbanist, sans-serif', flexShrink: 0, borderRight: '1px solid #f0f0f4' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Nav */}
        <div className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
          <nav className="flex flex-col" style={{ gap: '4px', paddingLeft: effectivelyCollapsed ? '8px' : '16px', paddingRight: effectivelyCollapsed ? '8px' : '16px', paddingTop: '12px' }}>
            {menuItems.map((item) => {
              const active = currentPage === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className="relative flex items-center cursor-pointer transition-all duration-300"
                  style={{
                    gap: effectivelyCollapsed ? '0px' : '10px',
                    padding: effectivelyCollapsed ? '9px 0px' : '9px 10px',
                    borderRadius: '8px',
                    backgroundColor: active ? '#f3f1fd' : 'transparent',
                    justifyContent: effectivelyCollapsed ? 'center' : 'flex-start',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(243,241,253,0.5)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {active && (
                    <span style={{
                      position: 'absolute',
                      left: effectivelyCollapsed ? '0px' : '-16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px',
                      height: '24px',
                      backgroundColor: '#1674cc',
                      borderRadius: '0 3px 3px 0',
                      transition: 'all 0.3s ease',
                    }} />
                  )}
                  <item.icon style={{ width: '20px', height: '20px', flexShrink: 0, color: active ? '#1674cc' : '#6a7380' }} />
                  <span 
                    className="font-semibold whitespace-nowrap overflow-hidden transition-all duration-300" 
                    style={{ 
                      fontSize: '14px', 
                      lineHeight: 1.3, 
                      color: active ? '#1674cc' : '#6a7380',
                      maxWidth: effectivelyCollapsed ? '0px' : '120px',
                      opacity: effectivelyCollapsed ? 0 : 1,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Log out */}
        <div style={{ padding: effectivelyCollapsed ? '0 8px 24px' : '0 16px 24px' }}>
          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center w-full transition-all duration-300"
            style={{
              gap: effectivelyCollapsed ? '0px' : '10px',
              padding: effectivelyCollapsed ? '9px 0px' : '9px 10px',
              borderRadius: '8px',
              background: 'none',
              border: 'none',
              cursor: loggingOut ? 'not-allowed' : 'pointer',
              opacity: loggingOut ? 0.6 : 1,
              justifyContent: effectivelyCollapsed ? 'center' : 'flex-start',
            }}
            onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.backgroundColor = '#fff0f0'; }}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {loggingOut ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <circle cx="12" cy="12" r="9" stroke="#6a7380" strokeWidth="2" strokeDasharray="42" strokeDashoffset="14" strokeLinecap="round" />
              </svg>
            ) : (
              <IconLogout style={{ width: '18px', height: '18px', flexShrink: 0, color: '#6a7380' }} />
            )}
            <span 
              className="font-semibold whitespace-nowrap overflow-hidden transition-all duration-300" 
              style={{ 
                fontSize: '14px', 
                lineHeight: 1.3, 
                color: '#6a7380',
                maxWidth: effectivelyCollapsed ? '0px' : '120px',
                opacity: effectivelyCollapsed ? 0 : 1,
              }}
            >
              {loggingOut ? 'Logging out…' : 'Log out'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

