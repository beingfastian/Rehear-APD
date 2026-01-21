import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ totalItems, currentPage = 1, itemsPerPage = 10 }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  return (
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Rows per page:</span>
        <select className="border border-gray-300 rounded px-2 py-1 text-sm">
          <option>10</option>
          <option>25</option>
          <option>50</option>
        </select>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
        </span>
        <div className="flex gap-1">
          <button className="p-1 border border-gray-300 rounded hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="px-3 py-1 bg-blue-500 text-white rounded">1</button>
          {totalPages > 1 && (
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">2</button>
          )}
          {totalPages > 2 && (
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">3</button>
          )}
          <button className="p-1 border border-gray-300 rounded hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;