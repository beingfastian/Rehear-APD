import React from 'react';
import { Grid, Folder, FileText, Settings, HelpCircle } from 'lucide-react';

const Sidebar = ({ currentPage, setCurrentPage }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      
      <div className="p-4 border-b border-gray-200">
        <span className="text-xl font-bold text-blue-600">APOTOOL</span>
      </div>

      <nav className="flex-1 p-4 space-y-2">

        <div
          onClick={() => setCurrentPage('dashboard')}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
          ${currentPage === 'dashboard'
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <Grid className="w-5 h-5" />
          <span>Dashboard</span>
        </div>

        <div
          onClick={() => setCurrentPage('media')}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
          ${currentPage === 'media'
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <Folder className="w-5 h-5" />
          <span>Media Vault</span>
        </div>

        <div
          onClick={() => setCurrentPage('segment')}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
          ${currentPage === 'segment'
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-700 hover:bg-gray-50'}`}
        >
          <FileText className="w-5 h-5" />
          <span>Segment Workspace</span>
        </div>

        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </div>

        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer">
          <HelpCircle className="w-5 h-5" />
          <span>Help Center</span>
        </div>

      </nav>
    </div>
  );
};

export default Sidebar;
