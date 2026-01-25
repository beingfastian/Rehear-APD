// Frontend/src/components/shared/Table.jsx

import React from 'react';
import { ChevronDown } from 'lucide-react';

const Table = ({ columns, data, renderRow, onRowClick }) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th 
                  key={column.key}
                  className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.label}
                  <ChevronDown className="w-4 h-4 inline ml-1" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item) => (
              <tr 
                key={item.id} 
                className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick && onRowClick(item)}
              >
                {renderRow(item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {data.map((item) => (
          <div
            key={item.id}
            onClick={() => onRowClick && onRowClick(item)}
            className={`p-4 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 text-sm truncate">
                  {item.name}
                </h4>
                <p className="text-xs text-gray-500 mt-1">{item.type}</p>
              </div>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                item.status === 'Completed' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {item.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{item.duration}</span>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Table;