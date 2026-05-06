// LiveRecordingPage.jsx — Figma node 1-2497 pixel-perfect
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import { Loader2, ChevronLeft } from 'lucide-react';

/* ── Global CSS ─────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;600;700&display=swap');

  @keyframes lrp-spin   { to { transform: rotate(360deg); } }
  @keyframes lrp-blink  { 0%,100%{opacity:1} 50%{opacity:.3} }

  /* Mic pulse rings — expand outward and fade */
  @keyframes lrp-ring1  { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.7);opacity:0} }
  @keyframes lrp-ring2  { 0%{transform:scale(1);opacity:.4} 100%{transform:scale(2.1);opacity:0} }
  @keyframes lrp-ring3  { 0%{transform:scale(1);opacity:.25} 100%{transform:scale(2.6);opacity:0} }

  .lrp-spin  { animation: lrp-spin  1s linear infinite; }
  .lrp-blink { animation: lrp-blink 1.2s ease-in-out infinite; }

  .lrp-ring { position:absolute; border-radius:50%; pointer-events:none; }
  .lrp-ring.on.r1 { animation: lrp-ring1 2.2s ease-out infinite 0s; }
  .lrp-ring.on.r2 { animation: lrp-ring2 2.2s ease-out infinite 0.5s; }
  .lrp-ring.on.r3 { animation: lrp-ring3 2.2s ease-out infinite 1.0s; }
`;
function injectCSS() {
  if (document.getElementById('lrp-g')) return;
  const s = document.createElement('style'); s.id = 'lrp-g'; s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}

/* ── Wave Section — STATIC, 3-layer bezier, traced from Figma ────────────── */
const WaveSection = () => (
  <div style={{
    position: 'relative', width: '100%', flexShrink: 0, overflow: 'hidden',
    background: 'linear-gradient(180deg, #e4eef8 0%, #edf4fb 40%, #f5f9fd 100%)',
  }}>
    <svg
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: 'clamp(170px, 22vw, 320px)' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Layer 1: Light periwinkle (back) — widest, softest */}
      <path
        d="
          M 0,320 L 0,300
          C  60,298  140,280  220,255
          C  290,232  340,195  380,155
          C  410,128  440,118  470,128
          C  510,142  560,185  620,228
          C  680,268  750,296  820,308
          C  870,314  910,312  960,302
          C 1010,290  1060,270 1100,252
          C 1140,236  1175,228 1210,232
          C 1250,238  1310,262 1380,290
          C 1420,304  1440,310 1440,312
          L 1440,320 Z
        "
        fill="rgba(185,210,242,0.50)"
      />

      {/* Layer 2: Medium blue (middle) */}
      <path
        d="
          M 0,320 L 0,306
          C  70,304  150,288  230,262
          C  300,240  350,205  390,168
          C  420,142  450,135  480,142
          C  520,155  565,195  630,240
          C  690,278  760,304  830,314
          C  880,318  920,316  960,308
          C 1010,298  1060,278 1100,260
          C 1140,244  1175,238 1210,242
          C 1250,248  1310,268 1380,292
          C 1420,306  1440,312 1440,314
          L 1440,320 Z
        "
        fill="rgba(110,168,228,0.60)"
      />

      {/* Layer 3: Dark blue front arch — thin, line-like */}
      <path
        d="
          M 0,320 L 0,315
          C  70,314  160,304  240,282
          C  310,262  360,232  400,196
          C  430,170  458,162  488,170
          C  530,184  575,218  640,258
          C  700,294  770,314  840,318
          C  885,320  920,318  960,312
          C 1010,304  1060,286 1100,270
          C 1140,256  1175,250 1210,254
          C 1250,260  1310,278 1380,298
          C 1420,310  1440,316 1440,317
          L 1440,320 Z
        "
        fill="rgba(36,100,192,0.92)"
      />

      {/* White card merge */}
      <path d="M 0,318 C 480,316 960,318 1440,317 L 1440,320 L 0,320 Z" fill="white" />
    </svg>
  </div>
);

/* ── Mic Button — pure CSS, no Figma asset URLs ──────────────────────────── */
const MicButton = ({ active, paused, volume }) => {
  const isOn = active && !paused;
  const v    = isOn ? volume : 0;
  const scale = 1 + v * 0.08;
  // SVG mic icon path
  const micSVG = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width:'36px', height:'36px' }}>
      <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8"  y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  return (
    <div style={{ position:'relative', width:'200px', height:'200px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {/* Outer decorative rings */}
      <div style={{ position:'absolute', width:'200px', height:'200px', borderRadius:'50%', border:'1.5px solid #d0dff0', boxSizing:'border-box' }} />
      <div style={{ position:'absolute', width:'160px', height:'160px', borderRadius:'50%', border:'1.5px solid #b8cfeb', boxSizing:'border-box' }} />
      <div style={{ position:'absolute', width:'122px', height:'122px', borderRadius:'50%', border:'1.5px solid #a0bfe8', boxSizing:'border-box' }} />

      {/* Pulse rings — animate when recording */}
      <div className={`lrp-ring r1 ${isOn?'on':''}`} style={{ width:'88px', height:'88px', background:'rgba(87,152,236,0.22)' }} />
      <div className={`lrp-ring r2 ${isOn?'on':''}`} style={{ width:'88px', height:'88px', background:'rgba(87,152,236,0.15)' }} />
      <div className={`lrp-ring r3 ${isOn?'on':''}`} style={{ width:'88px', height:'88px', background:'rgba(87,152,236,0.10)' }} />

      {/* Blue core button */}
      <div style={{
        position:'relative', zIndex:2,
        width:'88px', height:'88px', borderRadius:'50%',
        background: paused
          ? 'linear-gradient(135deg,#64b5f6,#1976d2)'
          : 'linear-gradient(135deg,#57a0ef,#1674cc)',
        display:'flex', alignItems:'center', justifyContent:'center',
        transform:`scale(${scale})`, transition:'transform 0.06s',
        boxShadow:'0 6px 24px rgba(22,116,204,0.45)',
      }}>
        {paused ? (
          <div style={{ display:'flex', gap:'6px' }}>
            <div style={{ width:'7px', height:'24px', borderRadius:'3px', backgroundColor:'white' }} />
            <div style={{ width:'7px', height:'24px', borderRadius:'3px', backgroundColor:'white' }} />
          </div>
        ) : micSVG}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
const LiveRecordingPage = ({ recordingName, setCurrentPage, onLogout }) => {
  const { setCurrentJob, showNotification } = useApp();
  const [isRecording,   setIsRecording]   = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [timer,         setTimer]         = useState(0);
  const [segments,      setSegments]      = useState([]);
  const [interimText,   setInterimText]   = useState('');
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [error,         setError]         = useState(null);
  const [instructions,  setInstructions]  = useState([]);
  const [volume,        setVolume]        = useState(0);

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
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
  };

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setTimer(t => { const n=t+1; timerValRef.current=n; return n; }), 1000);
  }, []);
  const stopTimer = useCallback(() => clearInterval(timerRef.current), []);

  const startAudioAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
      streamRef.current = stream;
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx; analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setVolume(Math.min(1, data.reduce((a,b)=>a+b,0)/data.length/75));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch(e) { console.warn('[LRP] Analyser unavailable:', e.message); }
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
      setInstructions(p => p.map(i => i.id===id ? {...i, audioUrl:url, status:url?'saved':'error'} : i));
    } catch { setInstructions(p => p.map(i => i.id===id ? {...i, status:'error'} : i)); }
    finally { pendingTTSRef.current--; }
  }, []);

  const runFilter = useCallback(async () => {
    if (filteringRef.current || filterQRef.current.length===0) return;
    filteringRef.current = true;
    const text = filterQRef.current.join(' ').trim(); filterQRef.current = [];
    try {
      const r = await apiService.filterLiveChunk(text);
      const found = r?.instructions || [];
      if (found.length > 0) {
        const set = new Set(found.map(s=>s.toLowerCase()));
        setSegments(p => p.map(s => set.has(s.text.toLowerCase()) ? {...s, isInstruction:true} : s));
        const items = found.map(t => ({ id:Date.now()+Math.random(), text:t, audioUrl:null, status:'saving' }));
        setInstructions(p => [...p, ...items]);
        items.forEach(it => genTTS(it.id, it.text));
      }
    } catch {}
    finally { filteringRef.current=false; if (filterQRef.current.length>0) filterRunRef.current?.(); }
  }, [genTTS]);
  useEffect(() => { filterRunRef.current = runFilter; }, [runFilter]);

  useEffect(() => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { setError('Live speech not supported. Please use Chrome or Edge.'); return; }
    const rec = new SR(); rec.continuous=true; rec.interimResults=true; rec.lang='en-US';
    rec.onresult = e => {
      let interim = '';
      for (let i=e.resultIndex; i<e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const tr=t.trim();
          if (tr) { fullTxRef.current+=' '+tr; setSegments(p=>[...p,{text:tr,isInstruction:false}]); filterQRef.current.push(tr); filterRunRef.current?.(); }
          setInterimText('');
        } else interim+=t;
      }
      setInterimText(interim);
    };
    rec.onerror = e => { if (e.error!=='no-speech'&&e.error!=='aborted') setError('Mic error: '+e.error); };
    rec.onend   = () => { if (isRecRef.current) try { rec.start(); } catch {} };
    recognitionRef.current = rec;
    return () => { clearInterval(timerRef.current); stopAudioAnalyser(); };
  }, []); // eslint-disable-line

  const startRec = useCallback(() => {
    setError(null); setSegments([]); setInterimText(''); setInstructions([]);
    fullTxRef.current=''; filterQRef.current=[]; filteringRef.current=false;
    pendingTTSRef.current=0; timerValRef.current=0; isRecRef.current=true;
    setIsRecording(true); setIsPaused(false); setTimer(0);
    startTimer(); startAudioAnalyser();
    try { recognitionRef.current?.start(); } catch {}
  }, [startTimer, startAudioAnalyser]);
  useEffect(() => { const t=setTimeout(startRec,300); return ()=>clearTimeout(t); }, []); // eslint-disable-line

  const handlePause = useCallback(async () => {
    isRecRef.current=false; stopTimer(); stopAudioAnalyser();
    setIsRecording(false); setIsPaused(true); setInterimText('');
    try { recognitionRef.current?.stop(); } catch {}
    if (filterQRef.current.length>0) filterRunRef.current?.();
  }, [stopTimer, stopAudioAnalyser]);

  const handleResume = useCallback(() => {
    isRecRef.current=true; setIsPaused(false); setIsRecording(true);
    startTimer(); startAudioAnalyser();
    try { recognitionRef.current?.start(); } catch {}
  }, [startTimer, startAudioAnalyser]);

  const handleStop = useCallback(async () => {
    isRecRef.current=false; stopTimer(); stopAudioAnalyser();
    setIsRecording(false); setIsPaused(false); setInterimText('');
    try { recognitionRef.current?.stop(); } catch {}
    const transcript = fullTxRef.current.trim();
    if (!transcript && instructionsRef.current.length===0) { showNotification('No speech detected.','warning'); setCurrentPage('dashboard'); return; }
    setIsProcessing(true);
    try {
      let waited=0;
      while (pendingTTSRef.current>0 && waited<8000) { await new Promise(r=>setTimeout(r,250)); waited+=250; }
      let finalInstructions = instructionsRef.current.filter(i=>i.status==='saved'&&i.audioUrl);
      if (finalInstructions.length===0 && transcript) {
        showNotification('Extracting instructions from transcript…','info');
        try {
          const r = await apiService.processLiveText(transcript);
          if (r?.instructions?.length>0) finalInstructions = r.instructions.map((inst,idx)=>({ id:`stop_${idx}`, text:inst.instruction||inst.steps?.[0]?.text||'', audioUrl:inst.steps?.[0]?.audio||null, status:'saved' })).filter(i=>i.audioUrl);
        } catch(e) { console.error('[LRP] Final extraction failed:',e); }
      }
      if (finalInstructions.length===0) { showNotification('No actionable instructions found.','warning'); setCurrentPage('dashboard'); return; }
      const job = {
        id:`live_${Date.now()}`, name:`${recordingName||'Recording'}.mp3`, type:'Live Transcription',
        duration:fmtTime(timerValRef.current), status:'Completed', transcription:transcript,
        fromLive:true,
        instructions:finalInstructions.map(i=>({ instruction:i.text, steps:[{text:i.text,audio:i.audioUrl}] })),
        createdAt:new Date().toISOString(),
      };
      await setCurrentJob(job);
      showNotification(`${finalInstructions.length} instruction${finalInstructions.length!==1?'s':''} saved — opening workspace`,'success');
      setTimeout(()=>setCurrentPage('segment'),500);
    } catch(err) { showNotification('Processing failed: '+(err.message||'Unknown error'),'error'); setCurrentPage('dashboard'); }
    finally { setIsProcessing(false); }
  }, [recordingName, setCurrentJob, showNotification, setCurrentPage, stopTimer, stopAudioAnalyser]); // eslint-disable-line

  /* ── Latest instruction text for transcript card ── */
  const latestInstruction = instructions.filter(i=>i.status==='saved'&&i.text).slice(-1)[0]?.text || '';
  const displayText = latestInstruction || (segments.length>0 ? segments[segments.length-1].text : '') || interimText;

  const F = { fontFamily:"'Urbanist', sans-serif" };

  return (
    <div style={{ ...F, minHeight:'100%', backgroundColor:'#f6f6f9', display:'flex', flexDirection:'column' }}>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 28px 0' }}>
        <button onClick={()=>setCurrentPage('dashboard')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:0, color:'#343434' }}>
          <ChevronLeft style={{ width:'20px', height:'20px' }} />
          <span style={{ ...F, fontSize:'22px', fontWeight:700, color:'#343434' }}>Home</span>
        </button>
      </div>

      {/* ── Wave ── */}
      <WaveSection />

      {/* ── White card ── */}
      <div style={{ backgroundColor:'#fff', flex:1, padding:'0 48px 40px', display:'flex', flexDirection:'column', marginTop:'-3px' }}>

        {/* Session name */}
        <p style={{ ...F, fontSize:'18px', fontWeight:700, color:'#343434', margin:'20px 0 0', lineHeight:1.3 }}>
          {recordingName || 'New Recording'}
        </p>

        {/* Center column: mic + timer + buttons */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', paddingTop:'12px' }}>

          <MicButton active={isRecording||isPaused} paused={isPaused} volume={volume} />

          {/* Timer */}
          <div style={{ fontFamily:'"DM Sans", monospace', fontSize:'clamp(26px,2.6vw,34px)', fontWeight:500, color:'#000', letterSpacing:'2px', lineHeight:1 }}>
            {fmtTime(timer)}
          </div>

          {/* Pause + Stop */}
          {!isPaused && !isProcessing && (
            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <button onClick={handlePause}
                style={{ height:'52px', width:'220px', borderRadius:'50px', border:'1.5px solid #1e1e1e', backgroundColor:'#fff', color:'#242424', ...F, fontSize:'17px', fontWeight:600, cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.backgroundColor='#f6f6f9'}
                onMouseLeave={e=>e.currentTarget.style.backgroundColor='#fff'}>
                Pause
              </button>
              <button onClick={handleStop}
                style={{ height:'52px', width:'220px', borderRadius:'50px', border:'none', background:'linear-gradient(101deg,#FF3A3A 1%,#D61A0C 128%)', color:'#fff', ...F, fontSize:'17px', fontWeight:600, cursor:'pointer', boxShadow:'0 6px 20px rgba(255,58,58,0.38)' }}
                onMouseEnter={e=>e.currentTarget.style.opacity='0.88'}
                onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                Stop
              </button>
            </div>
          )}

          {/* Resume + Stop (when paused) */}
          {isPaused && !isProcessing && (
            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <button onClick={handleResume}
                style={{ height:'52px', width:'220px', borderRadius:'50px', border:'1.5px solid #1e1e1e', backgroundColor:'#fff', color:'#242424', ...F, fontSize:'17px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                <span className="lrp-blink" style={{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#ef4444', display:'inline-block' }} />
                Resume
              </button>
              <button onClick={handleStop}
                style={{ height:'52px', width:'220px', borderRadius:'50px', border:'none', background:'linear-gradient(101deg,#FF3A3A 1%,#D61A0C 128%)', color:'#fff', ...F, fontSize:'17px', fontWeight:600, cursor:'pointer', boxShadow:'0 6px 20px rgba(255,58,58,0.38)', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                Stop &amp; Save
              </button>
            </div>
          )}

          {isProcessing && (
            <div style={{ display:'flex', alignItems:'center', gap:'10px', color:'#3b82f6' }}>
              <Loader2 className="lrp-spin" style={{ width:'20px', height:'20px' }} />
              <span style={{ ...F, fontSize:'14px', fontWeight:600 }}>Saving to workspace…</span>
            </div>
          )}

          {error && (
            <div style={{ backgroundColor:'#fef2f2', borderRadius:'12px', padding:'10px 18px' }}>
              <p style={{ ...F, fontSize:'13px', color:'#ef4444', margin:0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Live transcript card */}
        {displayText && !isPaused && (
          <div style={{ marginTop:'20px', backgroundColor:'#fff', borderRadius:'16px', border:'1px solid #e8eaf0', padding:'20px 28px', boxShadow:'0 2px 10px rgba(0,0,0,0.04)' }}>
            <p style={{ ...F, fontSize:'14px', color:'#475569', margin:0, lineHeight:1.7 }}>
              {displayText}
              {interimText && !latestInstruction && <span style={{ color:'#c1c1c8', fontStyle:'italic' }}> {interimText}…</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveRecordingPage;
