// Frontend/src/pages/LiveRecordingPage.jsx
// Figma node 1-2497 — pixel-perfect implementation

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/* ─── Global animation styles ─────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('lrp-styles')) return;
  const s = document.createElement('style');
  s.id = 'lrp-styles';
  s.textContent = `
    @keyframes lrp-w1 {
      0%,100% { d: path("M0,80 C200,30 450,130 700,75 C950,20 1150,110 1400,65 C1600,30 1760,90 1920,70 L1920,200 L0,200 Z"); }
      50%      { d: path("M0,80 C200,130 450,30 700,85 C950,140 1150,50 1400,95 C1600,130 1760,50 1920,70 L1920,200 L0,200 Z"); }
    }
    @keyframes lrp-w2 {
      0%,100% { d: path("M0,110 C300,65 600,155 900,105 C1200,55 1500,140 1920,100 L1920,200 L0,200 Z"); }
      50%      { d: path("M0,110 C300,155 600,65 900,115 C1200,165 1500,80 1920,110 L1920,200 L0,200 Z"); }
    }
    @keyframes lrp-w3 {
      0%,100% { d: path("M0,140 C350,110 700,165 1050,140 C1350,118 1650,158 1920,138 L1920,200 L0,200 Z"); }
      50%      { d: path("M0,140 C350,165 700,110 1050,148 C1350,175 1650,118 1920,142 L1920,200 L0,200 Z"); }
    }
    @keyframes lrp-w4 {
      0%,100% { d: path("M0,165 C480,148 960,178 1440,162 C1680,152 1820,170 1920,162 L1920,200 L0,200 Z"); }
      50%      { d: path("M0,165 C480,178 960,148 1440,170 C1680,182 1820,152 1920,160 L1920,200 L0,200 Z"); }
    }
    .lrp-w1 { animation: lrp-w1 4s ease-in-out infinite; }
    .lrp-w2 { animation: lrp-w2 5s ease-in-out infinite; }
    .lrp-w3 { animation: lrp-w3 6s ease-in-out infinite; }
    .lrp-w4 { animation: lrp-w4 3.5s ease-in-out infinite; }

    @keyframes lrp-ring1 { 0%{transform:scale(1);opacity:.6} 70%{transform:scale(1.6);opacity:0} 100%{transform:scale(1.6);opacity:0} }
    @keyframes lrp-ring2 { 0%{transform:scale(1);opacity:.4} 70%{transform:scale(2);opacity:0} 100%{transform:scale(2);opacity:0} }
    @keyframes lrp-ring3 { 0%{transform:scale(1);opacity:.2} 70%{transform:scale(2.5);opacity:0} 100%{transform:scale(2.5);opacity:0} }
    .lrp-r1 { animation: lrp-ring1 2.2s ease-out infinite; }
    .lrp-r2 { animation: lrp-ring2 2.2s ease-out infinite 0.4s; }
    .lrp-r3 { animation: lrp-ring3 2.2s ease-out infinite 0.8s; }

    @keyframes lrp-spin { to { transform: rotate(360deg); } }
    .lrp-spin { animation: lrp-spin 1s linear infinite; }
    @keyframes lrp-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .lrp-pulse { animation: lrp-pulse 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
};

/* ─── Wave SVG background ─────────────────────────────────────────────────── */
const WaveBg = ({ active }) => {
  useEffect(() => { injectStyles(); }, []);
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: '420px',
      background: active
        ? 'linear-gradient(180deg,#cde8ff 0%,#a8d4f5 35%,#b8dcff 65%,#d6eeff 100%)'
        : 'linear-gradient(180deg,#dde9f5 0%,#c8dced 35%,#d2e4f3 65%,#e4eff8 100%)',
      transition: 'background 0.8s ease',
      overflow: 'hidden',
    }}>
      <svg viewBox="0 0 1920 200" preserveAspectRatio="none"
        style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'75%' }}>
        <path className="lrp-w4"
          d="M0,165 C480,148 960,178 1440,162 C1680,152 1820,170 1920,162 L1920,200 L0,200 Z"
          fill={active ? 'rgba(74,144,226,0.12)' : 'rgba(120,160,200,0.08)'} />
        <path className="lrp-w3"
          d="M0,140 C350,110 700,165 1050,140 C1350,118 1650,158 1920,138 L1920,200 L0,200 Z"
          fill={active ? 'rgba(74,144,226,0.20)' : 'rgba(120,160,200,0.14)'} />
        <path className="lrp-w2"
          d="M0,110 C300,65 600,155 900,105 C1200,55 1500,140 1920,100 L1920,200 L0,200 Z"
          fill={active ? 'rgba(74,144,226,0.30)' : 'rgba(120,160,200,0.20)'} />
        <path className="lrp-w1"
          d="M0,80 C200,30 450,130 700,75 C950,20 1150,110 1400,65 C1600,30 1760,90 1920,70 L1920,200 L0,200 Z"
          fill={active ? 'rgba(74,144,226,0.40)' : 'rgba(120,160,200,0.28)'} />
      </svg>
    </div>
  );
};

/* ─── Mic SVG ─────────────────────────────────────────────────────────────── */
const MicSVG = () => (
  <svg width="30" height="36" viewBox="0 0 30 36" fill="none">
    <rect x="8" y="1" width="14" height="22" rx="7" fill="white"/>
    <path d="M3 18C3 24.627 8.373 30 15 30C21.627 30 27 24.627 27 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="15" y1="30" x2="15" y2="35" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="9" y1="35" x2="21" y2="35" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

/* ─── Pulsing mic button ──────────────────────────────────────────────────── */
const MicButton = ({ active, paused }) => {
  const pulse = active && !paused;
  const color = paused ? '#f59e0b' : '#57a0ef';
  const grad  = paused
    ? 'linear-gradient(145deg,#f59e0b,#fbbf24)'
    : 'linear-gradient(145deg,#57a0ef,#98d3ff)';
  const shadow = paused
    ? '0 8px 32px rgba(245,158,11,0.45)'
    : '0 8px 32px rgba(87,160,239,0.50)';

  return (
    <div style={{ position:'relative', width:'140px', height:'140px', margin:'0 auto 8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
      {/* Pulse rings */}
      {pulse && (
        <>
          <div className="lrp-r3" style={{ position:'absolute', width:'78px', height:'78px', borderRadius:'50%', background:`rgba(87,160,239,0.15)` }} />
          <div className="lrp-r2" style={{ position:'absolute', width:'78px', height:'78px', borderRadius:'50%', background:`rgba(87,160,239,0.22)` }} />
          <div className="lrp-r1" style={{ position:'absolute', width:'78px', height:'78px', borderRadius:'50%', background:`rgba(87,160,239,0.32)` }} />
        </>
      )}
      {/* Static decorative rings */}
      <div style={{ position:'absolute', width:'118px', height:'118px', borderRadius:'50%', border:`1.5px solid ${color}22` }} />
      <div style={{ position:'absolute', width:'96px', height:'96px', borderRadius:'50%', border:`1.5px solid ${color}33` }} />
      {/* Core */}
      <div style={{
        position:'relative', width:'78px', height:'78px', borderRadius:'50%',
        background: grad, boxShadow: shadow,
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all 0.3s ease',
        zIndex: 1,
      }}>
        {paused
          ? <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="5" y="4" width="6" height="20" rx="2.5" fill="white"/><rect x="17" y="4" width="6" height="20" rx="2.5" fill="white"/></svg>
          : <MicSVG />
        }
      </div>
    </div>
  );
};

/* ─── Instruction player (paused state) ──────────────────────────────────── */
const InstructionPlayer = ({ instructions, onResume, onStop, isProcessing }) => {
  const [currentId, setCurrentId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]   = useState(0);
  const audioRef = useRef(new Audio());

  const saved   = instructions.filter(i => i.status === 'saved' && i.audioUrl);
  const saving  = instructions.filter(i => i.status === 'saving').length;

  useEffect(() => { if (!currentId && saved.length > 0) setCurrentId(saved[0].id); }, [saved.length, currentId]);

  const curr    = saved.find(i => i.id === currentId) || saved[0] || null;
  const currIdx = saved.indexOf(curr);

  useEffect(() => {
    const a = audioRef.current;
    if (!curr?.audioUrl) { a.pause(); setIsPlaying(false); setCurrentTime(0); setDuration(0); return; }
    a.pause(); a.src = curr.audioUrl; a.load(); setIsPlaying(false); setCurrentTime(0); setDuration(0);
    const onMeta  = () => setDuration(a.duration || 0);
    const onTime  = () => setCurrentTime(a.currentTime);
    const onEnded = () => { setIsPlaying(false); if (currIdx < saved.length - 1) setCurrentId(saved[currIdx + 1].id); };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnded);
    return () => { a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnded); a.pause(); };
  }, [curr?.audioUrl]); // eslint-disable-line

  const togglePlay = () => { if (!curr) return; if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } else audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {}); };
  const goTo   = id => { audioRef.current.pause(); setIsPlaying(false); setCurrentId(id); };
  const goPrev = () => currIdx > 0 && goTo(saved[currIdx - 1].id);
  const goNext = () => currIdx < saved.length - 1 && goTo(saved[currIdx + 1].id);
  const seek   = e => { if (!duration) return; const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration; };
  const fmt    = s => isNaN(s) || !s ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div style={{ width:'100%', maxWidth:'560px', background:'#fff', borderRadius:'20px', border:'1px solid #e8e8ed', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', overflow:'hidden', fontFamily:'Urbanist,sans-serif' }}>
      <div style={{ padding:'14px 20px', background:'#fffbeb', borderBottom:'1px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:'14px', fontWeight:700, color:'#343434', margin:0 }}>⏸ Paused — Review Instructions</p>
          <p style={{ fontSize:'12px', color:'#b45309', margin:'2px 0 0' }}>{saved.length} ready{saving > 0 && ` · ${saving} generating…`}</p>
        </div>
        {saving > 0 && <Loader2 className="lrp-spin" style={{ width:'16px', height:'16px', color:'#f59e0b' }} />}
      </div>
      <div style={{ maxHeight:'200px', overflowY:'auto', background:'#fafafa', padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
        {instructions.length === 0
          ? <p style={{ fontSize:'13px', color:'#6a7380', textAlign:'center', padding:'24px 0', margin:0 }}>No instructions yet. Resume and keep talking.</p>
          : instructions.map((inst, i) => {
              const isActive = inst.id === currentId, ok = inst.status === 'saved' && inst.audioUrl;
              return (
                <div key={inst.id} onClick={() => ok && goTo(inst.id)} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px 12px', borderRadius:'12px', border:`1px solid ${isActive && ok ? '#b3d4f5' : '#e8e8ed'}`, backgroundColor: isActive && ok ? '#f0f7ff' : '#fff', cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.6 }}>
                  <div style={{ flexShrink:0, marginTop:'2px', width:'18px' }}>
                    {inst.status === 'saving' && <Loader2 className="lrp-spin" style={{ width:'14px', height:'14px', color:'#6a7380' }} />}
                    {inst.status === 'error'  && <AlertCircle style={{ width:'14px', height:'14px', color:'#ef4444' }} />}
                    {inst.status === 'saved'  && (isActive && isPlaying ? <Volume2 style={{ width:'14px', height:'14px', color:'#57a0ef' }} /> : <CheckCircle2 style={{ width:'14px', height:'14px', color: isActive ? '#57a0ef' : '#129578' }} />)}
                  </div>
                  <span style={{ fontSize:'13px', lineHeight:1.5, flex:1 }}>
                    <span style={{ fontSize:'11px', fontWeight:700, color:'#6a7380', marginRight:'4px' }}>{i + 1}.</span>
                    <span style={{ color: isActive && ok ? '#1674cc' : '#343434', fontWeight: isActive ? 600 : 400 }}>{inst.text}</span>
                  </span>
                </div>
              );
            })}
      </div>
      {saved.length > 0 && (
        <div style={{ padding:'14px 20px', borderTop:'1px solid #f0f0f4' }}>
          <p style={{ fontSize:'12px', color:'#6a7380', margin:'0 0 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {curr ? `${currIdx + 1} / ${saved.length} — ${curr.text.slice(0, 60)}${curr.text.length > 60 ? '…' : ''}` : 'Select an instruction'}
          </p>
          <div onClick={seek} style={{ width:'100%', height:'6px', backgroundColor:'#e8e8ed', borderRadius:'3px', cursor:'pointer', marginBottom:'6px' }}>
            <div style={{ height:'100%', backgroundColor:'#57a0ef', borderRadius:'3px', width:`${duration ? (currentTime / duration) * 100 : 0}%`, transition:'width 0.1s' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#6a7380', marginBottom:'12px' }}><span>{fmt(currentTime)}</span><span>{fmt(duration)}</span></div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'20px' }}>
            <button onClick={goPrev} disabled={currIdx <= 0} style={{ background:'none', border:'none', cursor: currIdx <= 0 ? 'not-allowed' : 'pointer', opacity: currIdx <= 0 ? 0.3 : 1, padding:'6px' }}><SkipBack style={{ width:'18px', height:'18px', color:'#343434' }} /></button>
            <button onClick={togglePlay} disabled={!curr} style={{ width:'44px', height:'44px', borderRadius:'50%', border:'none', cursor: curr ? 'pointer' : 'not-allowed', background:'linear-gradient(135deg,#57a0ef,#98d3ff)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(87,160,239,0.4)', opacity: curr ? 1 : 0.4 }}>
              {isPlaying ? <Pause style={{ width:'16px', height:'16px', color:'#fff' }} /> : <Play style={{ width:'16px', height:'16px', color:'#fff', marginLeft:'2px' }} />}
            </button>
            <button onClick={goNext} disabled={currIdx >= saved.length - 1} style={{ background:'none', border:'none', cursor: currIdx >= saved.length - 1 ? 'not-allowed' : 'pointer', opacity: currIdx >= saved.length - 1 ? 0.3 : 1, padding:'6px' }}><SkipForward style={{ width:'18px', height:'18px', color:'#343434' }} /></button>
          </div>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', padding:'14px 20px 20px' }}>
        <button onClick={() => { audioRef.current.pause(); onResume(); }} disabled={isProcessing} style={{ height:'44px', borderRadius:'12px', border:'none', cursor:'pointer', background:'linear-gradient(104deg,#57a0ef 1.33%,#98d3ff 127.72%)', color:'#fff', fontFamily:'Urbanist,sans-serif', fontSize:'14px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
          <span className="lrp-pulse" style={{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'rgba(255,255,255,0.8)', display:'inline-block' }} /> Resume
        </button>
        <button onClick={() => { audioRef.current.pause(); onStop(); }} disabled={isProcessing} style={{ height:'44px', borderRadius:'12px', border:'1.5px solid #c1c1c8', cursor:'pointer', backgroundColor:'#fff', color:'#343434', fontFamily:'Urbanist,sans-serif', fontSize:'14px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
          {isProcessing ? <><Loader2 className="lrp-spin" style={{ width:'14px', height:'14px' }} /> Saving…</> : 'Stop & Save'}
        </button>
      </div>
    </div>
  );
};

/* ─── Main page ───────────────────────────────────────────────────────────── */
const LiveRecordingPage = ({ recordingName, setCurrentPage }) => {
  const { setCurrentJob, showNotification } = useApp();

  const [isRecording, setIsRecording]   = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [timer, setTimer]               = useState(0);
  const [segments, setSegments]         = useState([]);
  const [interimText, setInterimText]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError]               = useState(null);
  const [instructions, setInstructions] = useState([]);

  const recognitionRef    = useRef(null);
  const timerIntervalRef  = useRef(null);
  const timerValueRef     = useRef(0);
  const isRecordingRef    = useRef(false);
  const fullTranscriptRef = useRef('');
  const filterQueueRef    = useRef([]);
  const filteringRef      = useRef(false);
  const pendingTTSRef     = useRef(0);
  const instructionsRef   = useRef([]);

  useEffect(() => { instructionsRef.current = instructions; }, [instructions]);

  const fmt = s => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`; };

  const startTimer = useCallback(() => {
    timerIntervalRef.current = setInterval(() => setTimer(t => { const n = t+1; timerValueRef.current = n; return n; }), 1000);
  }, []);
  const stopTimer = useCallback(() => clearInterval(timerIntervalRef.current), []);

  const generateTTS = useCallback(async (itemId, text) => {
    pendingTTSRef.current++;
    try {
      const r = await apiService.processLiveText(text);
      const url = r?.instructions?.[0]?.steps?.[0]?.audio || null;
      setInstructions(prev => prev.map(i => i.id === itemId ? { ...i, audioUrl: url, status: url ? 'saved' : 'error' } : i));
    } catch { setInstructions(prev => prev.map(i => i.id === itemId ? { ...i, status: 'error' } : i)); }
    finally { pendingTTSRef.current--; }
  }, []);

  const filterRef = useRef(null);
  const processFilter = useCallback(async () => {
    if (filteringRef.current || filterQueueRef.current.length === 0) return;
    filteringRef.current = true;
    const text = filterQueueRef.current.join(' ').trim(); filterQueueRef.current = [];
    try {
      const r = await apiService.filterLiveChunk(text);
      const detected = r?.instructions || [];
      if (detected.length > 0) {
        const set = new Set(detected.map(s => s.toLowerCase()));
        setSegments(prev => prev.map(seg => set.has(seg.text.toLowerCase()) ? { ...seg, isInstruction: true } : seg));
        const items = detected.map(t => ({ id: Date.now() + Math.random(), text: t, audioUrl: null, status: 'saving' }));
        setInstructions(prev => [...prev, ...items]);
        items.forEach(item => generateTTS(item.id, item.text));
      }
    } catch {}
    finally { filteringRef.current = false; if (filterQueueRef.current.length > 0) filterRef.current?.(); }
  }, [generateTTS]);
  useEffect(() => { filterRef.current = processFilter; }, [processFilter]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Live speech not supported. Use Chrome or Edge.'); return; }
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { const tr = t.trim(); if (tr) { fullTranscriptRef.current += ' ' + tr; setSegments(prev => [...prev, { text: tr, isInstruction: false }]); filterQueueRef.current.push(tr); filterRef.current?.(); } setInterimText(''); }
        else interim += t;
      }
      setInterimText(interim);
    };
    rec.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Mic error: ' + e.error); };
    rec.onend   = () => { if (isRecordingRef.current) try { rec.start(); } catch {} };
    recognitionRef.current = rec;
    return () => clearInterval(timerIntervalRef.current);
  }, []); // eslint-disable-line

  const startRecording = useCallback(() => {
    setError(null); setSegments([]); setInterimText(''); setInstructions([]);
    fullTranscriptRef.current = ''; filterQueueRef.current = []; filteringRef.current = false;
    pendingTTSRef.current = 0; timerValueRef.current = 0; isRecordingRef.current = true;
    setIsRecording(true); setIsPaused(false); setTimer(0); startTimer();
    try { recognitionRef.current?.start(); } catch {}
  }, [startTimer]);

  useEffect(() => { const t = setTimeout(startRecording, 300); return () => clearTimeout(t); }, []); // eslint-disable-line

  const handlePause = useCallback(async () => {
    isRecordingRef.current = false; stopTimer(); setIsRecording(false); setIsPaused(true); setInterimText('');
    try { recognitionRef.current?.stop(); } catch {}
    if (filterQueueRef.current.length > 0) filterRef.current?.();
  }, [stopTimer]);

  const handleResume = useCallback(() => {
    isRecordingRef.current = true; setIsPaused(false); setIsRecording(true); startTimer();
    try { recognitionRef.current?.start(); } catch {}
  }, [startTimer]);

  const handleStop = useCallback(async () => {
    isRecordingRef.current = false; stopTimer(); setIsRecording(false); setIsPaused(false); setInterimText('');
    try { recognitionRef.current?.stop(); } catch {}
    const cur = instructionsRef.current;
    if (cur.length === 0 && !fullTranscriptRef.current.trim()) { showNotification('No speech detected.', 'warning'); setCurrentPage('dashboard'); return; }
    setIsProcessing(true);
    try {
      let waited = 0;
      while (pendingTTSRef.current > 0 && waited < 5000) { await new Promise(r => setTimeout(r, 200)); waited += 200; }
      const final = instructionsRef.current.filter(i => i.status === 'saved' && i.audioUrl);
      if (final.length === 0) { showNotification('No instructions found.', 'warning'); setCurrentPage('dashboard'); return; }
      const job = { id: `live_${Date.now()}`, name: `${recordingName}.mp3`, type: 'Live Transcription', duration: fmt(timerValueRef.current), status: 'Completed', transcription: fullTranscriptRef.current.trim(), fromLive: true, instructions: final.map(i => ({ instruction: i.text, steps: [{ text: i.text, audio: i.audioUrl }] })), createdAt: new Date().toISOString() };
      await setCurrentJob(job);
      showNotification(`${final.length} instruction${final.length !== 1 ? 's' : ''} saved`, 'success');
      setTimeout(() => setCurrentPage('segment'), 500);
    } catch (err) { showNotification('Processing failed: ' + err.message, 'error'); setCurrentPage('dashboard'); }
    finally { setIsProcessing(false); }
  }, [recordingName, setCurrentJob, showNotification, setCurrentPage, stopTimer]); // eslint-disable-line

  const savedCount  = instructions.filter(i => i.status === 'saved').length;
  const savingCount = instructions.filter(i => i.status === 'saving').length;

  return (
    <div style={{ position:'relative', minHeight:'100%', backgroundColor:'#f0f4f8', fontFamily:'Urbanist,sans-serif', overflow:'hidden' }}>

      {/* Wave background — fixed tall section */}
      <WaveBg active={isRecording && !isPaused} />

      {/* Back button */}
      <div style={{ position:'relative', zIndex:10, padding:'20px 32px 0' }}>
        <button onClick={() => setCurrentPage('dashboard')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', color:'#4a6080', fontSize:'14px', fontWeight:600, fontFamily:'Urbanist,sans-serif', padding:'4px 0' }}
          onMouseEnter={e => e.currentTarget.style.color='#1674cc'}
          onMouseLeave={e => e.currentTarget.style.color='#4a6080'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11.5 14L6.5 9L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Home
        </button>
      </div>

      {/* Recording card — centered, overlapping wave */}
      <div style={{ position:'relative', zIndex:10, display:'flex', justifyContent:'center', marginTop:'30px', padding:'0 20px' }}>
        <div style={{
          width:'100%', maxWidth:'580px',
          backgroundColor:'#ffffff',
          borderRadius:'24px',
          border:'1px solid rgba(0,0,0,0.06)',
          boxShadow:'0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          padding:'28px 36px 32px',
          textAlign:'center',
        }}>
          {/* Session name */}
          <p style={{ margin:'0 0 24px', fontSize:'15px', fontWeight:600, color:'#6a7380', textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {recordingName || 'New Recording'}
          </p>

          {/* Mic with pulse rings */}
          <MicButton active={isRecording || isPaused} paused={isPaused} />

          {/* Timer */}
          <div style={{ fontFamily:'monospace', fontSize:'42px', fontWeight:700, color:'#1a1a2e', letterSpacing:'3px', margin:'8px 0 24px', lineHeight:1 }}>
            {fmt(timer)}
          </div>

          {/* Instruction counter */}
          {(isRecording || isPaused) && instructions.length > 0 && (
            <div style={{ fontSize:'13px', color:'#6a7380', marginBottom:'18px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              <span style={{ fontWeight:700, color:'#343434' }}>{savedCount}</span>
              {' '}instruction{savedCount !== 1 ? 's' : ''} captured
              {savingCount > 0 && (
                <span style={{ color:'#57a0ef', fontSize:'12px', display:'flex', alignItems:'center', gap:'4px' }}>
                  <Loader2 className="lrp-spin" style={{ width:'12px', height:'12px' }} /> generating…
                </span>
              )}
            </div>
          )}

          {/* Pause + Stop buttons */}
          {!isPaused && !isProcessing && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'16px' }}>
              <button onClick={handlePause}
                style={{ height:'46px', paddingLeft:'36px', paddingRight:'36px', borderRadius:'100px', border:'1.8px solid #c8c8d0', backgroundColor:'#fff', color:'#343434', fontFamily:'Urbanist,sans-serif', fontSize:'15px', fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor='#f6f6f9'; e.currentTarget.style.borderColor='#343434'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor='#fff'; e.currentTarget.style.borderColor='#c8c8d0'; }}
              >
                Pause
              </button>
              <button onClick={handleStop}
                style={{ height:'46px', paddingLeft:'32px', paddingRight:'32px', borderRadius:'100px', border:'none', backgroundColor:'#ef4444', color:'#fff', fontFamily:'Urbanist,sans-serif', fontSize:'15px', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 20px rgba(239,68,68,0.40)', transition:'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor='#dc2626'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor='#ef4444'}
              >
                Stop
              </button>
            </div>
          )}

          {isProcessing && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', color:'#57a0ef' }}>
              <Loader2 className="lrp-spin" style={{ width:'20px', height:'20px' }} />
              <span style={{ fontSize:'14px', fontWeight:600 }}>Saving to workspace…</span>
            </div>
          )}

          {error && (
            <p style={{ marginTop:'16px', fontSize:'12px', color:'#ef4444', backgroundColor:'#fef2f2', borderRadius:'10px', padding:'10px 14px', margin:'16px 0 0' }}>{error}</p>
          )}
        </div>
      </div>

      {/* Below-card area */}
      <div style={{ position:'relative', zIndex:10, padding:'24px 20px 40px', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>

        {/* Paused: instruction player */}
        {isPaused && (
          <InstructionPlayer
            instructions={instructions}
            onResume={handleResume}
            onStop={handleStop}
            isProcessing={isProcessing}
          />
        )}

        {/* Active: live transcript */}
        {!isPaused && (segments.length > 0 || interimText) && (
          <div style={{ width:'100%', maxWidth:'860px', backgroundColor:'#fff', borderRadius:'18px', border:'1px solid #e8e8ed', padding:'22px 28px' }}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#6a7380', textTransform:'uppercase', letterSpacing:'1.5px', margin:'0 0 14px' }}>Live Transcript</p>
            <div style={{ maxHeight:'200px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'10px' }}>
              {segments.map((seg, i) => (
                <p key={i} style={{ fontSize:'14px', lineHeight:1.7, color: seg.isInstruction ? '#1674cc' : '#6a7380', margin:0, display:'flex', alignItems:'flex-start', gap:'8px' }}>
                  {seg.isInstruction && <span style={{ flexShrink:0, width:'7px', height:'7px', borderRadius:'50%', backgroundColor:'#57a0ef', marginTop:'8px' }} />}
                  {seg.text}
                </p>
              ))}
              {interimText && <p style={{ fontSize:'14px', color:'#c1c1c8', fontStyle:'italic', margin:0 }}>{interimText}…</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveRecordingPage;
