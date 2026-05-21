// Frontend/src/components/voice/VoiceIndicator.jsx
// Mic indicator shown in the Header.
// Colour codes the current voice state. Click to toggle voice on/off.

import React from 'react';
import { useVoiceControl } from '../../context/VoiceControlContext';
import { VOICE_STATES, STATE_COLOURS } from '../../utils/voiceUtils';

const PULSE_STYLE = `
  @keyframes vi-pulse {
    0%   { transform: scale(1);    opacity: 0.7; }
    70%  { transform: scale(1.55); opacity: 0;   }
    100% { transform: scale(1.55); opacity: 0;   }
  }
  .vi-pulse { animation: vi-pulse 1.8s ease-out infinite; }
`;

const MicIcon = ({ size = 16, colour = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
    <rect x="9" y="2" width="6" height="11" rx="3" stroke={colour} strokeWidth="2" fill="none"/>
    <path d="M5 10v2a7 7 0 0014 0v-2" stroke={colour} strokeWidth="2" strokeLinecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" stroke={colour} strokeWidth="2" strokeLinecap="round"/>
    <line x1="9" y1="22" x2="15" y2="22" stroke={colour} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function VoiceIndicator() {
  const { voiceState, toggleVoice } = useVoiceControl();
  const { bg, ring, label } = STATE_COLOURS[voiceState] || STATE_COLOURS[VOICE_STATES.STOPPED];
  const isActive  = voiceState !== VOICE_STATES.STOPPED;
  const isReading = voiceState === VOICE_STATES.READING;

  return (
    <>
      <style>{PULSE_STYLE}</style>
      <button
        onClick={toggleVoice}
        title={`Voice: ${label} — click to ${isActive ? 'disable' : 'enable'}`}
        style={{
          position: 'relative',
          width: '36px', height: '36px',
          borderRadius: '50%',
          background: bg,
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: isActive ? `0 0 0 2px ${ring}` : 'none',
          transition: 'background 0.3s, box-shadow 0.3s',
        }}
      >
        {/* Pulse ring when actively listening or reading */}
        {isActive && (
          <div
            className="vi-pulse"
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: ring,
              opacity: isReading ? 0.5 : 0.3,
            }}
          />
        )}
        <MicIcon size={16} colour="#fff" />
      </button>
    </>
  );
}
