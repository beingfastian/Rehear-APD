import { useState } from 'react';
import { isValidEmail } from '../utils/validation';
import { useAuth } from '../context/AuthContext.jsx';
import { verifyOtp, resendOtp } from '../api/authApi.js';

export default function AuthSection() {
  const { user, ready, login, signup, logout } = useAuth();
  const [tab, setTab] = useState('login');

  // Login state
  const [loginMsg, setLoginMsg] = useState({ text: '', ok: true });
  const [loginPending, setLoginPending] = useState(false);

  // Signup state
  const [signupMsg, setSignupMsg] = useState({ text: '', ok: true });
  const [signupPending, setSignupPending] = useState(false);

  // OTP verification state — shown after successful signup
  const [otpStage, setOtpStage] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpMsg, setOtpMsg] = useState({ text: '', ok: true });
  const [otpPending, setOtpPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!isValidEmail(email)) {
      setLoginMsg({ text: 'Please enter a valid email address.', ok: false });
      return;
    }
    if (password.length < 6) {
      setLoginMsg({ text: 'Password must be at least 6 characters.', ok: false });
      return;
    }

    setLoginMsg({ text: '', ok: true });
    setLoginPending(true);
    try {
      await login({ email, password });
      setLoginMsg({ text: 'Login successful. Welcome back to Rehear!', ok: true });
      form.reset();
    } catch (err) {
      setLoginMsg({ text: err.message || 'Login failed. Try again.', ok: false });
    } finally {
      setLoginPending(false);
    }
  };

  // ── Signup ─────────────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (name.length < 2) {
      setSignupMsg({ text: 'Please enter your full name.', ok: false });
      return;
    }
    if (!isValidEmail(email)) {
      setSignupMsg({ text: 'Please enter a valid email address.', ok: false });
      return;
    }
    if (password.length < 6) {
      setSignupMsg({ text: 'Use at least 6 characters for password.', ok: false });
      return;
    }

    setSignupMsg({ text: '', ok: true });
    setSignupPending(true);
    try {
      await signup({ name, email, password });
      setPendingEmail(email);
      setOtpStage(true);
      setOtpMsg({ text: `A 6-digit code was sent to ${email}. It expires in 2 minutes.`, ok: true });
      form.reset();
    } catch (err) {
      setSignupMsg({ text: err.message || 'Signup failed. Try again.', ok: false });
    } finally {
      setSignupPending(false);
    }
  };

  // ── OTP Verify ─────────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setOtpMsg({ text: 'Please enter the 6-digit code.', ok: false });
      return;
    }
    setOtpPending(true);
    setOtpMsg({ text: '', ok: true });
    try {
      await verifyOtp({ email: pendingEmail, otp: otp.trim() });
      setOtpMsg({ text: 'Email verified! You can now log in.', ok: true });
      setTimeout(() => {
        setOtpStage(false);
        setOtp('');
        setTab('login');
        setLoginMsg({ text: 'Account verified. Please log in.', ok: true });
      }, 1500);
    } catch (err) {
      setOtpMsg({ text: err.message || 'Invalid or expired code.', ok: false });
    } finally {
      setOtpPending(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResendPending(true);
    setOtpMsg({ text: '', ok: true });
    try {
      await resendOtp(pendingEmail);
      setOtpMsg({ text: 'A new code has been sent. Check your inbox.', ok: true });
    } catch (err) {
      setOtpMsg({ text: err.message || 'Could not resend. Try again.', ok: false });
    } finally {
      setResendPending(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <section className="auth-section section-pad" id="auth">
        <div className="container auth-grid">
          <div className="auth-copy">
            <p className="eyebrow subtle">Account</p>
            <h2>Join Rehear today</h2>
          </div>
          <div className="auth-card auth-loading">
            <p className="section-text">Checking your session…</p>
          </div>
        </div>
      </section>
    );
  }

  // ── Logged in ──────────────────────────────────────────────────────────────
  if (user) {
    return (
      <section className="auth-section section-pad" id="auth">
        <div className="container auth-grid">
          <div className="auth-copy">
            <p className="eyebrow subtle">Account</p>
            <h2>You&apos;re signed in</h2>
            <p>
              Welcome back, <strong>{user.name}</strong>. Your replay and
              listening tools are ready when you are.
            </p>
            <p className="small-note">{user.email}</p>
          </div>
          <div className="auth-card auth-logged-in">
            <p className="logged-in-label">Signed in as</p>
            <p className="logged-in-name">{user.name}</p>
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary full"
              style={{ display: 'block', textAlign: 'center', marginBottom: '0.75rem' }}
            >
              Launch APD Tool
            </a>
            <button
              type="button"
              className="btn btn-outline full"
              onClick={() => {
                logout();
                setLoginMsg({ text: '', ok: true });
                setSignupMsg({ text: '', ok: true });
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── OTP Stage ──────────────────────────────────────────────────────────────
  if (otpStage) {
    return (
      <section className="auth-section section-pad" id="auth">
        <div className="container auth-grid">
          <div className="auth-copy">
            <p className="eyebrow subtle">Verify Email</p>
            <h2>Check your inbox</h2>
            <p>
              We sent a 6-digit code to <strong>{pendingEmail}</strong>.
              Enter it below to activate your account.
            </p>
            <p className="small-note" style={{ marginTop: '1rem', fontStyle: 'italic' }}>
              The code expires in 2 minutes. Check spam if you don't see it.
            </p>
          </div>
          <div className="auth-card">
            <form className="auth-form" onSubmit={handleVerifyOtp} noValidate>
              <label htmlFor="otp-code">Verification Code</label>
              <input
                id="otp-code"
                name="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.5rem' }}
                required
                disabled={otpPending}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-primary full"
                disabled={otpPending}
              >
                {otpPending ? 'Verifying…' : 'Verify Email'}
              </button>
              <p className={`form-message ${otpMsg.ok ? 'ok' : 'err'}`} role="status">
                {otpMsg.text}
              </p>
            </form>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-outline full"
                onClick={handleResend}
                disabled={resendPending}
              >
                {resendPending ? 'Sending…' : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Login / Signup tabs ────────────────────────────────────────────────────
  return (
    <section className="auth-section section-pad" id="auth">
      <div className="container auth-grid">
        <div className="auth-copy">
          <p className="eyebrow subtle">Get Early Access</p>
          <h2>Help students rehear what matters.</h2>
          <p>
            If spoken instructions are easy to miss, Rehear helps make them easier to capture, understand, and revisit in any classroom.
          </p>
          <p className="small-note" style={{ marginTop: '1rem', fontStyle: 'italic' }}>
            Rehear is a learning support tool designed to improve access to spoken instruction. It does not diagnose or treat APD and should not replace professional medical assessment.
          </p>
        </div>

        <div className="auth-card">
          <div className="tabs" role="tablist" aria-label="Authentication">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => setTab('login')}
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              className={`tab ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => setTab('signup')}
            >
              Signup
            </button>
          </div>

          {tab === 'login' && (
            <form className="auth-form" onSubmit={handleLogin} noValidate aria-label="Login">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" name="email" type="email" autoComplete="email"
                placeholder="you@example.com" required disabled={loginPending} />
              <label htmlFor="login-password">Password</label>
              <input id="login-password" name="password" type="password" autoComplete="current-password"
                placeholder="Enter password" required disabled={loginPending} />
              <button type="submit" className="btn btn-primary full" disabled={loginPending}>
                {loginPending ? 'Signing in…' : 'Login'}
              </button>
              <p className={`form-message ${loginMsg.ok ? 'ok' : 'err'}`} role="status">
                {loginMsg.text}
              </p>
            </form>
          )}

          {tab === 'signup' && (
            <form className="auth-form" onSubmit={handleSignup} noValidate aria-label="Sign up">
              <label htmlFor="signup-name">Full Name</label>
              <input id="signup-name" name="name" type="text" autoComplete="name"
                placeholder="Your name" required disabled={signupPending} />
              <label htmlFor="signup-email">Email</label>
              <input id="signup-email" name="email" type="email" autoComplete="email"
                placeholder="you@example.com" required disabled={signupPending} />
              <label htmlFor="signup-password">Password</label>
              <input id="signup-password" name="password" type="password" autoComplete="new-password"
                placeholder="Create password" required disabled={signupPending} />
              <button type="submit" className="btn btn-primary full" disabled={signupPending}>
                {signupPending ? 'Creating account…' : 'Create Account'}
              </button>
              <p className={`form-message ${signupMsg.ok ? 'ok' : 'err'}`} role="status">
                {signupMsg.text}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
