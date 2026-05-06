import React, { useState } from 'react';

const imgVuesaxBoldCategory   = "https://www.figma.com/api/mcp/asset/6c2d9bed-6c1f-44e9-8102-b499add80345";
const imgFrame                = "https://www.figma.com/api/mcp/asset/96adb722-bfda-4946-bdab-ddad5fc93140";
const imgFrame1               = "https://www.figma.com/api/mcp/asset/4cce977c-f24a-4f9d-b690-59cd14a90960";
const imgVuesaxOutlineSetting2= "https://www.figma.com/api/mcp/asset/3910f83f-1670-4938-8db7-fb5a745cd82c";
const imgVuesaxOutlineLampOn  = "https://www.figma.com/api/mcp/asset/af41f78a-f8b6-46df-8672-32a4a6a2edf1";
const imgFrame2               = "https://www.figma.com/api/mcp/asset/b5acdbff-b3fc-4ac3-aae5-946c3423ce17";
const imgLayer1               = "https://www.figma.com/api/mcp/asset/cc77b816-3b47-4167-ba11-009824f6fa2d";

const menuItems = [
  { id: 'dashboard', icon: imgVuesaxBoldCategory,    label: 'Learning Hub' },
  { id: 'media',     icon: imgFrame,                  label: 'Resource Library' },
  { id: 'segment',   icon: imgFrame1,                 label: 'Module Editor' },
  { id: 'settings',  icon: imgVuesaxOutlineSetting2,  label: 'Settings' },
  { id: 'help',      icon: imgVuesaxOutlineLampOn,     label: 'Help Center' },
];

const Sidebar = ({ currentPage, setCurrentPage, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (page) => {
    setCurrentPage(page);
    setMobileOpen(false);
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
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-white h-screen flex flex-col transform transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: '220px', fontFamily: 'Urbanist, sans-serif', flexShrink: 0, borderRight: '1px solid #f0f0f4' }}
      >
        {/* Nav */}
        <div className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
          <nav className="flex flex-col" style={{ gap: '4px', paddingLeft: '16px', paddingRight: '16px', paddingTop: '12px' }}>
            {menuItems.map((item) => {
              const active = currentPage === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className="relative flex items-center cursor-pointer transition-colors"
                  style={{
                    gap: '10px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    backgroundColor: active ? '#f3f1fd' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(243,241,253,0.5)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {active && (
                    <span style={{
                      position: 'absolute',
                      left: '-16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px',
                      height: '24px',
                      backgroundColor: '#1674cc',
                      borderRadius: '0 3px 3px 0',
                    }} />
                  )}
                  <img src={item.icon} alt="" style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                  <span className="font-semibold" style={{ fontSize: '14px', lineHeight: 1.3, color: active ? '#1674cc' : '#6a7380' }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Log out */}
        <div style={{ padding: '0 16px 24px' }}>
          <button
            onClick={onLogout}
            className="flex items-center w-full transition-colors"
            style={{ gap: '10px', padding: '9px 10px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff0f0'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img src={imgFrame2} alt="" style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span className="font-semibold" style={{ fontSize: '14px', lineHeight: 1.3, color: '#6a7380' }}>Log out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
