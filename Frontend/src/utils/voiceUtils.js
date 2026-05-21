// Frontend/src/utils/voiceUtils.js
// Shared helpers for Phase 3 (Web Speech API) voice control system.

// ── Voice states ───────────────────────────────────────────────────────────
export const VOICE_STATES = {
  STOPPED:        'STOPPED',        // mic off
  IDLE:           'IDLE',           // listening, no session loaded
  SESSION_ACTIVE: 'SESSION_ACTIVE', // session loaded, ready for rehear/next/back
  READING:        'READING',        // TTS is speaking a chunk
  END_OF_CHUNKS:  'END_OF_CHUNKS',  // reached end of queue
};

// ── Command patterns ───────────────────────────────────────────────────────
const COMMAND_MAP = [
  // Navigation (checked first — global commands)
  { cmd: 'navigate_dashboard',  patterns: ['dashboard', 'home', 'go home', 'go to dashboard'] },
  { cmd: 'navigate_media',      patterns: ['media', 'vault', 'recordings', 'media vault', 'go to media', 'go to vault'] },
  { cmd: 'navigate_workspace',  patterns: ['workspace', 'segment', 'learning modules', 'go to workspace'] },
  { cmd: 'navigate_settings',   patterns: ['settings', 'preferences', 'go to settings'] },
  { cmd: 'navigate_help',       patterns: ['help', 'support', 'help center', 'go to help'] },
  { cmd: 'navigate_live',       patterns: ['live recording', 'record', 'start recording', 'new recording'] },
  // Session playback
  { cmd: 'rehear',   patterns: ['start', 'begin', 'play', 'first', 'rehear', 're-hear', 'replay', 'from the beginning', 'from start', 'start over'] },
  { cmd: 'back',     patterns: ['back', 'previous', 'go back', 'repeat', 'last one', 'before'] },
  { cmd: 'next',     patterns: ['next', 'skip', 'forward', 'continue', 'go next', 'move on', 'after'] },
  // Control
  { cmd: 'stop',     patterns: ['stop', 'end session', 'turn off', 'disable voice', 'quiet', 'mute voice'] },
];

export function matchVoiceCommand(transcript) {
  const full = transcript.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const words = full.split(/\s+/);

  for (const { cmd, patterns } of COMMAND_MAP) {
    if (patterns.includes(full)) {
      return cmd;
    }
    for (const pattern of patterns) {
      const patternWords = pattern.split(/\s+/);
      for (let i = 0; i <= words.length - patternWords.length; i++) {
        let match = true;
        for (let j = 0; j < patternWords.length; j++) {
          if (words[i + j] !== patternWords[j]) {
            match = false;
            break;
          }
        }
        if (match) return cmd;
      }
    }
  }
  return null;
}

// ── TTS via Web Speech API ─────────────────────────────────────────────────
let _currentUtterance = null;

export function speakText(text, { onStart, onEnd, onError } = {}) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate   = 0.95;
  utterance.pitch  = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => onStart?.();
  utterance.onend   = () => { _currentUtterance = null; onEnd?.(); };
  utterance.onerror = () => { _currentUtterance = null; onError?.(); onEnd?.(); };

  _currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  _currentUtterance = null;
}

export function isSpeaking() {
  return window.speechSynthesis?.speaking ?? false;
}

// ── Colour map for UI components ───────────────────────────────────────────
export const STATE_COLOURS = {
  [VOICE_STATES.STOPPED]:        { bg: '#64748b', ring: '#94a3b8', label: 'Off' },
  [VOICE_STATES.IDLE]:           { bg: '#f59e0b', ring: '#fcd34d', label: 'Listening' },
  [VOICE_STATES.SESSION_ACTIVE]: { bg: '#0ea5e9', ring: '#38bdf8', label: 'Ready' },
  [VOICE_STATES.READING]:        { bg: '#7c3aed', ring: '#a78bfa', label: 'Speaking' },
  [VOICE_STATES.END_OF_CHUNKS]:  { bg: '#0ea5e9', ring: '#38bdf8', label: 'End of list' },
};
