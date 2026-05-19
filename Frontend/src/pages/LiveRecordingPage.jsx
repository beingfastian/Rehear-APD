// Frontend/src/pages/LiveRecordingPage.jsx
// Pixel-perfect implementation from Figma node 1-2497
// Asset URLs served by Figma MCP local server

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// ── Wave Section — exact paths extracted from Figma SVG root file ─────────────
// Figma canvas: 1920×1190, wave content: x=413–1840, y=190–437
const WaveSection = () => (
  <svg
    viewBox="413 190 1427 240"
    style={{ display:'block', width:'100%', height:'auto' }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      {/* Glow blob filter — matches Figma filter0_f / filter1_f */}
      <filter id="lrp-f0" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="42"/>
      </filter>
      <filter id="lrp-f1" x="-20%" y="-60%" width="140%" height="220%">
        <feGaussianBlur stdDeviation="52"/>
      </filter>
      <filter id="lrp-f2" x="-30%" y="-60%" width="160%" height="220%">
        <feGaussianBlur stdDeviation="18"/>
      </filter>
    </defs>

    {/* Background fill — #F6F6F9 */}
    <rect x="413" y="190" width="1427" height="280" fill="#F6F6F9"/>

    {/* Glow blob 1 — left peak (from filter0_f_192_8139, opacity 0.96) */}
    <path opacity="0.96" filter="url(#lrp-f0)"
      d="M979.586 284.905C983.045 323.878 909.842 255.469 871.696 258.654C833.55 261.839 782.932 346.519 779.474 307.545C776.015 268.572 826.706 199.932 864.852 196.747C902.998 193.563 976.127 245.932 979.586 284.905Z"
      fill="#5AADF4"/>

    {/* Glow blob 2 — wide center (from filter1_f_192_8139, opacity 0.61) */}
    <path opacity="0.61" filter="url(#lrp-f1)"
      d="M1838.44 481.651C1838.51 554.209 1375.19 400.563 1104.97 398C834.752 395.437 417.244 551.693 417.171 479.135C417.098 406.578 816.263 291.337 1086.48 293.9C1356.7 296.463 1838.36 409.094 1838.44 481.651Z"
      fill="#5AADF4"/>

    {/* Glow blob 3 — right peak (from filter2_f_192_8139) */}
    <path filter="url(#lrp-f2)"
      d="M1562.98 323.501C1537.48 312.92 1471.84 273.176 1436.25 264.932C1400.67 256.688 1344.97 280 1313.47 282C1338.47 271.5 1430.89 235.756 1466.48 244.001C1502.06 252.245 1529.98 296.001 1562.98 323.501Z"
      fill="#5AADF4"/>

    {/* === Wave layers (clip3_192_8139) === */}

    {/* Layer: Periwinkle (#C6D5FB) — left hump fill */}
    <path
      d="M735.496 319.882C737.609 316.715 747.769 310.468 751.482 307.734C786.875 281.676 802.379 228.06 838.656 204.116C889.358 170.651 938.885 232.902 978.018 257.59C991.698 266.219 1015.29 277.666 1031.43 281.097L1024.15 281.048C965.09 282.954 918.268 250.871 861.059 263.953C829.072 271.268 799.612 294.812 769.888 308.21C763.235 311.209 752.314 315.889 745.212 317.268L735.496 319.882Z"
      fill="#C6D5FB"/>

    {/* Layer: Medium blue (#5AADF4) — left hump highlight */}
    <path
      d="M745.213 317.268C747.433 312.623 762.771 306.22 769.017 301.124C780.854 291.089 797.255 276.404 807.269 265.274C873.764 191.361 926.748 248.962 997.258 274.475C1002.78 276.474 1017.69 280.941 1024.16 281.048C965.091 282.954 918.269 250.871 861.06 263.953C829.073 271.268 799.613 294.812 769.889 308.21C763.236 311.209 752.314 315.889 745.213 317.268Z"
      fill="#5AADF4"/>

    {/* Layer: Periwinkle (#C6D5FB) — right hump fill */}
    <path
      d="M1324.94 289.624C1328.25 286.842 1357.84 278.751 1364.46 276.224C1393.14 265.454 1423.41 250.839 1454.79 253.244C1491.14 256.03 1513.3 286.649 1537.63 309.809C1543.65 315.537 1561.76 326.586 1564.77 331.91L1554.06 329.009C1542.28 325.394 1529.06 319.53 1517.84 314.333C1488.41 299.887 1462.71 290.699 1429.88 287.387C1396.45 284.012 1360.04 293.159 1327.68 289.633L1324.94 289.624Z"
      fill="#C6D5FB"/>

    {/* Layer: Medium blue (#5AADF4) — right hump highlight */}
    <path
      d="M1327.68 289.633C1334.39 289.559 1360.97 283.522 1368.15 281.818C1437.03 265.486 1462 262.647 1519.47 304.891C1525.33 309.252 1531.37 313.352 1537.59 317.18C1541.98 319.896 1551.8 324.799 1554.06 329.009C1542.28 325.394 1529.06 319.53 1517.84 314.333C1488.41 299.887 1462.71 290.699 1429.88 287.387C1396.45 284.012 1360.04 293.159 1327.68 289.633Z"
      fill="#5AADF4"/>

    {/* Layer: Dark blue line (#3187D8) — the main front arch spanning full width */}
    <path
      d="M745.213 317.268C752.314 315.889 763.236 311.209 769.888 308.21C799.613 294.812 829.073 271.268 861.06 263.953C918.269 250.871 965.091 282.954 1024.16 281.048L1031.43 281.097C1052.16 282.237 1072.28 281.629 1092.98 281.393C1120.44 281.014 1147.89 281.117 1175.34 281.703C1206.67 282.604 1238.48 283.853 1269.76 285.543C1288.49 286.555 1305.83 289.514 1324.94 289.624L1327.68 289.633C1360.04 293.159 1396.45 284.012 1429.88 287.387C1462.71 290.699 1488.41 299.887 1517.84 314.333C1529.06 319.53 1542.28 325.394 1554.06 329.009L1564.77 331.911C1608.8 346.003 1653.12 358.383 1697.29 373.199C1746.18 389.599 1791.98 408.354 1839.97 426.756V437.409C1681.23 365.813 1512.21 319.632 1339.12 300.561C1331.37 301.264 1323.69 301.31 1315.99 300.066L1316 301.669C1297.73 300.302 1282.5 296.5 1260.65 294.649C1258.59 294.277 1250.34 292.649 1247 292.5L1163.5 289.047C1157.49 288.8 1152.43 289.161 1148.28 289.047C1111.44 288.045 1074.66 289.782 1038 290.041H1037.22C857.917 297.805 680.743 332.008 511.436 391.542C479.704 402.83 443.593 416.379 412.973 430.132V421.659C423.864 418.443 446.672 407.743 458.666 403.33C486.12 393.23 513.148 382.785 540.94 373.394C605.112 351.711 670.428 337.665 735.497 319.882L745.213 317.268Z"
      fill="#3187D8"/>

    {/* Dark blue right extension (#3187D8) */}
    <path
      d="M1289.02 291C1297.11 292.238 1304.35 293.7 1312.5 293C1494.52 311.981 1673.08 361.936 1840 433.195V435.642C1835.47 435.66 1828.6 437.569 1824.61 436.83C1827.33 435.38 1834.84 435.701 1837.33 434.069C1833.85 431.761 1822.79 427.442 1818.51 425.662C1805.15 420.073 1791.71 414.645 1778.2 409.378C1729.69 390.643 1680.25 374.15 1630.04 359.959C1623.5 358.084 1616.38 356.369 1609.94 354.339C1557.34 337.755 1502.52 333.865 1448.65 322.39C1441.93 320.959 1424.95 316.946 1418.62 316.455C1376.31 313.176 1330.58 302.352 1289.02 298.096L1289.02 291Z"
      fill="#3187D8"/>

    {/* White card — fills bottom of viewBox from y=424 down */}
    <path
      d="M413 424.358C413 423.885 413.369 423.489 413.84 423.443C950.506 370.985 1262.08 368.855 1839.16 423.445C1839.63 423.49 1840 423.887 1840 424.36V430H413V424.358Z"
      fill="white"/>
  </svg>
);

// ── Inject DM Sans font + keyframe animations ─────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&display=swap');

  @keyframes lrp-pulse1 {
    0%   { transform: scale(1);   opacity: 0.7; }
    60%  { transform: scale(1.45); opacity: 0;  }
    100% { transform: scale(1.45); opacity: 0;  }
  }
  @keyframes lrp-pulse2 {
    0%   { transform: scale(1);   opacity: 0.5; }
    60%  { transform: scale(1.7); opacity: 0;   }
    100% { transform: scale(1.7); opacity: 0;   }
  }
  @keyframes lrp-pulse3 {
    0%   { transform: scale(1);   opacity: 0.3; }
    60%  { transform: scale(2.0); opacity: 0;   }
    100% { transform: scale(2.0); opacity: 0;   }
  }
  .lrp-p1 { animation: lrp-pulse1 2.4s ease-out infinite; }
  .lrp-p2 { animation: lrp-pulse2 2.4s ease-out infinite 0.45s; }
  .lrp-p3 { animation: lrp-pulse3 2.4s ease-out infinite 0.9s; }
  @keyframes lrp-spin  { to { transform: rotate(360deg); } }
  .lrp-spin { animation: lrp-spin 1s linear infinite; }
  @keyframes lrp-blink { 0%,100%{opacity:1} 50%{opacity:.35} }
  .lrp-blink { animation: lrp-blink 1.4s ease-in-out infinite; }
`;

function injectStyle() {
  if (document.getElementById('lrp-global')) return;
  const el = document.createElement('style');
  el.id = 'lrp-global';
  el.textContent = GLOBAL_STYLE;
  document.head.appendChild(el);
}

// ── Mic button component — pure CSS + inline SVG (no external assets) ─────────
const MicButton = ({ active, paused }) => {
  const SZ = 220;
  const pulse = active && !paused;
  return (
    <div style={{ position:'relative', width:SZ, height:SZ, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
      {/* Pulse rings */}
      {pulse && (
        <>
          <div className="lrp-p3" style={{ position:'absolute', width:'58%', height:'58%', borderRadius:'50%', backgroundColor:'rgba(49,135,216,0.14)' }}/>
          <div className="lrp-p2" style={{ position:'absolute', width:'58%', height:'58%', borderRadius:'50%', backgroundColor:'rgba(49,135,216,0.20)' }}/>
          <div className="lrp-p1" style={{ position:'absolute', width:'58%', height:'58%', borderRadius:'50%', backgroundColor:'rgba(49,135,216,0.28)' }}/>
        </>
      )}
      {/* Outer ring */}
      <div style={{ position:'absolute', width:'102%', height:'102%', borderRadius:'50%', border:'1.5px solid rgba(44,78,197,0.13)', boxSizing:'border-box', opacity: paused?0.5:1 }}/>
      {/* Mid ring */}
      <div style={{ position:'absolute', width:'81%', height:'81%', borderRadius:'50%', border:'1.5px solid rgba(44,78,197,0.25)', boxSizing:'border-box', opacity: paused?0.5:1 }}/>
      {/* Inner ring */}
      <div style={{ position:'absolute', width:'61%', height:'61%', borderRadius:'50%', border:'1.5px solid rgba(44,78,197,0.45)', boxSizing:'border-box', opacity: paused?0.5:1 }}/>
      {/* Core blue circle */}
      <div style={{ position:'absolute', width:'49%', height:'49%', borderRadius:'50%', background:'#3187D8', boxShadow:'0 4px 22px rgba(49,135,216,0.52)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2, filter: paused?'hue-rotate(30deg) saturate(0.7)':'none', transition:'filter 0.3s' }}>
        {paused ? (
          <svg viewBox="0 0 28 28" fill="none" style={{ width:'42%', height:'42%' }}>
            <rect x="5" y="4" width="6" height="20" rx="2.5" fill="white"/>
            <rect x="17" y="4" width="6" height="20" rx="2.5" fill="white"/>
          </svg>
        ) : (
          <svg viewBox="0 0 50 62" fill="none" style={{ width:'46%', height:'46%' }}>
            <rect x="13" y="1" width="24" height="32" rx="12" stroke="white" strokeWidth="4.5" fill="none"/>
            <path d="M3 24v4c0 12.2 9.8 22 22 22s22-9.8 22-22v-4" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
            <line x1="25" y1="50" x2="25" y2="60" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
            <line x1="16" y1="60" x2="34" y2="60" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
          </svg>
        )}
      </div>
    </div>
  );
};

// ── Instruction Player Panel ──────────────────────────────────────────────────
const InstructionPlayer = ({ instructions, onResume, onStop, isProcessing }) => {
  const [currentId, setCurrentId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(new Audio());

  const saved = instructions.filter(i => i.status === 'saved' && i.audioUrl);
  const saving = instructions.filter(i => i.status === 'saving').length;

  useEffect(() => { if (!currentId && saved.length > 0) setCurrentId(saved[0].id); }, [saved.length, currentId]);

  const curr = saved.find(i => i.id === currentId) || saved[0] || null;
  const currIdx = saved.indexOf(curr);

  useEffect(() => {
    const a = audioRef.current;
    if (!curr?.audioUrl) { a.pause(); setIsPlaying(false); setCurrentTime(0); setDuration(0); return; }
    a.pause(); a.src = curr.audioUrl; a.load(); setIsPlaying(false); setCurrentTime(0); setDuration(0);
    const onMeta = () => setDuration(a.duration || 0);
    const onTime = () => setCurrentTime(a.currentTime);
    const onEnded = () => { setIsPlaying(false); if (currIdx < saved.length - 1) setCurrentId(saved[currIdx + 1].id); };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnded);
    return () => { a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnded); a.pause(); };
  }, [curr?.audioUrl]); // eslint-disable-line

  const toggle = () => { if (!curr) return; if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } else audioRef.current.play().then(() => setIsPlaying(true)).catch(() => { }); };
  const goTo = id => { audioRef.current.pause(); setIsPlaying(false); setCurrentId(id); };
  const goPrev = () => currIdx > 0 && goTo(saved[currIdx - 1].id);
  const goNext = () => currIdx < saved.length - 1 && goTo(saved[currIdx + 1].id);
  const seek = e => { if (!duration) return; const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration; };
  const fmt = s => isNaN(s) || !s ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const F = { fontFamily: 'Urbanist, sans-serif' };

  return (
    <div style={{ width: '100%', maxWidth: '620px', background: '#fff', borderRadius: '26px', border: '1px solid #e8e8ed', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden', ...F }}>
      <div style={{ padding: '16px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#343434', margin: 0 }}>⏸ Paused — Review Instructions</p>
          <p style={{ fontSize: '13px', color: '#b45309', margin: '3px 0 0' }}>{saved.length} ready{saving > 0 && ` · ${saving} generating audio…`}</p>
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
                  {inst.status === 'error' && <AlertCircle style={{ width: '14px', height: '14px', color: '#ef4444' }} />}
                  {inst.status === 'saved' && (isActive && isPlaying ? <Volume2 style={{ width: '14px', height: '14px', color: '#57a0ef' }} /> : <CheckCircle2 style={{ width: '14px', height: '14px', color: isActive ? '#57a0ef' : '#129578' }} />)}
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
            {curr ? `${currIdx + 1} / ${saved.length} — ${curr.text.slice(0, 65)}${curr.text.length > 65 ? '…' : ''}` : 'Select an instruction'}
          </p>
          <div onClick={seek} style={{ width: '100%', height: '6px', backgroundColor: '#e8e8ed', borderRadius: '3px', cursor: 'pointer', marginBottom: '6px' }}>
            <div style={{ height: '100%', backgroundColor: '#57a0ef', borderRadius: '3px', width: `${duration ? (currentTime / duration) * 100 : 0}%`, transition: 'width 0.1s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6a7380', marginBottom: '14px' }}><span>{fmt(currentTime)}</span><span>{fmt(duration)}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <button onClick={goPrev} disabled={currIdx <= 0} style={{ background: 'none', border: 'none', cursor: currIdx <= 0 ? 'not-allowed' : 'pointer', opacity: currIdx <= 0 ? 0.3 : 1, padding: '6px' }}>
              <SkipBack style={{ width: '20px', height: '20px', color: '#343434' }} />
            </button>
            <button onClick={toggle} disabled={!curr} style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', cursor: curr ? 'pointer' : 'not-allowed', background: 'linear-gradient(101deg,#FF3A3A,#D61A0C)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255,58,58,0.40)', opacity: curr ? 1 : 0.4 }}>
              {isPlaying ? <Pause style={{ width: '18px', height: '18px', color: '#fff' }} /> : <Play style={{ width: '18px', height: '18px', color: '#fff', marginLeft: '2px' }} />}
            </button>
            <button onClick={goNext} disabled={currIdx >= saved.length - 1} style={{ background: 'none', border: 'none', cursor: currIdx >= saved.length - 1 ? 'not-allowed' : 'pointer', opacity: currIdx >= saved.length - 1 ? 0.3 : 1, padding: '6px' }}>
              <SkipForward style={{ width: '20px', height: '20px', color: '#343434' }} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '16px 24px 24px' }}>
        <button onClick={() => { audioRef.current.pause(); onResume(); }} disabled={isProcessing}
          style={{ height: '52px', borderRadius: '52px', border: '1.5px solid #1e1e1e', cursor: 'pointer', backgroundColor: '#fff', color: '#242424', ...F, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span className="lrp-blink" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
          Resume
        </button>
        <button onClick={() => { audioRef.current.pause(); onStop(); }} disabled={isProcessing}
          style={{ height: '52px', borderRadius: '52px', border: 'none', cursor: 'pointer', background: 'linear-gradient(101.469deg,#FF3A3A 1.33%,#D61A0C 127.72%)', color: '#fff', ...F, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(255,58,58,0.35)' }}>
          {isProcessing ? <><Loader2 className="lrp-spin" style={{ width: '16px', height: '16px' }} /> Saving…</> : 'Stop & Save'}
        </button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const LiveRecordingPage = ({ recordingName, setCurrentPage }) => {
  const { setCurrentJob, showNotification, processLiveTranscription } = useApp();

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timer, setTimer] = useState(0);
  const [segments, setSegments] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [instructions, setInstructions] = useState([]);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const timerValRef = useRef(0);
  const isRecRef = useRef(false);
  const fullTxRef = useRef('');
  const filterQRef = useRef([]);
  const filteringRef = useRef(false);
  const pendingTTSRef = useRef(0);
  const instructionsRef = useRef([]);

  useEffect(() => { instructionsRef.current = instructions; }, [instructions]);
  useEffect(() => { injectStyle(); }, []);

  const fmtTime = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`; };

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimer(t => { const n = t + 1; timerValRef.current = n; return n; }), 1000);
  }, []);
  const stopTimer = useCallback(() => clearInterval(timerRef.current), []);

  const genTTS = useCallback(async (id, text) => {
    pendingTTSRef.current++;
    try {
      const r = await apiService.processLiveText(text);
      const url = r?.instructions?.[0]?.steps?.[0]?.audio || null;
      setInstructions(p => p.map(i => i.id === id ? { ...i, audioUrl: url, status: url ? 'saved' : 'error' } : i));
    } catch { setInstructions(p => p.map(i => i.id === id ? { ...i, status: 'error' } : i)); }
    finally { pendingTTSRef.current--; }
  }, []);

  const filterRunRef = useRef(null);
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
    } catch { }
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
        if (e.results[i].isFinal) { const tr = t.trim(); if (tr) { fullTxRef.current += ' ' + tr; setSegments(p => [...p, { text: tr, isInstruction: false }]); filterQRef.current.push(tr); filterRunRef.current?.(); } setInterimText(''); }
        else interim += t;
      }
      setInterimText(interim);
    };
    rec.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Mic error: ' + e.error); };
    rec.onend = () => { if (isRecRef.current) try { rec.start(); } catch { } };
    recognitionRef.current = rec;
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line

  const startRec = useCallback(() => {
    setError(null); setSegments([]); setInterimText(''); setInstructions([]);
    fullTxRef.current = ''; filterQRef.current = []; filteringRef.current = false;
    pendingTTSRef.current = 0; timerValRef.current = 0; isRecRef.current = true;
    setIsRecording(true); setIsPaused(false); setTimer(0); startTimer();
    try { recognitionRef.current?.start(); } catch { }
  }, [startTimer]);

  useEffect(() => { const t = setTimeout(startRec, 300); return () => clearTimeout(t); }, []); // eslint-disable-line

  const handlePause = useCallback(async () => {
    isRecRef.current = false; stopTimer(); setIsRecording(false); setIsPaused(true); setInterimText('');
    try { recognitionRef.current?.stop(); } catch { }
    if (filterQRef.current.length > 0) filterRunRef.current?.();
  }, [stopTimer]);

  const handleResume = useCallback(() => {
    isRecRef.current = true; setIsPaused(false); setIsRecording(true); startTimer();
    try { recognitionRef.current?.start(); } catch { }
  }, [startTimer]);

  const handleStop = useCallback(async () => {
    isRecRef.current = false; stopTimer(); setIsRecording(false); setIsPaused(false);
    
    try { recognitionRef.current?.stop(); } catch { }

    // Flush any pending interim text
    setInterimText(prev => {
      const tr = prev.trim();
      if (tr) {
        fullTxRef.current += ' ' + tr;
      }
      return '';
    });

    const finalTx = fullTxRef.current.trim();
    if (!finalTx) { 
      showNotification('No speech detected.', 'warning'); 
      setCurrentPage('dashboard'); 
      return; 
    }

    setIsProcessing(true);
    try {
      // Send the entire transcript to the backend for final extraction and TTS.
      // This will automatically save it to the DB and update currentJob.
      await processLiveTranscription(finalTx);
      
      setTimeout(() => setCurrentPage('segment'), 500);
    } catch (err) { 
      showNotification('Processing failed: ' + err.message, 'error'); 
      setCurrentPage('dashboard'); 
    }
    finally { 
      setIsProcessing(false); 
    }
  }, [processLiveTranscription, showNotification, setCurrentPage, stopTimer]); // eslint-disable-line

  const savedCount = instructions.filter(i => i.status === 'saved').length;
  const savingCount = instructions.filter(i => i.status === 'saving').length;
  const F = { fontFamily: 'Urbanist, sans-serif' };

  return (
    <div style={{ height: '100%', backgroundColor: '#f6f6f9', ...F, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* ── Home back nav ── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '24px 40px 16px' }}>
        <button onClick={() => setCurrentPage('dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15.5 19L9 12L15.5 5" stroke="#343434" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ ...F, fontSize: '24px', fontWeight: 700, color: '#343434', lineHeight: 1 }}>Home</span>
        </button>
      </div>

      {/* ── Main White Card (Wave + Controls) ── */}
      <div style={{ 
        margin: '0 40px', 
        backgroundColor: '#fff', 
        borderRadius: '24px', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
        flexShrink: 0,
      }}>
        {/* Wave SVG — top border */}
        <WaveSection />

        {/* Content area below the wave */}
        <div style={{ position: 'relative', padding: '20px 40px 40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Session name — Top left under the wave */}
          <div style={{ position: 'absolute', top: 0, left: '40px' }}>
            <p style={{
              ...F, fontSize: '18px', fontWeight: 600, color: '#343434', margin: 0, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {recordingName || 'New Recording'}
            </p>
          </div>

          {/* Center column: mic + timer + buttons */}
          
          <div style={{ marginTop: '20px' }}>
            <MicButton active={isRecording || isPaused} paused={isPaused} />
          </div>

          {(isRecording || isPaused) && instructions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
              <span style={{ ...F, fontSize: '14px', fontWeight: 700, color: '#343434' }}>{savedCount}</span>
              <span style={{ ...F, fontSize: '14px', color: '#6a7380' }}>instruction{savedCount !== 1 ? 's' : ''} captured</span>
              {savingCount > 0 && <Loader2 className="lrp-spin" style={{ width: '14px', height: '14px', color: '#57a0ef' }} />}
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <span style={{ fontFamily: '"DM Sans", monospace', fontSize: '32px', fontWeight: 500, color: '#000', letterSpacing: '1px', lineHeight: 1 }}>
              {fmtTime(timer)}
            </span>
          </div>

          {!isPaused && !isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
              <button onClick={handlePause}
                style={{ height: '48px', width: '130px', borderRadius: '50px', border: '1.5px solid #1e1e1e', backgroundColor: '#fff', color: '#242424', ...F, fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f6f6f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
              >Pause</button>
              <button onClick={handleStop}
                style={{ height: '48px', width: '130px', borderRadius: '50px', border: 'none', background: 'linear-gradient(101deg,#FF3A3A 1%,#D61A0C 128%)', color: '#fff', ...F, fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,58,58,0.38)', transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >Stop</button>
            </div>
          )}

          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#57a0ef', marginTop: '24px' }}>
              <Loader2 className="lrp-spin" style={{ width: '20px', height: '20px' }} />
              <span style={{ ...F, fontSize: '15px', fontWeight: 600 }}>Saving to workspace…</span>
            </div>
          )}

          {error && (
            <div style={{ backgroundColor: '#fef2f2', borderRadius: '10px', padding: '10px 16px', marginTop: '24px' }}>
              <p style={{ ...F, fontSize: '13px', color: '#ef4444', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Separate Transcript / Player Card ── */}
      <div style={{ margin: '24px 40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {isPaused && (
          <InstructionPlayer
            instructions={instructions}
            onResume={handleResume}
            onStop={handleStop}
            isProcessing={isProcessing}
          />
        )}

        {!isPaused && (segments.length > 0 || interimText) && (
          <div style={{ width: '100%', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e8eaf0', padding: '24px 32px', boxSizing: 'border-box' }}>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {segments.map((seg, i) => (
                <p key={i} style={{ ...F, fontSize: '15px', fontWeight: 500, color: seg.isInstruction ? '#1674cc' : '#343434', margin: 0, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  {seg.isInstruction && <span style={{ flexShrink: 0, width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#57a0ef', marginTop: '6px' }} />}
                  {seg.text}
                </p>
              ))}
              {interimText && <p style={{ ...F, fontSize: '15px', fontWeight: 500, color: '#c1c1c8', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{interimText}…</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveRecordingPage;