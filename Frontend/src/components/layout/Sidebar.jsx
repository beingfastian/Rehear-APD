// Frontend/src/components/layout/Sidebar.jsx

import React, { useState } from 'react';
import { LayoutDashboard, Music2, AlignLeft, Settings, HelpCircle, Menu, X, LogOut } from 'lucide-react';

const Sidebar = ({ currentPage, setCurrentPage }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'media',     icon: Music2,          label: 'Media Center' },
    { id: 'segment',   icon: AlignLeft,        label: 'Segment Workspace' },
    { id: 'settings',  icon: Settings,         label: 'Settings' },
    { id: 'help',      icon: HelpCircle,       label: 'Help Center' },
  ];

  const handleNavigation = (page) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-56 bg-white border-r border-gray-100 h-screen flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-center">
          <img
            src="/APD LOGO.png"
            alt="APD Tool"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                  transition-all duration-150 group relative
                  ${active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}
                `}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-600 rounded-r-full" />
                )}
                <item.icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} style={{ width: 18, height: 18 }} />
                <span className={`text-sm font-medium truncate ${active ? 'text-blue-600' : ''}`}>{item.label}</span>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <button
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-150"
            onClick={() => {/* logout logic */}}
          >
            <LogOut style={{ width: 18, height: 18 }} className="flex-shrink-0" />
            <span className="text-sm font-medium">Log out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;