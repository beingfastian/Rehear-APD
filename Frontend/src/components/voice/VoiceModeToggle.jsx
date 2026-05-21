// Frontend/src/components/voice/VoiceModeToggle.jsx
// Toggle button shown in SegmentWorkspace top bar.
// OFF = Phase 3 Web Speech API  |  ON = Phase 4 LangGraph WebSocket agent

import React from 'react';
import { useVoiceControl } from '../../context/VoiceControlContext';

export default function VoiceModeToggle() {
  const { isAdvancedMode, setIsAdvancedMode } = useVoiceControl();

  return (
    <button
      onClick={() => setIsAdvancedMode(v => !v)}
      title={isAdvancedMode ? 'Switch to Standard voice (Web Speech API)' : 'Switch to Advanced voice (AI agent)'}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '7px 14px',
        borderRadius: '20px',
        border: isAdvancedMode ? '1.5px solid #7c3aed' : '1.5px solid #cbd5e1',
        background: isAdvancedMode
          ? 'linear-gradient(135deg,#7c3aed,#6d28d9)'
          : '#fff',
        color: isAdvancedMode ? '#fff' : '#475569',
        fontSize: '13px', fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: 'Urbanist, sans-serif',
        boxShadow: isAdvancedMode ? '0 2px 10px rgba(124,58,237,0.3)' : 'none',
      }}
    >
      <span style={{ fontSize: '15px' }}>{isAdvancedMode ? '🤖' : '🎙️'}</span>
      {isAdvancedMode ? 'Advanced Voice' : 'Standard Voice'}
    </button>
  );
}
