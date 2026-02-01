// Frontend/src/components/layout/Header.jsx

import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';

const Header = () => {
  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">

      {/* Search - Hidden on mobile, shown on tablet+ */}
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

      {/* Mobile: Just logo */}
      <div className="md:hidden flex-1">
        <span className="text-lg font-bold text-blue-600">APD Tool</span>
      </div>

      {/* Right icons */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search icon for mobile */}
        <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
          <Search className="w-5 h-5 text-gray-600" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Bell className="w-5 h-6 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>

        {/* User Profile */}
        <div className="hidden sm:flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1">
          <img
            src="https://ui-avatars.com/api/?name=Shaun+Ola&background=4F46E5&color=fff"
            alt="User"
            className="w-8 h-8 rounded-full"
          />
          <span className="font-medium text-gray-700 hidden lg:block">Shaun</span>
          <ChevronDown className="w-4 h-4 text-gray-500 hidden lg:block" />
        </div>

        {/* Mobile: Just avatar */}
        <img
          src="https://ui-avatars.com/api/?name=Shaun+Ola&background=4F46E5&color=fff"
          alt="User"
          className="sm:hidden w-8 h-8 rounded-full cursor-pointer"
        />
      </div>
    </div>
  );
};

export default Header;