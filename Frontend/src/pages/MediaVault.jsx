import React from 'react';
import { Filter, Grid } from 'lucide-react';
import Table from '../components/shared/Table';
import Pagination from '../components/shared/Pagination';
import { allRecordings } from '../data/sampleData';

const MediaVault = ({ setSelectedFile, setCurrentPage }) => {
  const columns = [
    { key: 'name', label: 'File Name & Format' },
    { key: 'type', label: 'Processing Type' },
    { key: 'duration', label: 'Duration' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' }
  ];

  const handleRowClick = (item) => {
    setSelectedFile(item);
    setCurrentPage('segment');
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Media Vault
      </h1>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            All Audio Recordings
          </h3>

          <div className="flex gap-2 items-center">
            <Filter className="w-5 h-5 text-gray-400 cursor-pointer" />
            <Grid className="w-5 h-5 text-gray-400 cursor-pointer" />
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">
              Upload New Recording
            </button>
          </div>
        </div>

        <Table
          columns={columns}
          data={allRecordings}
          renderRow={renderRow}
          onRowClick={handleRowClick}
        />

        <Pagination totalItems={allRecordings.length} currentPage={1} />
      </div>
    </div>
  );
};

export default MediaVault;
