// components/voice/VoiceCommandBar.jsx
// Simple floating bar for voice commands in chunk session.
// Shows mic status + debug, only 3 commands: start / next / back.

import React from 'react';

const MicIcon = ({ size = 16, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <rect x="9" y="2" width="6" height="11" rx="3" stroke={color} strokeWidth="2" fill="none"/>
    <path d="M5 10v2a7 7 0 0014 0v-2" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="9" y1="22" x2="15" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const Btn = ({ label, onClick, active }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, padding: '8px 0', borderRadius: '10px',
      border: active ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.25)',
      background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
      color: '#fff', fontSize: '12px', fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'Urbanist, sans-serif',
      transition: 'all 0.2s',
      transform: active ? 'scale(1.05)' : 'scale(1)',
    }}
  >
    {label}
  </button>
);

const PULSE_CSS = `
  @keyframes vcb-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes vcb-pop { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }
  .vcb-blink { animation: vcb-pulse 1.4s ease-in-out infinite; }
  .vcb-pop { animation: vcb-pop 0.3s ease; }
`;

export default function VoiceCommandBar({ status, onStart, onNext, onBack, currentStep, totalSteps }) {
  const { micActive, lastHeard, lastKeyword, error } = status;

  const micColor = micActive ? '#4ade80' : error ? '#f87171' : '#fbbf24';
  const micLabel = micActive ? 'Listening' : error ? 'Error' : 'Starting…';

  return (
    <>
      <style>{PULSE_CSS}</style>
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '280px',
        background: 'linear-gradient(135deg, #1e293b, #334155)',
        borderRadius: '20px',
        padding: '16px 18px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
        zIndex: 9000,
        fontFamily: 'Urbanist, sans-serif',
        color: '#fff',
      }}>
        {/* Header: mic status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: micActive ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${micColor}`,
          }}>
            <div className={micActive ? 'vcb-blink' : ''}>
              <MicIcon size={14} color={micColor} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {micLabel}
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: micColor, boxShadow: `0 0 8px ${micColor}`,
              }} />
            </div>
            <div style={{ fontSize: '10px', opacity: 0.6 }}>
              {totalSteps > 0 ? `Step ${currentStep + 1} of ${totalSteps}` : 'Say "start" to begin'}
            </div>
          </div>
        </div>

        {/* Debug: what mic hears */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '12px',
          fontSize: '11px',
          fontFamily: 'monospace',
          minHeight: '36px',
        }}>
          <div style={{ opacity: 0.5, fontSize: '9px', marginBottom: '2px' }}>MIC HEARS:</div>
          <div style={{ 
            color: lastHeard?.startsWith('…') ? '#94a3b8' : '#e2e8f0',
            fontWeight: lastHeard && !lastHeard.startsWith('…') ? 600 : 400,
          }}>
            {lastHeard || '(waiting for speech…)'}
          </div>
          {lastKeyword && (
            <div style={{ color: '#4ade80', fontWeight: 700, marginTop: '2px' }}>
              ⚡ {lastKeyword.toUpperCase()}
            </div>
          )}
          {error && (
            <div style={{ color: '#fca5a5', marginTop: '4px', fontSize: '10px' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Command buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <Btn label="◀ Back"  onClick={onBack}  active={lastKeyword === 'back'} />
          <Btn label="▶ Start" onClick={onStart} active={lastKeyword === 'start'} />
          <Btn label="Next ▶" onClick={onNext}  active={lastKeyword === 'next'} />
        </div>

        {/* Help text */}
        <div style={{ fontSize: '9px', opacity: 0.4, textAlign: 'center' }}>
          Say <b>"start"</b> · <b>"next"</b> · <b>"back"</b>
        </div>
      </div>
    </>
  );
}
