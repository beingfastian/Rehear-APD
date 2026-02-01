
import React, { useState } from 'react';
import { Grid, Folder, FileText, Settings, HelpCircle, Menu, X, Mic } from 'lucide-react';

const Sidebar = ({ currentPage, setCurrentPage }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', icon: Grid, label: 'Dashboard' },
    { id: 'media', icon: Folder, label: 'Media Vault' },
    { id: 'segment', icon: FileText, label: 'Segment Workspace' },
    { id: 'live-transcription', icon: Mic, label: 'Live Transcription', badge: 'NEW' }, // NEW ITEM
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'help', icon: HelpCircle, label: 'Help Center' },
  ];

  const handleNavigation = (page) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false); // Close mobile menu after navigation
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-white border-r border-gray-200 h-screen flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <span className="text-xl font-bold text-blue-600">APOTOOL</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors relative
              ${currentPage === item.id
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate flex-1">{item.label}</span>
              
              {/* NEW Badge */}
              {item.badge && (
                <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        {/* Footer Info */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <p className="font-semibold mb-1">🎙️ New Feature!</p>
            <p>Try Live Transcription for real-time audio to text</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;