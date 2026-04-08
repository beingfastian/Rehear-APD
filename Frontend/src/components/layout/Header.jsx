// Frontend/src/components/layout/Header.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, LogOut } from 'lucide-react';

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
  const displayName = user?.name || 'User';
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rehear_token');
    localStorage.removeItem('rehear_user');
    if (onLogout) onLogout();
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">

      {/* Search — hidden on mobile */}
      <div className="hidden md:flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search recordings or jobs..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Mobile: logo */}
      <div className="md:hidden flex-1">
        <span className="text-lg font-bold text-blue-600">APD Tool</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile search icon */}
        <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
          <Search className="w-5 h-5 text-gray-600" />
        </button>

        {/* User profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
              {initials}
            </div>
            <span className="font-medium text-gray-700 hidden lg:block">{displayName.split(' ')[0]}</span>
            <ChevronDown className="w-4 h-4 text-gray-500 hidden lg:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
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