// Frontend/src/pages/MediaVault.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Filter, SlidersHorizontal, Loader2, RefreshCw, MoreHorizontal, Trash2, Eye, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import FileUpload from '../components/shared/FileUpload';

// ── Row action dropdown ───────────────────────────────────────────────────────
const ActionMenu = ({ item, onView, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 bg-white border border-sky-100 rounded-xl shadow-lg py-1 w-36 text-sm">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onView(item); }}
            className="flex items-center gap-2 px-4 py-2 w-full text-left text-slate-700 hover:bg-slate-50"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(item); }}
            className="flex items-center gap-2 px-4 py-2 w-full text-left text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

// ── MediaVault ────────────────────────────────────────────────────────────────
const MediaVault = ({ setCurrentPage }) => {
  const { jobs, setCurrentJob, isLoadingJobs, refreshJobs, deleteJob } = useApp();
  const [itemsPerPage]     = useState(10);
  const [currentPageNum,  setCurrentPageNum]  = useState(1);
  const [isRefreshing,    setIsRefreshing]    = useState(false);

  // pagination
  const totalPages   = Math.ceil(jobs.length / itemsPerPage);
  const startIndex   = (currentPageNum - 1) * itemsPerPage;
  const paginatedJobs = jobs.slice(startIndex, startIndex + itemsPerPage);

  const handleView = async (item) => {
    await setCurrentJob(item);
    setCurrentPage('segment');
  };

  const handleDelete = async (item) => {
    if (window.confirm(`Delete "${item.name}"?`)) {
      await deleteJob(item.id);
    }
  };

  const handleUploadSuccess = async (job) => {
    await setCurrentJob(job);
    setCurrentPage('segment');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refreshJobs(); } finally { setIsRefreshing(false); }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Media Vault</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600
                     hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-sky-100 shadow-sm">
        {/* Table header row */}
        <div className="px-6 py-4 border-b border-sky-100 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900">
            All Audio Recordings
            {isLoadingJobs && <Loader2 className="inline w-4 h-4 animate-spin ml-2 text-slate-400" />}
          </h3>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-gray-600 hover:bg-slate-50 rounded-lg transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-2 text-slate-400 hover:text-gray-600 hover:bg-slate-50 rounded-lg transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {/* Ingest button wraps FileUpload */}
            <FileUpload onSuccess={handleUploadSuccess} label="Ingest New Media +" />
          </div>
        </div>

        {/* Table */}
        {isLoadingJobs ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading recordings…</p>
          </div>
        ) : paginatedJobs.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/60">
                  <tr>
                    {['File Name & Format', 'Processing Type', 'Duration', 'Status', 'Action'].map((col) => (
                      <th key={col} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1">
                          {col}
                          {col !== 'Action' && <ChevronDown className="w-3 h-3" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedJobs.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleView(item)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{item.type}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{item.duration}</td>
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
                        <ActionMenu item={item} onView={handleView} onDelete={handleDelete} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-50">
              {paginatedJobs.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleView(item)}
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-sm text-slate-800 truncate flex-1">{item.name}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                    }`}>{item.status}</span>
                  </div>
                  <p className="text-xs text-slate-400">{item.type} · {item.duration}</p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-sky-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Rows per page</span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                  {itemsPerPage} <ChevronDown className="w-3 h-3" />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPageNum(p => Math.max(1, p - 1))}
                  disabled={currentPageNum === 1}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPageNum(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium ${
                      p === currentPageNum
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPageNum(p => Math.min(totalPages, p + 1))}
                  disabled={currentPageNum === totalPages || totalPages === 0}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400 mb-4">No recordings yet.</p>
            <FileUpload onSuccess={handleUploadSuccess} label="Ingest New Media +" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaVault;