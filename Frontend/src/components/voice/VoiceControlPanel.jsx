// Frontend/src/components/voice/VoiceControlPanel.jsx
// Fixed floating panel (bottom-right) showing:
//  - Current voice state
//  - Text of the chunk being read
//  - Fallback buttons: Rehear / Back / Next
// Hidden when voiceState === STOPPED.

import React from 'react';
import { useVoiceControl } from '../../context/VoiceControlContext';
import { VOICE_STATES, STATE_COLOURS } from '../../utils/voiceUtils';

const MicIcon = ({ size = 14, colour = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <rect x="9" y="2" width="6" height="11" rx="3" stroke={colour} strokeWidth="2.2" fill="none"/>
    <path d="M5 10v2a7 7 0 0014 0v-2" stroke={colour} strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" stroke={colour} strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="9" y1="22" x2="15" y2="22" stroke={colour} strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const IconBtn = ({ label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      flex: 1, padding: '7px 0', borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.2)',
      background: 'rgba(255,255,255,0.12)',
      color: '#fff', fontSize: '12px', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      fontFamily: 'Urbanist, sans-serif',
      transition: 'background 0.15s',
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
  >
    {label}
  </button>
);

const PULSE = `
  @keyframes vcp-pulse {
    0%,100% { opacity:1 } 50% { opacity:0.4 }
  }
  .vcp-blink { animation: vcp-pulse 1.4s ease-in-out infinite; }
`;

export default function VoiceControlPanel() {
  const {
    voiceState, currentChunkIndex,
    rehear, nextChunk, prevChunk, toggleVoice,
    debugInfo,
  } = useVoiceControl();

  if (voiceState === VOICE_STATES.STOPPED) return null;

  const { bg, ring, label } = STATE_COLOURS[voiceState];
  const isReading = voiceState === VOICE_STATES.READING;
  const hasSession = voiceState === VOICE_STATES.SESSION_ACTIVE
    || voiceState === VOICE_STATES.READING
    || voiceState === VOICE_STATES.END_OF_CHUNKS;

  const micColor = debugInfo?.micStatus === 'listening' ? '#4ade80'
    : debugInfo?.micStatus === 'denied' ? '#f87171'
    : '#fbbf24';

  return (
    <>
      <style>{PULSE}</style>
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '260px',
        background: `linear-gradient(135deg, ${bg}, ${ring})`,
        borderRadius: '18px',
        padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        zIndex: 9000,
        fontFamily: 'Urbanist, sans-serif',
        color: '#fff',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div className={isReading ? '' : 'vcp-blink'}>
              <MicIcon size={14} colour="#fff" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{label}</span>
            {/* Mic status dot */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: micColor,
              boxShadow: `0 0 6px ${micColor}`,
            }} title={`Mic: ${debugInfo?.micStatus || 'unknown'}`} />
          </div>
          <button
            onClick={toggleVoice}
            title="Turn off voice"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}
          >×</button>
        </div>

        {/* Status line */}
        <p style={{ fontSize: '11px', opacity: 0.8, margin: '0 0 8px', lineHeight: 1.4 }}>
          {isReading
            ? `Reading chunk ${currentChunkIndex + 1}…`
            : hasSession
              ? `Chunk ${currentChunkIndex + 1} · say "next", "back" or "rehear"`
              : 'Say "rehear", "next", "back", or a page name'}
        </p>

        {/* ── Debug info (remove once voice works) ────────────────────────── */}
        <div style={{
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '10px',
          padding: '8px 10px',
          fontSize: '10px',
          lineHeight: 1.6,
          marginBottom: '10px',
          fontFamily: 'monospace',
          wordBreak: 'break-all',
        }}>
          <div>🎤 mic: <b style={{ color: micColor }}>{debugInfo?.micStatus || '?'}</b></div>
          <div>👂 heard: <b>{debugInfo?.lastHeard || '(nothing yet)'}</b></div>
          <div>⚡ cmd: <b>{debugInfo?.lastCommand || '(none)'}</b></div>
          {debugInfo?.lastError && (
            <div style={{ color: '#fca5a5' }}>⚠️ {debugInfo.lastError}</div>
          )}
        </div>

        {/* Fallback buttons */}
        {hasSession && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <IconBtn label="◀ Back"   onClick={prevChunk} disabled={isReading} />
            <IconBtn label="↺ Start" onClick={rehear}    disabled={isReading} />
            <IconBtn label="Next ▶"  onClick={nextChunk}  disabled={isReading} />
          </div>
        )}
      </div>
    </>
  );
}
