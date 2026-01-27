// Frontend/src/components/dashboard/RecentActivityTable.jsx - CLICKABLE ROWS

import React from 'react';
import { Filter, Grid } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Table from '../shared/Table';
import Pagination from '../shared/Pagination';

const RecentActivityTable = ({ data, setCurrentPage }) => {
  const { setCurrentJob } = useApp();

  const columns = [
    { key: 'name', label: 'File Name & Format' },
    { key: 'type', label: 'Processing Type' },
    { key: 'duration', label: 'Duration' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' }
  ];

  const handleRowClick = async (item) => {
    console.log('[RecentActivity] Row clicked:', item.id);
    await setCurrentJob(item);
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
          item.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          {item.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <input 
          type="checkbox" 
          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
    </>
  );

  return (
    <>
      <Table 
        columns={columns} 
        data={data} 
        renderRow={renderRow} 
        onRowClick={handleRowClick}
      />
      {data.length > 10 && (
        <Pagination totalItems={data.length} currentPage={1} />
      )}
    </>
  );
};

export default RecentActivityTable;