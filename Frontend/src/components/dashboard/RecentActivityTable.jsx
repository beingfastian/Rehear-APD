import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

import { IconArrowUp, IconMoreHorizontal, IconChevronDown, IconChevronLeft, IconChevronRight, IconFileAudio, IconFilter, IconSliders } from '../../assets/icons';

const ROWS_PER_PAGE = 10;

const StatusBadge = ({ status }) => {
  const completed = status === 'Completed';
  return (
    <span
      className="inline-flex items-center whitespace-nowrap font-semibold"
      style={{
        fontFamily: 'Urbanist, sans-serif',
        fontSize: '12px',
        lineHeight: 1.3,
        padding: '8px 12px',
        borderRadius: '12px',
        backgroundColor: completed ? '#f1fdfb' : '#fff5e6',
        color: completed ? '#129578' : '#fdb345',
      }}
    >
      {completed ? 'Completed' : (status || 'Analyzing Logic...')}
    </span>
  );
};

const RecentActivityTable = ({ data, setCurrentPage }) => {
  const { setCurrentJob } = useApp();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / ROWS_PER_PAGE));
  const pageData = data.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const handleRowClick = async (item) => {
    await setCurrentJob(item);
    setCurrentPage('segment');
  };

  return (
    <div style={{ fontFamily: 'Urbanist, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '24px 24px 10px 24px' }}>
        <p className="font-bold" style={{ fontSize: '24px', color: '#222132', lineHeight: 1.3 }}>Recent activity</p>
        <div className="flex items-center" style={{ gap: '24px' }}>
          <button className="flex items-center justify-center" style={{ backgroundColor: '#f6f6f9', border: '1px solid #c1c1c8', borderRadius: '12px', padding: '16px' }}>
            <IconFilter style={{ width: '24px', height: '24px', color: '#6a7380' }} />
          </button>
          <button className="flex items-center justify-center" style={{ backgroundColor: '#f6f6f9', border: '1px solid #c1c1c8', borderRadius: '12px', padding: '16px' }}>
            <IconSliders style={{ width: '24px', height: '24px', color: '#6a7380' }} />
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid #c1c1c8' }}>
              {[
                { label: 'File Name & Format' },
                { label: 'Segmentation Logic' },
                { label: 'Duration' },
                { label: 'AI Pipeline State' },
                { label: 'Action', align: 'right' },
              ].map((col) => (
                <th key={col.label} style={{ padding: '8px', height: '64px', textAlign: col.align || 'left' }}>
                  <span className="inline-flex items-center font-bold whitespace-nowrap" style={{ gap: '8px', fontSize: '16px', color: '#343434', lineHeight: 1.3 }}>
                    {col.label}
                    {col.label !== 'Action' && <IconArrowUp style={{ width: '16px', height: '16px', color: '#6a7380' }} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((item) => (
              <tr
                key={item.id}
                onClick={() => handleRowClick(item)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #c1c1c8' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f6f6f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '0 8px', height: '50px' }}>
                  <div className="flex items-center" style={{ gap: '8px' }}>
                    <div className="flex items-center justify-center rounded-full" style={{ width: '24px', height: '24px', backgroundColor: '#e8f0fe', color: '#1674cc', flexShrink: 0 }}>
                      <IconFileAudio style={{ width: '14px', height: '14px' }} />
                    </div>
                    <span className="font-semibold whitespace-nowrap" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '16px', color: '#232323' }}>
                      {item.name}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '0 8px', height: '50px' }}>
                  <span style={{ fontSize: '14px', color: '#343434' }}>{item.type || 'Full Transcription'}</span>
                </td>
                <td style={{ padding: '0 8px', height: '50px' }}>
                  <span style={{ fontSize: '14px', color: '#343434' }}>{item.duration || '—'}</span>
                </td>
                <td style={{ padding: '0 8px', height: '50px' }}>
                  <StatusBadge status={item.status} />
                </td>
                <td style={{ padding: '0 8px', height: '50px', textAlign: 'right' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleRowClick(item); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconMoreHorizontal style={{ width: '24px', height: '24px', color: '#6a7380' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden" style={{ borderTop: '1px solid #c1c1c8' }}>
        {pageData.map((item) => (
          <div
            key={item.id}
            onClick={() => handleRowClick(item)}
            className="cursor-pointer p-4"
            style={{ borderBottom: '1px solid #c1c1c8' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f6f6f9'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div className="flex items-start justify-between mb-1">
              <span className="font-semibold text-sm truncate flex-1" style={{ color: '#232323', fontFamily: 'DM Sans, sans-serif' }}>{item.name}</span>
              <StatusBadge status={item.status} />
            </div>
            <p style={{ fontSize: '12px', color: '#6a7380' }}>{item.type} · {item.duration}</p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between" style={{ padding: '8px 0' }}>
        <div className="flex items-center" style={{ gap: '12px', backgroundColor: 'white', borderRadius: '360px', padding: '16px 20px' }}>
          <span style={{ fontFamily: 'Urbanist, sans-serif', fontSize: '14px', color: '#232324', letterSpacing: '0.25px' }}>Rows per page</span>
          <span style={{ fontSize: '16px', color: '#232324' }}>{ROWS_PER_PAGE}</span>
          <IconChevronDown style={{ width: '24px', height: '24px', color: '#6a7380' }} />
        </div>
        <div className="flex items-center" style={{ gap: '12px', padding: '12px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="flex items-center justify-center" style={{ border: '1px solid #c1c1c8', borderRadius: '8px', padding: '8px', background: 'none', cursor: 'pointer' }}>
            <IconChevronLeft style={{ width: '16px', height: '16px', color: '#6a7380' }} />
          </button>
          <div className="flex items-center" style={{ gap: '4px' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="flex items-center justify-center font-medium"
                style={{
                  width: '32px', height: '32px',
                  borderRadius: p === page ? '8px' : '24px',
                  fontSize: '14px',
                  backgroundColor: p === page ? '#71bafe' : 'transparent',
                  color: p === page ? '#fff' : '#232324',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="flex items-center justify-center" style={{ border: '1px solid #c1c1c8', borderRadius: '8px', padding: '8px', background: 'none', cursor: 'pointer' }}>
            <IconChevronRight style={{ width: '16px', height: '16px', color: '#6a7380' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentActivityTable;
