import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

const imgArrowUp              = "https://www.figma.com/api/mcp/asset/ca4dae79-ed26-4b25-b89a-a3a91f97e14b";
const imgVuesaxOutlineMoreSq  = "https://www.figma.com/api/mcp/asset/6a8cc17f-d04b-45bd-9159-2c9e48f49a3f";
const imgVuesaxBoldArrowDown  = "https://www.figma.com/api/mcp/asset/2c000eab-5a5c-4438-bd50-578d8028eb62";
const imgVuesaxBoldArrowLeft  = "https://www.figma.com/api/mcp/asset/c1f5f49b-afc1-4f37-8bb1-d159bb11e959";
const imgVuesaxBoldArrowRight = "https://www.figma.com/api/mcp/asset/b68c359b-75b8-4a52-9f6f-276e7c3dbe12";
const imgEllipse1             = "https://www.figma.com/api/mcp/asset/2c1c8db9-4d7f-4802-aea9-480734fbac15";
const imgVuesaxOutlineFilter  = "https://www.figma.com/api/mcp/asset/9e8504de-12ba-4d2a-abf3-d252551db5c1";
const imgVuesaxOutlineSetting5= "https://www.figma.com/api/mcp/asset/2682a574-44d2-4e40-a42f-8b2390ea8a5b";

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
            <img src={imgVuesaxOutlineFilter} alt="filter" style={{ width: '24px', height: '24px' }} />
          </button>
          <button className="flex items-center justify-center" style={{ backgroundColor: '#f6f6f9', border: '1px solid #c1c1c8', borderRadius: '12px', padding: '16px' }}>
            <img src={imgVuesaxOutlineSetting5} alt="settings" style={{ width: '24px', height: '24px' }} />
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
                    {col.label !== 'Action' && <img src={imgArrowUp} alt="" style={{ width: '16px', height: '16px' }} />}
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
                    <img src={imgEllipse1} alt="" style={{ width: '24px', height: '24px', flexShrink: 0 }} />
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
                    <img src={imgVuesaxOutlineMoreSq} alt="more" style={{ width: '24px', height: '24px' }} />
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
          <img src={imgVuesaxBoldArrowDown} alt="" style={{ width: '24px', height: '24px' }} />
        </div>
        <div className="flex items-center" style={{ gap: '12px', padding: '12px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="flex items-center justify-center" style={{ border: '1px solid #c1c1c8', borderRadius: '8px', padding: '8px', background: 'none', cursor: 'pointer' }}>
            <img src={imgVuesaxBoldArrowLeft} alt="prev" style={{ width: '16px', height: '16px' }} />
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
            <img src={imgVuesaxBoldArrowRight} alt="next" style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentActivityTable;
