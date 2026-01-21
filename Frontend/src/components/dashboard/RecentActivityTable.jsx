import React from 'react';
import { Filter, Grid } from 'lucide-react';
import Table from '../shared/Table';
import Pagination from '../shared/Pagination';

const RecentActivityTable = ({ data }) => {
  const columns = [
    { key: 'name', label: 'File Name & Format' },
    { key: 'type', label: 'Processing Type' },
    { key: 'duration', label: 'Duration' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' }
  ];

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
        <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
      </td>
    </>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Recent activity</h3>
        <div className="flex gap-2">
          <Filter className="w-5 h-5 text-gray-400 cursor-pointer" />
          <Grid className="w-5 h-5 text-gray-400 cursor-pointer" />
        </div>
      </div>
      
      <Table columns={columns} data={data} renderRow={renderRow} />
      <Pagination totalItems={data.length} currentPage={1} />
    </div>
  );
};

export default RecentActivityTable;