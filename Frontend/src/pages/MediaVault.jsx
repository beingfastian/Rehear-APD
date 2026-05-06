// Frontend/src/pages/MediaVault.jsx

import React, { useState } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import FileUpload from '../components/shared/FileUpload';

// Sort arrows — Figma ↕ style (two chevrons stacked)
const SortIcon = () => (
  <svg width="8" height="13" viewBox="0 0 8 13" fill="none" style={{ display: 'inline', marginLeft: '5px', verticalAlign: 'middle' }}>
    <path d="M4 0.5L7 4H1L4 0.5Z" fill="#6a7380" />
    <path d="M4 12.5L1 9H7L4 12.5Z" fill="#6a7380" />
  </svg>
);

// Checkbox icon — Figma rounded square outline
const CheckboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="3.25" stroke="#c1c1c8" strokeWidth="1.5" fill="white" />
  </svg>
);

// Filter icon — Figma funnel shape
const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 3.5H16L10.5 9.5V15L7.5 13.5V9.5L2 3.5Z" stroke="#6a7380" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
  </svg>
);

// Columns/sliders icon — Figma vertical bars with notches
const ColumnsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <line x1="4" y1="2" x2="4" y2="16" stroke="#6a7380" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="9" y1="2" x2="9" y2="16" stroke="#6a7380" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="14" y1="2" x2="14" y2="16" stroke="#6a7380" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="2" y="5" width="4" height="3" rx="1" fill="white" stroke="#6a7380" strokeWidth="1.2" />
    <rect x="7" y="9" width="4" height="3" rx="1" fill="white" stroke="#6a7380" strokeWidth="1.2" />
    <rect x="12" y="6" width="4" height="3" rx="1" fill="white" stroke="#6a7380" strokeWidth="1.2" />
  </svg>
);

// Pagination arrows — Figma style
const PrevIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M9 11.5L4.5 7L9 2.5" stroke="#6a7380" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const NextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M5 2.5L9.5 7L5 11.5" stroke="#6a7380" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MediaVault = ({ setCurrentPage }) => {
  const { jobs, setCurrentJob, isLoadingJobs, deleteJob } = useApp();
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [rowsPerPage] = useState(10);
  const [selected, setSelected] = useState({});

  const totalPages = Math.max(1, Math.ceil(jobs.length / rowsPerPage));
  const startIndex = (currentPageNum - 1) * rowsPerPage;
  const paginatedJobs = jobs.slice(startIndex, startIndex + rowsPerPage);

  const handleView = async (item) => {
    await setCurrentJob(item);
    setCurrentPage('segment');
  };

  const handleUploadSuccess = async (job) => {
    await setCurrentJob(job);
    setCurrentPage('segment');
  };

  const toggleSelect = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const getStatusStyle = (status) => {
    if (status === 'Completed') {
      return { backgroundColor: '#f1fdfb', color: '#129578' };
    }
    return { backgroundColor: '#fff5e6', color: '#fdb345' };
  };

  const getStatusLabel = (status) => {
    if (status === 'Completed') return 'Completed';
    return 'Transcribing';
  };

  const ingestButton = (
    <button
      style={{
        height: '40px',
        paddingLeft: '20px',
        paddingRight: '20px',
        borderRadius: '10px',
        background: 'linear-gradient(104deg, #57a0ef 1.33%, #98d3ff 127.72%)',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'Urbanist, sans-serif',
        fontSize: '14px',
        fontWeight: 700,
        color: '#fff',
        whiteSpace: 'nowrap',
      }}
    >
      Ingest New Media +
    </button>
  );

  return (
    <div
      style={{
        padding: '24px 32px',
        fontFamily: 'Urbanist, sans-serif',
        backgroundColor: '#f6f6f9',
        minHeight: '100%',
      }}
    >
      {/* Page title */}
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#343434',
          marginBottom: '20px',
          lineHeight: 1.2,
        }}
      >
        Resource Library
      </h1>

      {/* Main card */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '20px',
          border: '1px solid #c1c1c8',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #f0f0f4',
          }}
        >
          <span
            style={{ fontSize: '18px', fontWeight: 700, color: '#343434' }}
          >
            All Voice Resource
            {isLoadingJobs && (
              <Loader2
                style={{ display: 'inline', width: '16px', height: '16px', marginLeft: '8px', color: '#6a7380', animation: 'spin 1s linear infinite', verticalAlign: 'middle' }}
              />
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                border: '1px solid #e8e8ed', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <FilterIcon />
            </button>
            <button
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                border: '1px solid #e8e8ed', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ColumnsIcon />
            </button>
            <FileUpload onSuccess={handleUploadSuccess} customButton={ingestButton} />
          </div>
        </div>

        {/* Table */}
        {isLoadingJobs ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Loader2 style={{ width: '32px', height: '32px', color: '#57a0ef', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '14px', color: '#6a7380' }}>Loading recordings…</p>
          </div>
        ) : paginatedJobs.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  {[
                    { label: 'File Name & Format', sort: true },
                    { label: 'Processing Type',    sort: true },
                    { label: 'Duration',            sort: true },
                    { label: 'Status',              sort: true },
                    { label: 'Action',              sort: false },
                  ].map(col => (
                    <th
                      key={col.label}
                      style={{
                        padding: '12px 20px',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#6a7380',
                        fontFamily: 'Urbanist, sans-serif',
                        borderBottom: '1px solid #f0f0f4',
                        whiteSpace: 'nowrap',
                        cursor: col.sort ? 'pointer' : 'default',
                      }}
                    >
                      {col.label}
                      {col.sort && <SortIcon />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedJobs.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => handleView(item)}
                    style={{
                      borderBottom: idx < paginatedJobs.length - 1 ? '1px solid #f6f6f9' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9fc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 600, color: '#343434', fontFamily: 'Urbanist, sans-serif' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', color: '#6a7380', fontFamily: 'Urbanist, sans-serif' }}>
                      {item.type}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', color: '#6a7380', fontFamily: 'Urbanist, sans-serif' }}>
                      {item.duration}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: 600,
                          fontFamily: 'Urbanist, sans-serif',
                          ...getStatusStyle(item.status),
                        }}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }} onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}>
                      {selected[item.id] ? (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <rect width="18" height="18" rx="4" fill="#1674cc" />
                          <path d="M4.5 9L7.5 12L13.5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <CheckboxIcon />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#6a7380', marginBottom: '16px' }}>No recordings yet.</p>
            <FileUpload onSuccess={handleUploadSuccess} customButton={ingestButton} />
          </div>
        )}

        {/* Pagination footer */}
        {paginatedJobs.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderTop: '1px solid #f0f0f4',
            }}
          >
            {/* Rows per page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6a7380', fontFamily: 'Urbanist, sans-serif' }}>
              <span>Rows per page</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600, color: '#343434' }}>
                {rowsPerPage}
                <ChevronDown style={{ width: '14px', height: '14px' }} />
              </span>
            </div>

            {/* Page buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setCurrentPageNum(p => Math.max(1, p - 1))}
                disabled={currentPageNum === 1}
                style={{
                  width: '30px', height: '30px', borderRadius: '6px',
                  border: '1px solid #e8e8ed', background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: currentPageNum === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPageNum === 1 ? 0.4 : 1,
                }}
              >
                <PrevIcon />
              </button>

              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPageNum(p)}
                  style={{
                    width: '30px', height: '30px', borderRadius: '6px',
                    border: 'none',
                    backgroundColor: p === currentPageNum ? '#71bafe' : 'transparent',
                    color: p === currentPageNum ? '#fff' : '#6a7380',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'Urbanist, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setCurrentPageNum(p => Math.min(totalPages, p + 1))}
                disabled={currentPageNum === totalPages}
                style={{
                  width: '30px', height: '30px', borderRadius: '6px',
                  border: '1px solid #e8e8ed', background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: currentPageNum === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPageNum === totalPages ? 0.4 : 1,
                }}
              >
                <NextIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaVault;
