// Frontend/src/pages/LiveRecordingPage.jsx — Figma 1-2578 pixel-perfect
// Wave animation matches Figma "Rectangle 1" waveform peak style

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

/* ── Figma MCP asset URLs ─────────────────────────────────────────────────── */
const imgEllipse5 = "https://www.figma.com/api/mcp/asset/335bf6c2-88a5-45e9-9b39-531f7ab85d20";
const imgEllipse7 = "https://www.figma.com/api/mcp/asset/e0642d18-5e31-4ab2-8d15-e0cd0d7e1411";
const imgEllipse6 = "https://www.figma.com/api/mcp/asset/b95d94a1-e0af-432b-b3fc-b7e41a5a008d";
const imgEllipse4 = "https://www.figma.com/api/mcp/asset/80fbeef3-ebc5-45c0-82f0-ddb07f81f4ab";
const imgMic      = "https://www.figma.com/api/mcp/asset/04007883-5753-4dcf-bda1-6dbf1e1e0f56";

/* ── CSS injected once ────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
  @keyframes lrp-spin  { to { transform: rotate(360deg); } }
  @keyframes lrp-blink { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes lrp-p1 { 0%{transform:scale(1);opacity:.55} 70%{transform:scale(1.55);opacity:0} 100%{transform:scale(1.55);opacity:0} }
  @keyframes lrp-p2 { 0%{transform:scale(1);opacity:.38} 70%{transform:scale(1.9); opacity:0} 100%{transform:scale(1.9); opacity:0} }
  @keyframes lrp-p3 { 0%{transform:scale(1);opacity:.20} 70%{transform:scale(2.4); opacity:0} 100%{transform:scale(2.4); opacity:0} }
  .lrp-spin  { animation: lrp-spin  1s linear infinite; }
  .lrp-blink { animation: lrp-blink 1.4s ease-in-out infinite; }
  .lrp-p1.on { animation: lrp-p1 2.4s ease-out infinite; }
  .lrp-p2.on { animation: lrp-p2 2.4s ease-out infinite 0.45s; }
  .lrp-p3.on { animation: lrp-p3 2.4s ease-out infinite 0.90s; }
`;
function injectCSS() {
  if (document.getElementById('lrp-css3')) return;
  const s = document.createElement('style'); s.id = 'lrp-css3'; s.textContent = CSS;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Wave Section — matches Figma "Rectangle 1" style exactly                  */
/*  Multiple waveform peaks in dark-navy, mid-blue, light-blue layers          */
/*  volume 0-1 controls peak height (audio-reactive)                           */
/* ─────────────────────────────────────────────────────────────────────────── */
const WaveSection = ({ volume, active }) => {
  const v = active ? Math.max(0, Math.min(1, volume)) : 0;
  const W = 1440, H = 280;

  // Build an arch path from an array of {cx, amp, width} Gaussian peaks
  // Returns SVG path string filled from bottom (H) up to the curve
  const gaussPath = (peaks, yBase, fillBottom = H) => {
    const pts = [];
    for (let x = 0; x <= W; x += 4) {
      let y = yBase;
      for (const { cx, amp, w } of peaks) {
        // Gaussian: amp * exp(-((x-cx)^2)/(2*w^2))
        const dx = x - cx;
        y -= amp * Math.exp(-(dx * dx) / (2 * w * w));
      }
      pts.push(`${x.toFixed(0)},${Math.max(0, y).toFixed(1)}`);
    }
    return `M0,${fillBottom} L${pts.join(' L')} L${W},${fillBottom} Z`;
  };

  // Base resting y-level for each layer (from bottom of SVG going up)
  const base = H * 0.90; // all peaks rise from near the bottom

  // Layer 1: outermost light-periwinkle — wide, low peaks (back)
  const layer4Peaks = [
    { cx: W * 0.28, amp: 30 + v * 55,  w: 220 + v * 80 },
    { cx: W * 0.60, amp: 22 + v * 42,  w: 180 + v * 70 },
    { cx: W * 0.82, amp: 28 + v * 50,  w: 200 + v * 75 },
  ];
  // Layer 2: light-blue
  const layer3Peaks = [
    { cx: W * 0.22, amp: 45 + v * 80,  w: 160 + v * 60 },
    { cx: W * 0.50, amp: 38 + v * 72,  w: 140 + v * 55 },
    { cx: W * 0.72, amp: 42 + v * 75,  w: 155 + v * 58 },
    { cx: W * 0.90, amp: 30 + v * 55,  w: 130 + v * 50 },
  ];
  // Layer 3: mid-blue
  const layer2Peaks = [
    { cx: W * 0.18, amp: 65 + v * 110, w: 120 + v * 45 },
    { cx: W * 0.42, amp: 58 + v * 100, w: 110 + v * 42 },
    { cx: W * 0.65, amp: 70 + v * 120, w: 125 + v * 48 },
    { cx: W * 0.85, amp: 52 + v * 90,  w: 105 + v * 40 },
  ];
  // Layer 4: dark-navy front layer — tallest, narrowest
  const layer1Peaks = [
    { cx: W * 0.15, amp: 90 + v * 150, w: 85 + v * 30 },
    { cx: W * 0.35, amp: 80 + v * 135, w: 80 + v * 28 },
    { cx: W * 0.55, amp: 100 + v * 165,w: 90 + v * 32 },
    { cx: W * 0.72, amp: 85 + v * 140, w: 82 + v * 29 },
    { cx: W * 0.88, amp: 75 + v * 125, w: 78 + v * 27 },
  ];

  // White closing curve at very bottom to merge into white card
  const closingY = H * 0.92 + v * 8;

  return (
    <div style={{
      position: 'relative', width: '100%', flexShrink: 0, overflow: 'hidden',
      background: 'linear-gradient(180deg, #cde5f8 0%, #dceefa 40%, #eaf5fd 75%, #f4f9ff 100%)',
    }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 'clamp(180px, 22vw, 280px)' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Layer 4 — periwinkle (farthest back) */}
        <path d={gaussPath(layer4Peaks, base)} fill="rgba(175,215,248,0.50)" />
        {/* Layer 3 — light blue */}
        <path d={gaussPath(layer3Peaks, base)} fill="rgba(120,183,238,0.58)" />
        {/* Layer 2 — mid blue */}
        <path d={gaussPath(layer2Peaks, base)} fill="rgba(65,138,215,0.70)" />
        {/* Layer 1 — dark navy (front, tallest) */}
        <path d={gaussPath(layer1Peaks, base)} fill="rgba(25,78,158,0.84)" />
        {/* White footer curve — seamlessly merges into white card below */}
        <path
          d={`M0,${closingY} C240,${closingY + 18 + v * 6} 480,${closingY - 12 - v * 4} 720,${closingY + 8 + v * 3} C960,${closingY + 20 + v * 6} 1200,${closingY - 8 - v * 3} ${W},${closingY + 12 + v * 4} L${W},${H} L0,${H} Z`}
          fill="white"
        />
      </svg>
    </div>
  );
};

/* ── Mic Button — Figma Ellipse 4/5/6/7 images ───────────────────────────── */
const MicButton = ({ active, paused, volume }) => {
  const v = active && !paused ? volume : 0;
  const coreScale = 1 + v * 0.10;
  const isOn = active && !paused;
  return (
    <div style={{ position: 'relative', width: '244px', height: '244px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <img src={imgEllipse5} alt="" style={{ position: 'absolute', width: '245px', height: '245px', top: '-1.5px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
      <img src={imgEllipse6} alt="" style={{ position: 'absolute', width: '195px', height: '195px', pointerEvents: 'none' }} />
      <img src={imgEllipse7} alt="" style={{ position: 'absolute', width: '147px', height: '147px', pointerEvents: 'none' }} />
      <div className={`lrp-p3 ${isOn ? 'on' : ''}`} style={{ position: 'absolute', width: '92px', height: '92px', borderRadius: '50%', background: 'rgba(87,152,236,0.18)', pointerEvents: 'none' }} />
      <div className={`lrp-p2 ${isOn ? 'on' : ''}`} style={{ position: 'absolute', width: '92px', height: '92px', borderRadius: '50%', background: 'rgba(87,152,236,0.28)', pointerEvents: 'none' }} />
      <div className={`lrp-p1 ${isOn ? 'on' : ''}`} style={{ position: 'absolute', width: '92px', height: '92px', borderRadius: '50%', background: 'rgba(87,152,236,0.38)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <img src={imgEllipse4} alt="" style={{ width: '92px', height: '92px', transform: `scale(${paused ? 0.95 : coreScale})`, transition: 'transform 0.06s, filter 0.3s', filter: paused ? 'hue-rotate(30deg) brightness(1.1)' : 'none' }} />
        <img src={imgMic} alt="mic" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '40px', height: '40px', pointerEvents: 'none', display: paused ? 'none' : 'block' }} />
        {paused && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: '5px' }}>
            <div style={{ width: '7px', height: '24px', borderRadius: '3px', backgroundColor: 'white' }} />
            <div style={{ width: '7px', height: '24px', borderRadius: '3px', backgroundColor: 'white' }} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Instruction Player (shown when paused) ──────────────────────────────── */
const InstructionPlayer = ({ instructions, onResume, onStop, isProcessing }) => {
  const [currentId, setCurrentId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(new Audio());
  const saved  = instructions.filter(i => i.status === 'saved' && i.audioUrl);
  const saving = instructions.filter(i => i.status === 'saving').length;
  const F = { fontFamily: 'Urbanist, sans-serif' };
  useEffect(() => { if (!currentId && saved.length > 0) setCurrentId(saved[0].id); }, [saved.length, currentId]);
  const curr = saved.find(i => i.id === currentId) || saved[0] || null;
  const currIdx = saved.indexOf(curr);
  useEffect(() => {
    const a = audioRef.current;
    if (!curr?.audioUrl) { a.pause(); setIsPlaying(false); setCurrentTime(0); setDuration(0); return; }
    a.pause(); a.src = curr.audioUrl; a.load(); setIsPlaying(false); setCurrentTime(0); setDuration(0);
    const onMeta  = () => setDuration(a.duration || 0);
    const onTime  = () => setCurrentTime(a.currentTime);
    const onEnded = () => { setIsPlaying(false); if (currIdx < saved.length - 1) setCurrentId(saved[currIdx + 1].id); };
    a.addEventListener('loadedmetadata', onMeta); a.addEventListener('timeupdate', onTime); a.addEventListener('ended', onEnded);
    return () => { a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnded); a.pause(); };
  }, [curr?.audioUrl]); // eslint-disable-line
  const toggle = () => { if (!curr) return; if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } else audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {}); };
  const goTo   = id => { audioRef.current.pause(); setIsPlaying(false); setCurrentId(id); };
  const fmt    = s => isNaN(s) || !s ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  return (
    <div style={{ width: '100%', maxWidth: '640px', background: '#fff', borderRadius: '26px', border: '1px solid #e8e8ed', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden', ...F }}>
      <div style={{ padding: '16px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#343434', margin: 0 }}>⏸ Paused — Review Instructions</p>
          <p style={{ fontSize: '13px', color: '#b45309', margin: '3px 0 0' }}>{saved.length} ready{saving > 0 && ` · ${saving} generating…`}</p>
        </div>
        {saving > 0 && <Loader2 className="lrp-spin" style={{ width: '16px', height: '16px', color: '#f59e0b' }} />}
      </div>
      <div style={{ maxHeight: '210px', overflowY: 'auto', background: '#fafafa', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {instructions.length === 0
          ? <p style={{ fontSize: '14px', color: '#6a7380', textAlign: 'center', padding: '24px 0', margin: 0 }}>No instructions yet. Resume and keep talking.</p>
          : instructions.map((inst, i) => {
              const isActive = inst.id === currentId, ok = inst.status === 'saved' && inst.audioUrl;
              return (
                <div key={inst.id} onClick={() => ok && goTo(inst.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '14px', border: `1px solid ${isActive && ok ? '#b3d4f5' : '#e8e8ed'}`, backgroundColor: isActive && ok ? '#f0f7ff' : '#fff', cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.6 }}>
                  <div style={{ flexShrink: 0, marginTop: '2px', width: '18px' }}>
                    {inst.status === 'saving' && <Loader2 className="lrp-spin" style={{ width: '14px', height: '14px', color: '#6a7380' }} />}
                    {inst.status === 'error'  && <AlertCircle style={{ width: '14px', height: '14px', color: '#ef4444' }} />}
                    {inst.status === 'saved'  && (isActive && isPlaying ? <Volume2 style={{ width: '14px', height: '14px', color: '#57a0ef' }} /> : <CheckCircle2 style={{ width: '14px', height: '14px', color: isActive ? '#57a0ef' : '#129578' }} />)}
                  </div>
                  <span style={{ fontSize: '14px', lineHeight: 1.5, flex: 1 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#6a7380', marginRight: '4px' }}>{i + 1}.</span>
                    <span style={{ color: isActive && ok ? '#1674cc' : '#343434', fontWeight: isActive ? 600 : 400 }}>{inst.text}</span>
                  </span>
                </div>
              );
            })}
      </div>
      {saved.length > 0 && (
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f4' }}>
          <p style={{ fontSize: '12px', color: '#6a7380', margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {curr ? `${currIdx + 1} / ${saved.length} — ${curr.text.slice(0, 65)}${curr.text.length > 65 ? '…' : ''}` : 'Select instruction'}
          </p>
          <div onClick={e => { if (!duration) return; const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration; }}
            style={{ width: '100%', height: '6px', backgroundColor: '#e8e8ed', borderRadius: '3px', cursor: 'pointer', marginBottom: '6px' }}>
            <div style={{ height: '100%', backgroundColor: '#3b82f6', borderRadius: '3px', width: `${duration ? (currentTime / duration) * 100 : 0}%`, transition: 'width 0.1s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6a7380', marginBottom: '14px' }}><span>{fmt(currentTime)}</span><span>{fmt(duration)}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <button onClick={() => currIdx > 0 && goTo(saved[currIdx - 1].id)} disabled={currIdx <= 0} style={{ background: 'none', border: 'none', cursor: currIdx <= 0 ? 'not-allowed' : 'pointer', opacity: currIdx <= 0 ? 0.3 : 1, padding: '6px' }}><SkipBack style={{ width: '20px', height: '20px', color: '#343434' }} /></button>
            <button onClick={toggle} disabled={!curr} style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', cursor: curr ? 'pointer' : 'not-allowed', background: 'linear-gradient(135deg,#3b82f6,#60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,0.40)', opacity: curr ? 1 : 0.4 }}>
              {isPlaying ? <Pause style={{ width: '18px', height: '18px', color: '#fff' }} /> : <Play style={{ width: '18px', height: '18px', color: '#fff', marginLeft: '2px' }} />}
            </button>
            <button onClick={() => currIdx < saved.length - 1 && goTo(saved[currIdx + 1].id)} disabled={currIdx >= saved.length - 1} style={{ background: 'none', border: 'none', cursor: currIdx >= saved.length - 1 ? 'not-allowed' : 'pointer', opacity: currIdx >= saved.length - 1 ? 0.3 : 1, padding: '6px' }}><SkipForward style={{ width: '20px', height: '20px', color: '#343434' }} /></button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '16px 24px 24px' }}>
        <button onClick={() => { audioRef.current.pause(); onResume(); }} disabled={isProcessing}
          style={{ height: '59px', borderRadius: '51px', border: '1.064px solid #1e1e1e', cursor: 'pointer', backgroundColor: '#fff', color: '#242424', ...F, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span className="lrp-blink" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} /> Resume
        </button>
        <button onClick={() => { audioRef.current.pause(); onStop(); }} disabled={isProcessing}
          style={{ height: '59px', borderRadius: '51px', border: 'none', cursor: 'pointer', background: 'linear-gradient(101.469deg,#FF3A3A 1.33%,#D61A0C 127.72%)', color: '#fff', ...F, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(255,58,58,0.35)' }}>
          {isProcessing ? <><Loader2 className="lrp-spin" style={{ width: '16px', height: '16px' }} /> Saving…</> : 'Stop & Save'}
        </button>
      </div>
    </div>
  );
};

/* ── Main Page ────────────────────────────────────────────────────────────── */
const LiveRecordingPage = ({ recordingName, setCurrentPage, onLogout }) => {
  const { setCurrentJob, showNotification } = useApp();
  const [isRecording, setIsRecording]   = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [timer, setTimer]               = useState(0);
  const [segments, setSegments]         = useState([]);
  const [interimText, setInterimText]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError]               = useState(null);
  const [instructions, setInstructions] = useState([]);
  const [volume, setVolume]             = useState(0);

  const recognitionRef  = useRef(null);
  const timerRef        = useRef(null);
  const timerValRef     = useRef(0);
  const isRecRef        = useRef(false);
  const fullTxRef       = useRef('');
  const filterQRef      = useRef([]);
  const filteringRef    = useRef(false);
  const pendingTTSRef   = useRef(0);
  const instructionsRef = useRef([]);
  const audioCtxRef     = useRef(null);
  const analyserRef     = useRef(null);
  const animFrameRef    = useRef(null);
  const streamRef       = useRef(null);
  const filterRunRef    = useRef(null);

  useEffect(() => { instructionsRef.current = instructions; }, [instructions]);
  useEffect(() => { injectCSS(); }, []);

  const fmtTime = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
  };
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimer(t => { const n = t + 1; timerValRef.current = n; return n; }), 1000);
  }, []);
  const stopTimer = useCallback(() => clearInterval(timerRef.current), []);

  const startAudioAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx; analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => { analyser.getByteFrequencyData(data); setVolume(Math.min(1, data.reduce((a,b) => a+b,0) / data.length / 75)); animFrameRef.current = requestAnimationFrame(tick); };
      tick();
    } catch (e) { console.warn('[LRP] Audio analyser unavailable:', e.message); }
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current); setVolume(0);
    try { audioCtxRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current = null; analyserRef.current = null; streamRef.current = null;
  }, []);

  const genTTS = useCallback(async (id, text) => {
    pendingTTSRef.current++;
    try {
      const r = await apiService.processLiveText(text);
      const url = r?.instructions?.[0]?.steps?.[0]?.audio || null;
      setInstructions(p => p.map(i => i.id === id ? { ...i, audioUrl: url, status: url ? 'saved' : 'error' } : i));
    } catch { setInstructions(p => p.map(i => i.id === id ? { ...i, status: 'error' } : i)); }
    finally { pendingTTSRef.current--; }
  }, []);

  const runFilter = useCallback(async () => {
    if (filteringRef.current || filterQRef.current.length === 0) return;
    filteringRef.current = true;
    const text = filterQRef.current.join(' ').trim(); filterQRef.current = [];
    try {
      const r = await apiService.filterLiveChunk(text);
      const found = r?.instructions || [];
      if (found.length > 0) {
        const set = new Set(found.map(s => s.toLowerCase()));
        setSegments(p => p.map(s => set.has(s.text.toLowerCase()) ? { ...s, isInstruction: true } : s));
        const items = found.map(t => ({ id: Date.now() + Math.random(), text: t, audioUrl: null, status: 'saving' }));
        setInstructions(p => [...p, ...items]);
        items.forEach(it => genTTS(it.id, it.text));
      }
    } catch {}
    finally { filteringRef.current = false; if (filterQRef.current.length > 0) filterRunRef.current?.(); }
  }, [genTTS]);
  useEffect(() => { filterRunRef.current = runFilter; }, [runFilter]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Live speech not supported. Please use Chrome or Edge.'); return; }
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { const tr = t.trim(); if (tr) { fullTxRef.current += ' ' + tr; setSegments(p => [...p, { text: tr, isInstruction: false }]); filterQRef.current.push(tr); filterRunRef.current?.(); } setInterimText(''); } else interim += t;
      }
      setInterimText(interim);
    };
    rec.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Mic error: ' + e.error); };
    rec.onend   = () => { if (isRecRef.current) try { rec.start(); } catch {} };
    recognitionRef.current = rec;
    return () => { clearInterval(timerRef.current); stopAudioAnalyser(); };
  }, []); // eslint-disable-line

  const startRec = useCallback(() => {
    setError(null); setSegments([]); setInterimText(''); setInstructions([]);
    fullTxRef.current = ''; filterQRef.current = []; filteringRef.current = false;
    pendingTTSRef.current = 0; timerValRef.current = 0; isRecRef.current = true;
    setIsRecording(true); setIsPaused(false); setTimer(0);
    startTimer(); startAudioAnalyser();
    try { recognitionRef.current?.start(); } catch {}
  }, [startTimer, startAudioAnalyser]);
  useEffect(() => { const t = setTimeout(startRec, 300); return () => clearTimeout(t); }, []); // eslint-disable-line

  const handlePause = useCallback(async () => {
    isRecRef.current = false; stopTimer(); stopAudioAnalyser();
    setIsRecording(false); setIsPaused(true); setInterimText('');
    try { recognitionRef.current?.stop(); } catch {}
    if (filterQRef.current.length > 0) filterRunRef.current?.();
  }, [stopTimer, stopAudioAnalyser]);

  const handleResume = useCallback(() => {
    isRecRef.current = true; setIsPaused(false); setIsRecording(true);
    startTimer(); startAudioAnalyser();
    try { recognitionRef.current?.start(); } catch {}
  }, [startTimer, startAudioAnalyser]);

  const handleStop = useCallback(async () => {
    isRecRef.current = false; stopTimer(); stopAudioAnalyser();
    setIsRecording(false); setIsPaused(false); setInterimText('');
    try { recognitionRef.current?.stop(); } catch {}
    const transcript = fullTxRef.current.trim();
    if (!transcript && instructionsRef.current.length === 0) { showNotification('No speech detected.', 'warning'); setCurrentPage('dashboard'); return; }
    setIsProcessing(true);
    try {
      let waited = 0;
      while (pendingTTSRef.current > 0 && waited < 8000) { await new Promise(r => setTimeout(r, 250)); waited += 250; }
      let finalInstructions = instructionsRef.current.filter(i => i.status === 'saved' && i.audioUrl);
      if (finalInstructions.length === 0 && transcript) {
        showNotification('Extracting instructions from transcript…', 'info');
        try {
          const r = await apiService.processLiveText(transcript);
          if (r?.instructions?.length > 0) finalInstructions = r.instructions.map((inst, idx) => ({ id: `stop_${idx}`, text: inst.instruction || inst.steps?.[0]?.text || '', audioUrl: inst.steps?.[0]?.audio || null, status: 'saved' })).filter(i => i.audioUrl);
        } catch (e) { console.error('[LRP] Final extraction failed:', e); }
      }
      if (finalInstructions.length === 0) { showNotification('No actionable instructions found.', 'warning'); setCurrentPage('dashboard'); return; }
      const job = { id: `live_${Date.now()}`, name: `${recordingName || 'Recording'}.mp3`, type: 'Live Transcription', duration: fmtTime(timerValRef.current), status: 'Completed', transcription: transcript, fromLive: true, instructions: finalInstructions.map(i => ({ instruction: i.text, steps: [{ text: i.text, audio: i.audioUrl }] })), createdAt: new Date().toISOString() };
      await setCurrentJob(job);
      showNotification(`${finalInstructions.length} instruction${finalInstructions.length !== 1 ? 's' : ''} saved — opening workspace`, 'success');
      setTimeout(() => setCurrentPage('segment'), 500);
    } catch (err) { showNotification('Processing failed: ' + (err.message || 'Unknown error'), 'error'); setCurrentPage('dashboard'); }
    finally { setIsProcessing(false); }
  }, [recordingName, setCurrentJob, showNotification, setCurrentPage, stopTimer, stopAudioAnalyser]); // eslint-disable-line

  const savedCount  = instructions.filter(i => i.status === 'saved').length;
  const savingCount = instructions.filter(i => i.status === 'saving').length;
  const F = { fontFamily: 'Urbanist, sans-serif' };

  return (
    <div style={{ minHeight: '100%', backgroundColor: '#f6f6f9', ...F, display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 36px 0' }}>
        <button onClick={() => setCurrentPage('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M14 17L8 11L14 5" stroke="#343434" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ ...F, fontSize: '28px', fontWeight: 700, color: '#343434', lineHeight: 1.3 }}>Home</span>
        </button>
        {onLogout && (
          <button onClick={() => { localStorage.removeItem('rehear_token'); localStorage.removeItem('rehear_user'); if (onLogout) onLogout(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '40px', border: '1px solid #e0e0e8', backgroundColor: '#fff', cursor: 'pointer', ...F, fontSize: '14px', fontWeight: 600, color: '#6a7380', transition: 'all 0.18s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fff0f0'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ffcdd2'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#6a7380'; e.currentTarget.style.borderColor = '#e0e0e8'; }}>
            <LogOut style={{ width: '16px', height: '16px' }} />
            Log out
          </button>
        )}
      </div>

      {/* ── Wave section — Figma "Rectangle 1" Gaussian peak style ───────── */}
      <WaveSection volume={volume} active={isRecording && !isPaused} />

      {/* ── White card ───────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#fff', flex: 1, padding: '0 56px 40px', display: 'flex', flexDirection: 'column', marginTop: '-3px' }}>

        {/* Session name + counter row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '22px', marginBottom: '0' }}>
          <p style={{ ...F, fontSize: 'clamp(16px,1.8vw,27px)', fontWeight: 700, color: '#343434', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '380px' }}>
            {recordingName || 'New Recording'}
          </p>
          {(isRecording || isPaused) && instructions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ ...F, fontSize: '14px', fontWeight: 700, color: '#343434' }}>{savedCount}</span>
              <span style={{ ...F, fontSize: '14px', color: '#6a7380' }}>instruction{savedCount !== 1 ? 's' : ''} captured</span>
              {savingCount > 0 && <Loader2 className="lrp-spin" style={{ width: '14px', height: '14px', color: '#3b82f6' }} />}
            </div>
          )}
        </div>

        {/* Center col: Mic + Timer + Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', paddingTop: '8px' }}>
          <MicButton active={isRecording || isPaused} paused={isPaused} volume={volume} />

          {/* Timer — Figma: DM Sans Medium 35px */}
          <div style={{ fontFamily: '"DM Sans", monospace', fontSize: 'clamp(28px,2.8vw,35px)', fontWeight: 500, color: '#000', letterSpacing: '2px', lineHeight: 1, fontVariationSettings: '"opsz" 14' }}>
            {fmtTime(timer)}
          </div>

          {/* Pause + Stop — exact Figma sizes */}
          {!isPaused && !isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12.77px', marginTop: '4px' }}>
              <button onClick={handlePause}
                style={{ height: '59.592px', width: '244.751px', borderRadius: '51.078px', border: '1.064px solid #1e1e1e', backgroundColor: '#fff', color: '#242424', ...F, fontSize: '18.12px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.18s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f6f6f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                Pause
              </button>
              <button onClick={handleStop}
                style={{ height: '59.592px', width: '244.751px', borderRadius: '51.078px', border: 'none', background: 'linear-gradient(101.469deg,#FF3A3A 1.33%,#D61A0C 127.72%)', color: '#fff', ...F, fontSize: '18.12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 22px rgba(255,58,58,0.40)', transition: 'opacity 0.18s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                Stop
              </button>
            </div>
          )}

          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3b82f6' }}>
              <Loader2 className="lrp-spin" style={{ width: '22px', height: '22px' }} />
              <span style={{ ...F, fontSize: '15px', fontWeight: 600 }}>Saving to workspace…</span>
            </div>
          )}
          {error && (
            <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '10px 18px' }}>
              <p style={{ ...F, fontSize: '13px', color: '#ef4444', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Paused: instruction player */}
        {isPaused && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <InstructionPlayer instructions={instructions} onResume={handleResume} onStop={handleStop} isProcessing={isProcessing} />
          </div>
        )}

        {/* Live transcript — Figma: white card rounded-26 text-25px */}
        {!isPaused && (segments.length > 0 || interimText) && (
          <div style={{ backgroundColor: '#fff', borderRadius: '26.087px', border: '1px solid #f0f0f4', padding: '28px 38px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginTop: '16px' }}>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {segments.map((seg, i) => (
                <p key={i} style={{ ...F, fontSize: 'clamp(14px,1.7vw,25.752px)', fontWeight: 500, color: seg.isInstruction ? '#1674cc' : '#343434', margin: 0, lineHeight: 1.3, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  {seg.isInstruction && <span style={{ flexShrink: 0, width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '7px' }} />}
                  {seg.text}
                </p>
              ))}
              {interimText && <p style={{ ...F, fontSize: 'clamp(14px,1.7vw,25.752px)', fontWeight: 500, color: '#c1c1c8', fontStyle: 'italic', margin: 0, lineHeight: 1.3 }}>{interimText}…</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveRecordingPage;
