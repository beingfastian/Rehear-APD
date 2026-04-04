// Frontend/src/components/dashboard/RecentActivityTable.jsx

import React from 'react';
import { ChevronDown, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const RecentActivityTable = ({ data, setCurrentPage }) => {
  const { setCurrentJob } = useApp();

  const handleRowClick = async (item) => {
    await setCurrentJob(item);
    setCurrentPage('segment');
  };

  const columns = ['File Name & Format', 'Processing Type', 'Duration', 'Status', 'Action'];

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50/60">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1">
                    {col}
                    {col !== 'Action' && <ChevronDown className="w-3 h-3" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((item) => (
              <tr
                key={item.id}
                onClick={() => handleRowClick(item)}
                className="hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-800">{item.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{item.type}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{item.duration}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    item.status === 'Completed'
                      ? 'bg-green-50 text-green-600'
                      : 'bg-orange-50 text-orange-500'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRowClick(item); }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-50">
        {data.map((item) => (
          <div
            key={item.id}
            onClick={() => handleRowClick(item)}
            className="p-4 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="font-medium text-sm text-gray-800 truncate flex-1">{item.name}</span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                item.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
              }`}>{item.status}</span>
            </div>
            <p className="text-xs text-gray-400">{item.type} · {item.duration}</p>
          </div>
        ))}
      </div>

      {/* Pagination row */}
      {data.length > 10 && (
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Rows per page</span>
            <span className="inline-flex items-center gap-1 font-medium text-gray-700">
              10 <ChevronDown className="w-3 h-3" />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[1, 2, 3].map(p => (
              <button
                key={p}
                className={`w-8 h-8 rounded-lg text-sm font-medium ${
                  p === 1 ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}
            <button className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default RecentActivityTable;