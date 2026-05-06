// Frontend/src/pages/AuthPage.jsx
// Views: login | signup | verify-otp | forgot | reset-otp

import React, { useState, useRef } from 'react';
import {
  Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft,
  Mail, Lock, User, AlertCircle, KeyRound, ShieldCheck,
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';

// ─── Shared primitives ────────────────────────────────────────────────────────

const Input = ({ icon: Icon, type = 'text', placeholder, value, onChange, rightEl, disabled, autoFocus }) => (
  <div className="relative">
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      autoFocus={autoFocus}
      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-400 focus:bg-white
                 disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-slate-400"
    />
    {rightEl && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightEl}</div>}
  </div>
);

const ErrorBox = ({ msg }) => msg ? (
  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
    <span>{msg}</span>
  </div>
) : null;

const SuccessBox = ({ msg }) => msg ? (
  <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
    <span>{msg}</span>
  </div>
) : null;

const PrimaryBtn = ({ loading, label, type = 'submit' }) => (
  <button
    type={type}
    disabled={loading}
    className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-sky-700
               hover:from-sky-600 hover:to-sky-800 active:scale-[0.98]
               text-white rounded-2xl font-semibold text-sm
               transition-all duration-150 shadow-md shadow-sky-200/60
               disabled:opacity-50 disabled:cursor-not-allowed
               flex items-center justify-center gap-2"
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
    {label}
  </button>
);

const BackBtn = ({ onClick, label = 'Back' }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-600
               transition-colors mb-5 group"
  >
    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
    {label}
  </button>
);

// ─── OTP 6-box input ──────────────────────────────────────────────────────────
const OtpBoxes = ({ value, onChange, disabled }) => {
  const inputs = useRef([]);
  const digits = (value + '      ').slice(0, 6).split('');

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = value.slice(0, idx) + value.slice(idx + 1);
      onChange(next);
      if (idx > 0) inputs.current[idx - 1]?.focus();
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = (value.slice(0, idx) + e.key + value.slice(idx + 1)).slice(0, 6);
      onChange(next);
      if (idx < 5) inputs.current[idx + 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={el => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i].trim()}
          onChange={() => {}}
          onKeyDown={e => handleKey(e, i)}
          onFocus={e => e.target.select()}
          disabled={disabled}
          autoFocus={i === 0}
          className={`w-11 text-center text-xl font-bold border-2 rounded-xl py-3
                      transition-all duration-150 outline-none
                      ${digits[i].trim()
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-slate-50 text-slate-800'}
                      focus:border-sky-500 focus:bg-sky-50 focus:ring-2 focus:ring-sky-200
                      disabled:opacity-50`}
        />
      ))}
    </div>
  );
};

// ─── Resend with 60 s cooldown ────────────────────────────────────────────────
const ResendLink = ({ onResend }) => {
  const [cooldown, setCooldown] = useState(0);
  const [busy,     setBusy]     = useState(false);
  const [sent,     setSent]     = useState(false);

  const click = async () => {
    setBusy(true); setSent(false);
    await onResend();
    setBusy(false); setSent(true);
    setCooldown(60);
    const t = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    setTimeout(() => setSent(false), 3500);
  };

  if (cooldown > 0) return <span className="text-slate-400">Resend in {cooldown}s</span>;
  return (
    <>
      {sent && <span className="text-green-600 font-semibold">Sent! </span>}
      <button type="button" onClick={click} disabled={busy}
              className="text-sky-600 font-semibold hover:underline disabled:opacity-50">
        {busy ? 'Sending…' : 'Resend code'}
      </button>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
const LoginForm = ({ onSuccess, onGoSignup, onGoForgot }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem('rehear_token', data.token);
      localStorage.setItem('rehear_user',  JSON.stringify(data.user));
      onSuccess();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox msg={error} />
      <Input icon={Mail} type="email" placeholder="Email address"
             value={email} onChange={e => setEmail(e.target.value)} disabled={loading} autoFocus />
      <div className="space-y-1">
        <Input icon={Lock} type={showPw ? 'text' : 'password'} placeholder="Password"
               value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
               rightEl={
                 <button type="button" onClick={() => setShowPw(s => !s)}
                         className="text-slate-400 hover:text-sky-500 transition-colors">
                   {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                 </button>
               } />
        <div className="flex justify-end">
          <button type="button" onClick={onGoForgot}
                  className="text-xs text-sky-600 hover:underline font-medium py-0.5">
            Forgot password?
          </button>
        </div>
      </div>
      <PrimaryBtn loading={loading} label="Sign In" />
      <p className="text-center text-xs text-slate-500 pt-1">
        Don't have an account?{' '}
        <button type="button" onClick={onGoSignup}
                className="text-sky-600 font-semibold hover:underline">Create one</button>
      </p>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────────────────────────────────────
const SignupForm = ({ onGoLogin, onNeedOtp }) => {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !pass || !confirm) { setError('Please fill in all fields.'); return; }
    if (pass !== confirm)  { setError('Passwords do not match.'); return; }
    if (pass.length < 6)   { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Signup failed');
      onNeedOtp(email.trim().toLowerCase());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox msg={error} />
      <Input icon={User} placeholder="Full name" value={name}
             onChange={e => setName(e.target.value)} disabled={loading} autoFocus />
      <Input icon={Mail} type="email" placeholder="Email address" value={email}
             onChange={e => setEmail(e.target.value)} disabled={loading} />
      <Input icon={Lock} type={showPw ? 'text' : 'password'} placeholder="Password (min 6 chars)"
             value={pass} onChange={e => setPass(e.target.value)} disabled={loading}
             rightEl={
               <button type="button" onClick={() => setShowPw(s => !s)}
                       className="text-slate-400 hover:text-sky-500 transition-colors">
                 {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
               </button>
             } />
      <Input icon={Lock} type={showPw ? 'text' : 'password'} placeholder="Confirm password"
             value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading} />
      <PrimaryBtn loading={loading} label="Create Account" />
      <p className="text-center text-xs text-slate-500 pt-1">
        Already have an account?{' '}
        <button type="button" onClick={onGoLogin}
                className="text-sky-600 font-semibold hover:underline">Sign in</button>
      </p>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL OTP  (post-signup)
// ─────────────────────────────────────────────────────────────────────────────
const VerifyOtpForm = ({ email, onVerified, onGoLogin }) => {
  const [otp,     setOtp]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Please enter the complete 6-digit code.'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Verification failed');
      onVerified();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const resend = () =>
    fetch(`${API_BASE_URL}/api/auth/resend-otp?email=${encodeURIComponent(email)}`, { method: 'POST' });

  return (
    <form onSubmit={submit} className="space-y-5">
      <BackBtn onClick={onGoLogin} label="Back to login" />
      <div className="text-center">
        <div className="w-12 h-12 mx-auto bg-sky-50 border border-sky-100 rounded-full flex items-center justify-center mb-3">
          <Mail className="w-5 h-5 text-sky-500" />
        </div>
        <p className="text-xs text-slate-500">
          Code sent to <span className="font-semibold text-slate-700">{email}</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Expires in 2 minutes</p>
      </div>
      <ErrorBox msg={error} />
      <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
      <PrimaryBtn loading={loading} label="Verify Email" />
      <p className="text-center text-xs text-slate-500">
        Didn't receive it? <ResendLink onResend={resend} />
      </p>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — step 1: enter email
// ─────────────────────────────────────────────────────────────────────────────
const ForgotForm = ({ onGoLogin, onCodeSent }) => {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send reset code');
      onCodeSent(email.trim().toLowerCase());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <BackBtn onClick={onGoLogin} label="Back to login" />
      <div className="text-center">
        <div className="w-12 h-12 mx-auto bg-sky-50 border border-sky-100 rounded-full flex items-center justify-center mb-3">
          <KeyRound className="w-5 h-5 text-sky-500" />
        </div>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Enter your account email and we'll send a 6-digit reset code.
        </p>
      </div>
      <ErrorBox msg={error} />
      <Input icon={Mail} type="email" placeholder="Your account email"
             value={email} onChange={e => setEmail(e.target.value)} disabled={loading} autoFocus />
      <PrimaryBtn loading={loading} label="Send Reset Code" />
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — step 2: OTP + new password
// ─────────────────────────────────────────────────────────────────────────────
const ResetPasswordForm = ({ email, onReset, onGoLogin }) => {
  const [otp,      setOtp]      = useState('');
  const [pass,     setPass]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6)     { setError('Please enter the complete 6-digit code.'); return; }
    if (pass.length < 6)      { setError('Password must be at least 6 characters.'); return; }
    if (pass !== confirm)     { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Reset failed');
      setSuccess('Password reset! Redirecting to login…');
      setTimeout(onReset, 2000);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const resendReset = () =>
    fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

  return (
    <form onSubmit={submit} className="space-y-4">
      <BackBtn onClick={onGoLogin} label="Back to login" />
      <div className="text-center">
        <div className="w-12 h-12 mx-auto bg-sky-50 border border-sky-100 rounded-full flex items-center justify-center mb-3">
          <ShieldCheck className="w-5 h-5 text-sky-500" />
        </div>
        <p className="text-xs text-slate-500">
          Code sent to <span className="font-semibold text-slate-700">{email}</span>
        </p>
      </div>
      <ErrorBox msg={error} />
      <SuccessBox msg={success} />
      {!success && (
        <>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2.5 text-center">Enter reset code</p>
            <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
          </div>
          <Input icon={Lock} type={showPw ? 'text' : 'password'}
                 placeholder="New password (min 6 chars)"
                 value={pass} onChange={e => setPass(e.target.value)} disabled={loading}
                 rightEl={
                   <button type="button" onClick={() => setShowPw(s => !s)}
                           className="text-slate-400 hover:text-sky-500 transition-colors">
                     {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                   </button>
                 } />
          <Input icon={Lock} type={showPw ? 'text' : 'password'}
                 placeholder="Confirm new password"
                 value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading} />
          <PrimaryBtn loading={loading} label="Reset Password" />
          <p className="text-center text-xs text-slate-500">
            Code expired? <ResendLink onResend={resendReset} />
          </p>
        </>
      )}
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — view router
// ─────────────────────────────────────────────────────────────────────────────
const VIEWS = {
  login:        { heading: 'Welcome back',         sub: 'Sign in to your APD Rehear account' },
  signup:       { heading: 'Create your account',  sub: 'Start capturing classroom instructions today' },
  'verify-otp': { heading: 'Verify your email',    sub: 'Enter the code we sent to your inbox' },
  forgot:       { heading: 'Forgot password?',     sub: "We'll send a reset code to your email" },
  'reset-otp':  { heading: 'Reset your password',  sub: 'Enter the code and choose a new password' },
};

const AuthPage = ({ onAuthenticated }) => {
  const [view,         setView]         = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');

  const { heading, sub } = VIEWS[view];

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px]">

        {/* ── Logo — mix-blend-mode:multiply dissolves white PNG bg into sky-50 ── */}
        <div className="flex flex-col items-center mb-7">
          <img
            src="/rehear-logo.png"
            alt="Rehear APD"
            className="h-14 w-auto object-contain mb-5"
            style={{
              mixBlendMode: 'multiply',
              filter: 'drop-shadow(0 1px 6px rgba(14,165,233,0.20))',
            }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-[1.55rem] font-bold text-slate-900 tracking-tight">{heading}</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">{sub}</p>
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-sky-100/80 px-8 py-7">
          {view === 'login' && (
            <LoginForm
              onSuccess={onAuthenticated}
              onGoSignup={() => setView('signup')}
              onGoForgot={() => setView('forgot')}
            />
          )}
          {view === 'signup' && (
            <SignupForm
              onGoLogin={() => setView('login')}
              onNeedOtp={email => { setPendingEmail(email); setView('verify-otp'); }}
            />
          )}
          {view === 'verify-otp' && (
            <VerifyOtpForm
              email={pendingEmail}
              onVerified={() => setView('login')}
              onGoLogin={() => setView('login')}
            />
          )}
          {view === 'forgot' && (
            <ForgotForm
              onGoLogin={() => setView('login')}
              onCodeSent={email => { setPendingEmail(email); setView('reset-otp'); }}
            />
          )}
          {view === 'reset-otp' && (
            <ResetPasswordForm
              email={pendingEmail}
              onReset={() => setView('login')}
              onGoLogin={() => setView('login')}
            />
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          © 2026 Rehear APD · Accessible Learning Technology
        </p>
      </div>
    </div>
  );
};

export default AuthPage;