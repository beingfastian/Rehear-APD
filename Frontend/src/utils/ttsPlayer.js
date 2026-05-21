// Centralized TTS / audio-feedback player for voice-command responses.
//
// Two playback paths:
//   playUrl(url)  — plays a pre-generated instruction audio file (S3 URL)
//   speak(text)   — browser SpeechSynthesis for short feedback ("No more instructions")
//
// AEC guard: isTTSActive is true while audio is playing + for 1500ms after it ends.
// useVoiceCommands reads this flag to raise its confidence threshold, preventing
// the mic from triggering on the system's own playback.

const TTS_COOLDOWN_MS = 1500;

let _isTTSActive = false;
let _cooldownTimer = null;
let _onActiveChange = null; // optional external listener

function _setActive(active) {
  _isTTSActive = active;
  _onActiveChange?.(active);
}

function _startCooldown() {
  clearTimeout(_cooldownTimer);
  _cooldownTimer = setTimeout(() => _setActive(false), TTS_COOLDOWN_MS);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function isTTSActive() {
  return _isTTSActive;
}

// Register a callback that fires whenever the active state changes.
// Returns an unsubscribe function.
export function onActiveChange(fn) {
  _onActiveChange = fn;
  return () => { if (_onActiveChange === fn) _onActiveChange = null; };
}

// Play an instruction audio URL.
// Returns a Promise that resolves when playback ends (or rejects on error).
export function playUrl(url) {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error('No URL')); return; }

    _setActive(true);
    const audio = new Audio(url);

    audio.onended = () => {
      _startCooldown();
      resolve();
    };
    audio.onerror = (e) => {
      _startCooldown();
      reject(e);
    };

    audio.play().catch((err) => {
      _startCooldown();
      reject(err);
    });
  });
}

// Speak short feedback text via SpeechSynthesis (no backend round-trip needed).
// Falls back silently if SpeechSynthesis is unavailable.
export function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }

    // Cancel any in-flight utterance first.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    _setActive(true);

    utterance.onend = () => {
      _startCooldown();
      resolve();
    };
    utterance.onerror = () => {
      _startCooldown();
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}
