// Frontend/src/pages/Dashboard.jsx - WITH REAL DATABASE DATA

import React, { useState, useEffect } from 'react';
import { FileText, Mic, Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import ActionCard from '../components/dashboard/ActionCard';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import FileUpload from '../components/shared/FileUpload';
import MicRecorder from '../components/shared/MicRecorder';

const Dashboard = ({ setCurrentPage }) => {
  const { jobs, getStats, isLoadingJobs } = useApp();
  const stats = getStats();
  const [backendStatus, setBackendStatus] = useState('checking');
  
  // Get recent 10 jobs (shows all recent activity)
  const recentActivity = jobs.slice(0, 10);

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const health = await apiService.checkHealth();
        setBackendStatus('online');
        console.log('[Dashboard] Backend health:', health);
      } catch (error) {
        setBackendStatus('offline');
        console.error('[Dashboard] Backend is offline:', error);
      }
    };
    
    checkBackend();
  }, []);

  const handleUploadSuccess = (job) => {
    setCurrentPage('segment');
  };

  const handleRecordSuccess = (job) => {
    setCurrentPage('segment');
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Dashboard Overview
        </h1>
        
        {isLoadingJobs && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Loading from database...</span>
          </div>
        )}
      </div>

      {/* Welcome Card with Real Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-2 mb-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Welcome back, Shaun! Ready to transform your audio?
          </h2>
          
          {/* Backend Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
            backendStatus === 'online' 
              ? 'bg-green-100 text-green-700' 
              : backendStatus === 'offline'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {backendStatus === 'online' && (
              <>
                <CheckCircle className="w-3 h-3" />
                API Online
              </>
            )}
            {backendStatus === 'offline' && (
              <>
                <XCircle className="w-3 h-3" />
                API Offline
              </>
            )}
            {backendStatus === 'checking' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking...
              </>
            )}
          </div>
        </div>
        
        <p className="text-gray-600 text-xs sm:text-sm mb-4 sm:mb-6">
          Upload your recordings to generate instant transcripts, AI-powered summaries, and instructional chunks. 
          All data is saved to PostgreSQL database and audio chunks are stored in S3.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900">{stats.totalJobs}</div>
              <div className="text-sm text-gray-600">Audio Files Processed</div>
            </div>
            <div className="text-xs sm:text-sm font-medium text-green-600">
              {stats.completedJobs} completed
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900">{stats.totalChunks}</div>
              <div className="text-sm text-gray-600">Audio Chunks in S3</div>
            </div>
            <div className="text-xs sm:text-sm font-medium text-blue-600">
              Ready to play
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards with Actual Functionality */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <ActionCard
          icon={FileText}
          title="Instructional Chunks"
          description={`Browse ${stats.totalChunks} audio chunks generated from ${stats.totalJobs} recordings`}
          buttonText="View All Chunks"
          buttonVariant="default"
          onClick={() => setCurrentPage('media')}
        />

        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Mic className="w-6 h-6 text-gray-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Live Record</h3>
          <p className="text-sm text-gray-600 mb-4">
            Capture audio directly from your device and process instantly.
          </p>
          <MicRecorder onSuccess={handleRecordSuccess} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6 text-gray-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Upload Audio</h3>
          <p className="text-sm text-gray-600 mb-4">
            Support for WAV, MP3, and M4A. Accepts up to 200MB.
          </p>
          <FileUpload onSuccess={handleUploadSuccess} />
        </div>
      </div>

      {/* Recent Activity with Real Data from Database */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
            Recent Activity {isLoadingJobs ? (
              <Loader2 className="inline w-4 h-4 animate-spin ml-2" />
            ) : (
              <span className="text-gray-500 font-normal">({recentActivity.length} recordings)</span>
            )}
          </h3>
        </div>

        {isLoadingJobs ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading jobs from database...</p>
          </div>
        ) : recentActivity.length > 0 ? (
          <RecentActivityTable data={recentActivity} setCurrentPage={setCurrentPage} />
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500 text-sm mb-4">No recordings yet. Upload your first audio file!</p>
            <FileUpload onSuccess={handleUploadSuccess} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;