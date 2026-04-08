// Frontend/src/components/layout/Header.jsx

import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const Header = () => {
  const { authUser } = useApp();
  const user = authUser;
  const displayName = user?.name || 'Guest';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4F46E5&color=fff&size=64`;

  return (
    <div className="bg-white border-b border-sky-100 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 h-14">

      {/* Left spacer / mobile logo */}
      <div className="w-10 lg:hidden" />

      {/* Search bar — centered, hidden on small mobile */}
      <div className="flex-1 max-w-xl mx-4 hidden sm:block">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search recordings or jobs..."
            className="w-full pl-10 pr-4 py-2 bg-sky-50 border border-sky-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Mobile: just search icon */}
      <div className="sm:hidden flex-1" />

      {/* Right: notification + user */}
      <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
        {/* Mobile search */}
        <button className="sm:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <Search className="w-5 h-5" />
        </button>

        {/* Bell */}
        <div className="relative">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white" />
        </div>

        {/* User */}
        <button className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 rounded-xl transition-colors">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-7 h-7 rounded-full"
            />
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full ring-1 ring-white" />
          </div>
          <span className="text-sm font-semibold text-gray-700">{displayName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Mobile avatar */}
        <div className="sm:hidden relative">
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full cursor-pointer"
          />
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full ring-1 ring-white" />
        </div>
      </div>
    </div>
  );
};

export default Header;