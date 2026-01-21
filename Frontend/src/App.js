import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import MediaVault from './pages/MediaVault';
import SegmentWorkspace from './pages/SegmentWorkspace';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <div className="flex-1 overflow-auto">
          {currentPage === 'dashboard' && <Dashboard />}
          
          {currentPage === 'media' && (
            <MediaVault 
              setSelectedFile={setSelectedFile} 
              setCurrentPage={setCurrentPage} 
            />
          )}
          
          {currentPage === 'segment' && (
            <SegmentWorkspace selectedFile={selectedFile} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
