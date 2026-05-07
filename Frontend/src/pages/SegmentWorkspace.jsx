// Frontend/src/pages/SegmentWorkspace.jsx
// Left panel = extracted instruction chunks only (not full raw transcription)

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, Download, Search, Play, Pause,
  Shuffle, SkipBack, SkipForward, Repeat, Loader2, AlertCircle,
  ListMusic, Volume2, Maximize2, VolumeX, Minimize2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';

/* ── Inject Inter font once ──────────────────────────────────────────────── */
function injectFont() {
  if (document.getElementById('sw-font')) return;
  const s = document.createElement('style');
  s.id = 'sw-font';
  s.textContent = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`;
  document.head.appendChild(s);
}

/* ── Animated waveform bars ──────────────────────────────────────────────── */
const HEIGHTS = [14,18,22,28,32,26,20,30,36,28,22,18,26,32,36,30,22,28,34,26,20,16,24,30,26,20,16,22];
const WaveBars = ({ playing }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'2px', height:'36px' }}>
    <style>{`
      @keyframes sw-bar{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.9)}}
      .sw-bar-anim{animation:sw-bar ease-in-out infinite}
      @keyframes sw-spin{to{transform:rotate(360deg)}}
    `}</style>
    {HEIGHTS.map((h, i) => (
      <div key={i}
        className={playing ? 'sw-bar-anim' : ''}
        style={{
          width:'2.5px', height:`${h*0.8}px`, borderRadius:'2px',
          backgroundColor:'#475569',
          animationDuration:`${550+(i*47)%400}ms`,
          animationDelay:`${(i*60)%500}ms`,
        }}
      />
    ))}
  </div>
);

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = s => isNaN(s)||!s ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const audioErrMsg = c => ({1:'Aborted',2:'Network error',3:'Decode error',4:'Not supported'}[c]||'Unknown error');

/* ── Blue circle play button ─────────────────────────────────────────────── */
const PlayCircle = ({ size = 30, active, loading, playing, onClick }) => (
  <button onClick={onClick} style={{
    width:`${size}px`, height:`${size}px`, borderRadius:'50%', flexShrink:0,
    background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow:'0 2px 8px rgba(59,130,246,0.4)',
  }}>
    {loading && active
      ? <Loader2 style={{ width:'13px', height:'13px', color:'#fff', animation:'sw-spin 1s linear infinite' }} />
      : active && playing
        ? <Pause  style={{ width:'12px', height:'12px', color:'#fff' }} />
        : <Play   style={{ width:'12px', height:'12px', color:'#fff', marginLeft:'1px' }} />}
  </button>
);

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const SegmentWorkspace = ({ setCurrentPage }) => {
  const { currentJob } = useApp();

  const [stepIdx,     setStepIdx]     = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [audioError,  setAudioError]  = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [search,      setSearch]      = useState('');
  const [shuffle,     setShuffle]     = useState(false);
  const [repeat,      setRepeat]      = useState(false);

  // New interactive states
  const [volume,        setVolume]        = useState(1);
  const [isMuted,       setIsMuted]       = useState(false);
  const [showList,      setShowList]      = useState(true);
  const [isFullscreen,  setIsFullscreen]  = useState(false);

  const audioRef     = useRef(new Audio());
  const autoPlayRef  = useRef(false);
  const hasPlayedRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => { injectFont(); }, []);

  // Update real audio volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Track fullscreen changes (e.g. if user presses ESC)
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  /* reset + auto-play when job changes */
  useEffect(() => {
    setStepIdx(0);
    autoPlayRef.current = !!currentJob?.fromLive;
  }, [currentJob?.id]); // eslint-disable-line

  /* flatten all steps across all instructions */
  const allSteps = (currentJob?.instructions || []).flatMap((inst, iIdx) =>
    inst.steps.map((step, sIdx) => ({
      ...step,
      instTitle: inst.instruction,
      iIdx, sIdx,
    }))
  );

  const currentStep = allSteps[stepIdx];

  /* ── Audio loading ── */
  useEffect(() => {
    if (!currentStep?.audio) return;
    setIsLoading(true); setAudioError(null); setIsPlaying(false);
    hasPlayedRef.current = false;

    const audio = audioRef.current;
    audio.pause(); audio.currentTime = 0;
    audio.src = currentStep.audio; audio.load();

    const onData = () => setIsLoading(false);
    const onMeta = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onErr  = () => {
      setAudioError(`Error ${audio.error?.code}: ${audioErrMsg(audio.error?.code)}`);
      setIsLoading(false); setIsPlaying(false);
    };
    const onCan = () => {
      setIsLoading(false);
      if (autoPlayRef.current && !hasPlayedRef.current) {
        hasPlayedRef.current = true;
        audio.play().then(() => setIsPlaying(true)).catch(() => { autoPlayRef.current = false; });
      }
    };
    const onEnd = () => {
      setIsPlaying(false);
      if (repeat) { audio.currentTime = 0; audio.play().then(() => setIsPlaying(true)); }
      else if (stepIdx < allSteps.length - 1) setTimeout(() => setStepIdx(p => p + 1), 400);
    };

    audio.addEventListener('loadeddata',     onData);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('canplay',        onCan);
    audio.addEventListener('ended',          onEnd);
    audio.addEventListener('error',          onErr);
    return () => {
      audio.removeEventListener('loadeddata',     onData);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('canplay',        onCan);
      audio.removeEventListener('ended',          onEnd);
      audio.removeEventListener('error',          onErr);
      audio.pause();
    };
  }, [stepIdx, currentStep?.audio, allSteps.length, repeat]); // eslint-disable-line

  /* ── Playback controls ── */
  const togglePlay = async () => {
    if (isLoading || audioError) return;
    const audio = audioRef.current;
    if (isPlaying) { audio.pause(); setIsPlaying(false); autoPlayRef.current = false; }
    else {
      try { await audio.play(); setIsPlaying(true); autoPlayRef.current = true; }
      catch(e) { setAudioError('Playback failed: ' + e.message); }
    }
  };

  const jumpTo = idx => { audioRef.current.pause(); setIsPlaying(false); autoPlayRef.current = true; setStepIdx(idx); };
  const prev   = () => { if (stepIdx > 0) jumpTo(stepIdx - 1); };
  const next   = () => {
    if (shuffle) jumpTo(Math.floor(Math.random() * allSteps.length));
    else if (stepIdx < allSteps.length - 1) jumpTo(stepIdx + 1);
  };
  const seek   = e => {
    if (!duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  /* ── Downloads ── */
  const downloadAll = async () => {
    for (const s of allSteps) {
      if (s.audio) try { await apiService.downloadAudio(s.audio, `chunk_${s.iIdx + 1}.mp3`); } catch(_) {}
    }
  };
  const exportBrief = () => {
    const lines = allSteps.map((s, i) => `Step ${i+1}: ${s.text}`).join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${currentJob?.name || 'brief'}_educational_brief.txt`; a.click();
  };
  const downloadStep = (step, idx) => {
    if (step.audio) apiService.downloadAudio(step.audio, `audio_chunk_0${idx + 1}.mp3`);
  };

  /* ── Filter ── */
  const filtered = allSteps.filter((s, _) =>
    !search || s.text?.toLowerCase().includes(search.toLowerCase()) ||
               s.instTitle?.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Empty state ── */
  const F = { fontFamily: "'Inter', sans-serif" };

  if (!currentJob) return (
    <div style={{ ...F, display:'flex', alignItems:'center', justifyContent:'center', height:'100%', backgroundColor:'#f6f7f9' }}>
      <p style={{ color:'#94a3b8', fontSize:'14px' }}>No job selected. Go back and choose a recording.</p>
    </div>
  );

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={containerRef} style={{ ...F, display:'flex', flexDirection:'column', height:'100%', backgroundColor:'#f6f7f9', overflow:'hidden' }}>

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <div style={{
        backgroundColor:'#fff', borderBottom:'1px solid #e8eaf0',
        padding:'14px 28px', display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0,
      }}>
        {/* Left: back + title */}
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <button
            onClick={() => setCurrentPage && setCurrentPage('dashboard')}
            style={{ display:'flex', alignItems:'center', gap:'4px', background:'none', border:'none', cursor:'pointer', padding:0, color:'#475569', fontSize:'13px', fontWeight:500 }}
          >
            <ChevronLeft style={{ width:'16px', height:'16px' }} />
            Home
          </button>
          <h1 style={{ fontSize:'20px', fontWeight:700, color:'#1e293b', margin:0, lineHeight:1.3 }}>
            {currentJob.name}
          </h1>
        </div>

        {/* Right: action buttons */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button onClick={exportBrief} style={{
            padding:'8px 18px', borderRadius:'20px',
            border:'1.5px solid #cbd5e1', background:'#fff',
            color:'#334155', fontSize:'13px', fontWeight:600, cursor:'pointer',
          }}>
            Export Educational Brief
          </button>
          <button onClick={downloadAll} style={{
            padding:'8px 20px', borderRadius:'20px',
            border:'none', background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            color:'#fff', fontSize:'13px', fontWeight:600, cursor:'pointer',
            boxShadow:'0 2px 8px rgba(59,130,246,0.35)',
          }}>
            Download All Modules
          </button>
        </div>
      </div>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, display:'flex', gap:'20px', padding:'20px 28px', minHeight:0, overflow:'hidden', justifyContent:'center' }}>

        {/* ── LEFT: Instruction Chunks list (Toggleable) ───────────────────── */}
        {showList && (
          <div style={{
            flex:1, minWidth:0, maxWidth:'600px', backgroundColor:'#fff',
            borderRadius:'16px', border:'1px solid #e2e8f0',
            display:'flex', flexDirection:'column', overflow:'hidden',
          }}>
          {/* Search */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
            <div style={{ position:'relative' }}>
              <Search style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', width:'15px', height:'15px', color:'#94a3b8' }} />
              <input
                type="text"
                placeholder="Search chunks or word..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width:'100%', boxSizing:'border-box',
                  paddingLeft:'36px', paddingRight:'14px', paddingTop:'9px', paddingBottom:'9px',
                  border:'1.5px solid #e2e8f0', borderRadius:'10px',
                  fontSize:'13px', color:'#475569', outline:'none',
                  backgroundColor:'#f8fafc',
                }}
              />
            </div>
          </div>

          {/* Chunk rows */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
            {filtered.length === 0 ? (
              <p style={{ textAlign:'center', color:'#94a3b8', fontSize:'13px', paddingTop:'40px' }}>
                No instruction chunks found.
              </p>
            ) : filtered.map((step, listIdx) => {
              const gIdx   = allSteps.indexOf(step);
              const active = gIdx === stepIdx;
              return (
                <div
                  key={`${step.iIdx}-${step.sIdx}`}
                  style={{
                    display:'flex', alignItems:'flex-start', gap:'14px',
                    padding:'14px 24px',
                    backgroundColor: active ? '#f0f7ff' : 'transparent',
                    borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
                    transition:'background 0.15s',
                    cursor:'pointer',
                  }}
                  onClick={() => jumpTo(gIdx)}
                >
                  {/* Step Number */}
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#64748b', flexShrink:0, paddingTop:'8px', minWidth:'48px' }}>
                    Step {gIdx + 1}:
                  </span>

                  {/* Play circle */}
                  <div style={{ paddingTop:'4px', flexShrink:0 }}>
                    <PlayCircle
                      active={active}
                      loading={isLoading}
                      playing={isPlaying}
                      onClick={e => { e.stopPropagation(); active ? togglePlay() : jumpTo(gIdx); }}
                    />
                  </div>

                  {/* Instruction text */}
                  <p style={{
                    margin:0, fontSize:'14px', lineHeight:1.65, flex:1,
                    color: active ? '#1d4ed8' : '#2563eb',
                    fontWeight: active ? 600 : 500,
                  }}>
                    {step.text}
                  </p>
                </div>
              );
            })}
          </div>
          </div>
        )}

        {/* ── RIGHT: AI Learning Modules ───────────────────────────────────── */}
        <div style={{
          width:'340px', flexShrink:0,
          display:'flex', flexDirection:'column', gap:'16px',
          overflowY:'auto',
        }}>
          {/* Error banner */}
          {audioError && (
            <div style={{ padding:'10px 14px', backgroundColor:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', display:'flex', alignItems:'flex-start', gap:'8px', flexShrink:0 }}>
              <AlertCircle style={{ width:'14px', height:'14px', color:'#ef4444', flexShrink:0, marginTop:'1px' }} />
              <span style={{ fontSize:'12px', color:'#dc2626' }}>{audioError}</span>
            </div>
          )}

          <h2 style={{ margin:0, fontSize:'17px', fontWeight:700, color:'#1e293b', paddingLeft:'2px', flexShrink:0 }}>
            AI-Generated Learning Modules
          </h2>

          {/* Per-instruction cards */}
          {(currentJob.instructions || []).map((inst, iIdx) => {
            const step = inst.steps[0];
            const gIdx = allSteps.findIndex(s => s.iIdx === iIdx && s.sIdx === 0);
            const active = gIdx === stepIdx;
            const fname = `audio_chunk_0${gIdx + 1}.mp3`;

            return (
              <div key={iIdx} style={{
                backgroundColor:'#fff', 
                borderRadius:'16px',
                padding: '20px',
                boxShadow: active ? '0 4px 20px rgba(59,130,246,0.1)' : '0 2px 12px rgba(0,0,0,0.03)',
                border: active ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}>
                {/* Light purple instruction box */}
                <div style={{
                  backgroundColor: '#f5f4fa',
                  borderRadius: '8px',
                  padding: '14px 16px',
                }}>
                  <p style={{ margin:0, fontSize:'14px', color:'#334155', lineHeight:1.5 }}>
                    <span style={{ fontWeight:700, color:'#475569' }}>Step {iIdx + 1}:</span>
                    {' '}
                    <span style={{ fontWeight:500 }}>{inst.instruction}</span>
                  </p>
                </div>

                {/* Play Segment + Download Row */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: '0 4px' }}>
                  {/* Play Segment */}
                  <button
                    onClick={() => active ? togglePlay() : jumpTo(gIdx)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', background:'none', border:'none', cursor:'pointer', padding:0 }}
                  >
                    <PlayCircle size={28} active={active} loading={isLoading} playing={isPlaying} onClick={() => {}} />
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#334155' }}>
                      {active && isPlaying ? 'Playing…' : 'Play Segment'}
                    </span>
                  </button>

                  {/* Download */}
                  <button
                    onClick={() => downloadStep(step, gIdx)}
                    title="Download"
                    style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', cursor:'pointer', padding:0 }}
                  >
                    <Download style={{ width:'14px', height:'14px', color:'#64748b' }} />
                    <span style={{ fontSize:'12px', color:'#64748b', fontWeight:500 }}>{fname}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {allSteps.length === 0 && (
            <p style={{ textAlign:'center', color:'#94a3b8', fontSize:'13px', paddingTop:'24px' }}>
              No instruction chunks available.
            </p>
          )}
        </div>
      </div>

      {/* ══ BOTTOM AUDIO PLAYER ══════════════════════════════════════════════ */}
      <div style={{
        padding: '0 28px 24px 28px',
        flexShrink: 0,
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '100px',
          border: '1px solid #cbd5e1',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        }}>
          {/* Left: Waveform Pill */}
          <div style={{
            backgroundColor: '#f1f5f9',
            borderRadius: '100px',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '180px',
          }}>
            <WaveBars playing={isPlaying} />
          </div>

          {/* Middle: Transport & Progress */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', maxWidth: '500px', margin: '0 40px' }}>
            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button onClick={() => setShuffle(s => !s)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color: shuffle ? '#3b82f6' : '#94a3b8' }}>
                <Shuffle style={{ width:'18px', height:'18px' }} />
              </button>
              <button onClick={prev} disabled={stepIdx === 0} style={{ background:'none', border:'none', cursor: stepIdx===0 ? 'not-allowed':'pointer', padding:0, color:'#94a3b8', opacity: stepIdx===0 ? 0.4 : 1 }}>
                <SkipBack style={{ width:'20px', height:'20px', fill: 'currentColor' }} />
              </button>

              {/* Main play button */}
              <button
                onClick={togglePlay}
                disabled={isLoading || !!audioError}
                style={{
                  width:'44px', height:'44px', borderRadius:'50%',
                  background:'#dbeafe',
                  border:'none', cursor: (isLoading || audioError) ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  opacity: (isLoading || audioError) ? 0.5 : 1,
                }}
              >
                {isLoading
                  ? <Loader2 style={{ width:'18px', height:'18px', color:'#3b82f6', animation:'sw-spin 1s linear infinite' }} />
                  : isPlaying
                    ? <Pause style={{ width:'18px', height:'18px', color:'#3b82f6', fill: 'currentColor' }} />
                    : <Play  style={{ width:'18px', height:'18px', color:'#3b82f6', fill: 'currentColor', marginLeft:'2px' }} />}
              </button>

              <button onClick={next} disabled={!shuffle && stepIdx === allSteps.length - 1} style={{ background:'none', border:'none', cursor:(!shuffle&&stepIdx===allSteps.length-1)?'not-allowed':'pointer', padding:0, color:'#94a3b8', opacity:(!shuffle&&stepIdx===allSteps.length-1)?0.4:1 }}>
                <SkipForward style={{ width:'20px', height:'20px', fill: 'currentColor' }} />
              </button>
              <button onClick={() => setRepeat(r => !r)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color: repeat ? '#3b82f6' : '#94a3b8' }}>
                <Repeat style={{ width:'18px', height:'18px' }} />
              </button>
            </div>

            {/* Progress */}
            <div style={{ width: '100%', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:500, flexShrink:0 }}>{fmt(currentTime)}</span>
              <div onClick={seek} style={{ flex:1, height:'4px', backgroundColor:'#e2e8f0', borderRadius:'2px', cursor:'pointer' }}>
                <div style={{ height:'100%', backgroundColor:'#64748b', borderRadius:'2px', width:`${progressPct}%`, transition:'width 0.1s' }} />
              </div>
              <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:500, flexShrink:0 }}>{fmt(duration)}</span>
            </div>
          </div>

          {/* Right: Volume & Extra */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, width: '180px', justifyContent: 'flex-end' }}>
            {/* Playlist Toggle */}
            <button 
              onClick={() => setShowList(s => !s)}
              title="Toggle Chunk List"
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, color: showList ? '#3b82f6' : '#94a3b8' }}
            >
              <ListMusic style={{ width:'18px', height:'18px' }} />
            </button>
            
            {/* Volume Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={() => setIsMuted(m => !m)}
                title={isMuted ? "Unmute" : "Mute"}
                style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#94a3b8' }}
              >
                {isMuted || volume === 0 ? <VolumeX style={{ width:'18px', height:'18px' }} /> : <Volume2 style={{ width:'18px', height:'18px' }} />}
              </button>
              <div 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const val = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  setVolume(val);
                  if (isMuted && val > 0) setIsMuted(false);
                }}
                style={{ width: '60px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', cursor: 'pointer', display: 'flex' }}
              >
                <div style={{ width: `${(isMuted ? 0 : volume) * 100}%`, height: '100%', backgroundColor: '#94a3b8', borderRadius: '2px', transition: 'width 0.1s' }}></div>
              </div>
            </div>

            {/* Fullscreen Toggle */}
            <button 
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#94a3b8' }}
            >
              {isFullscreen ? <Minimize2 style={{ width:'16px', height:'16px' }} /> : <Maximize2 style={{ width:'16px', height:'16px' }} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentWorkspace;