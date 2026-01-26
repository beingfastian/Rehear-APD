// Frontend/src/pages/MediaVault.jsx

import React, { useState } from 'react';
import { Filter, Grid, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Table from '../components/shared/Table';
import Pagination from '../components/shared/Pagination';
import FileUpload from '../components/shared/FileUpload';

const MediaVault = ({ setCurrentPage }) => {
  const { jobs, setCurrentJob, isLoadingJobs, refreshJobs } = useApp();
  const [itemsPerPage] = useState(10);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const columns = [
    { key: 'name', label: 'File Name & Format' },
    { key: 'type', label: 'Processing Type' },
    { key: 'duration', label: 'Duration' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' }
  ];

  const handleRowClick = async (item) => {
    await setCurrentJob(item);
    setCurrentPage('segment');
  };

  const handleUploadSuccess = async (job) => {
    await setCurrentJob(job);
    setCurrentPage('segment');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshJobs();
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderRow = (item) => (
    <>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {item.name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {item.type}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {item.duration}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          item.status === 'Completed'
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {item.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
      </td>
    </>
  );

  // Paginate jobs
  const startIndex = (currentPageNum - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = jobs.slice(startIndex, endIndex);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Media Vault
        </h1>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
            All Audio Recordings ({jobs.length})
            {isLoadingJobs && (
              <span className="ml-2 text-xs text-gray-500">
                <Loader2 className="inline w-3 h-3 animate-spin" /> Loading...
              </span>
            )}
          </h3>

          <div className="flex gap-2 items-center w-full sm:w-auto">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 cursor-pointer" />
            <Grid className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 cursor-pointer" />
            <div className="flex-1 sm:flex-initial">
              <FileUpload onSuccess={handleUploadSuccess} />
            </div>
          </div>
        </div>

        {isLoadingJobs ? (
          <div className="px-4 sm:px-6 py-8 sm:py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-500 text-sm sm:text-base">Loading recordings from database...</p>
          </div>
        ) : paginatedJobs.length > 0 ? (
          <>
            <Table
              columns={columns}
              data={paginatedJobs}
              renderRow={renderRow}
              onRowClick={handleRowClick}
            />

            <Pagination
              totalItems={jobs.length}
              currentPage={currentPageNum}
              itemsPerPage={itemsPerPage}
            />
          </>
        ) : (
          <div className="px-4 sm:px-6 py-8 sm:py-12 text-center">
            <p className="text-gray-500 mb-4 text-sm sm:text-base">
              No recordings yet. Upload your first audio file!
            </p>
            <FileUpload onSuccess={handleUploadSuccess} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaVault;