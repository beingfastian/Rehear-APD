import React, { useState, useRef, useEffect } from 'react';

const imgVuesaxOutlineSearchNormal = "https://www.figma.com/api/mcp/asset/a9c45c4f-19a5-4fd3-a2cc-57c1fcf3493e";
const imgVuesaxBoldNotification    = "https://www.figma.com/api/mcp/asset/584eeac1-a0a8-4c2b-aceb-5a9bc82244bb";
const imgStroke                    = "https://www.figma.com/api/mcp/asset/19361cc3-e9d7-423e-a32a-2c241a226777";
const imgVector                    = "https://www.figma.com/api/mcp/asset/fe7d9131-43d7-48f4-9f0c-747c08df77e4";
const imgMenu                      = "https://www.figma.com/api/mcp/asset/54390e0d-5e39-4247-9c24-652c97d3bd87";

function getStoredUser() {
  try {
    const raw = localStorage.getItem('rehear_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const Header = ({ onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  const handleLogout = () => {
    localStorage.removeItem('rehear_token');
    localStorage.removeItem('rehear_user');
    if (onLogout) onLogout();
  };

  return (
    <div
      className="bg-white flex items-center justify-between w-full"
      style={{ padding: '10px 28px', boxShadow: '0px 2px 8px rgba(0,0,0,0.04)', fontFamily: 'Urbanist, sans-serif', flexShrink: 0 }}
    >
      {/* Left: logo + hamburger */}
      <div className="flex items-center" style={{ gap: '14px' }}>
        <img
          src="/rehear-logo.png"
          alt="Rehear APD"
          style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <img src={imgMenu} alt="menu" style={{ height: '22px', width: '22px', objectFit: 'contain', opacity: 0.6 }} />
      </div>

      {/* Center: search */}
      <div style={{ flex: 1, maxWidth: '520px', margin: '0 24px' }}>
        <div
          className="bg-white flex items-center"
          style={{ gap: '8px', border: '1px solid #c1c1c8', borderRadius: '10px', padding: '9px 14px' }}
        >
          <img src={imgVuesaxOutlineSearchNormal} alt="search" style={{ width: '18px', height: '18px', flexShrink: 0, opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Search lectures or modules..."
            className="flex-1 outline-none bg-transparent"
            style={{ fontFamily: 'Urbanist, sans-serif', fontSize: '13px', color: '#6a7380', fontWeight: 400 }}
          />
        </div>
      </div>

      {/* Right: notification + user */}
      <div className="flex items-center" style={{ gap: '18px' }}>
        {/* Notification bell */}
        <div style={{ position: 'relative' }}>
          <div className="flex items-center justify-center" style={{ backgroundColor: '#f3f1fd', borderRadius: '50%', width: '38px', height: '38px' }}>
            <img src={imgVuesaxBoldNotification} alt="notifications" style={{ width: '18px', height: '18px' }} />
          </div>
          <div
            className="absolute flex items-center justify-center"
            style={{ top: 0, right: 0, backgroundColor: '#fb4248', borderRadius: '50%', width: '14px', height: '14px', transform: 'translate(20%, -20%)' }}
          >
            <span className="font-bold text-white" style={{ fontSize: '8px' }}>4</span>
          </div>
        </div>

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
            <img src={imgVector} alt="dropdown" style={{ width: '18px', height: '18px', objectFit: 'contain', opacity: 0.6 }} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
