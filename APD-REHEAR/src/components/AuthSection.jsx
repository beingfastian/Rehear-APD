import { useState } from 'react';
import { isValidEmail } from '../utils/validation';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthSection() {
  const { user, token, ready, login, signup, logout } = useAuth();
  const [tab, setTab] = useState('login');
  const [loginMsg, setLoginMsg] = useState({ text: '', ok: true });
  const [signupMsg, setSignupMsg] = useState({ text: '', ok: true });
  const [loginPending, setLoginPending] = useState(false);
  const [signupPending, setSignupPending] = useState(false);

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
      setLoginMsg({
        text: 'Password must be at least 6 characters.',
        ok: false,
      });
      return;
    }

    setLoginMsg({ text: '', ok: true });
    setLoginPending(true);
    try {
      await login({ email, password });
      setLoginMsg({
        text: 'Login successful. Welcome back to Rehear!',
        ok: true,
      });
      form.reset();
    } catch (err) {
      setLoginMsg({
        text: err.message || 'Login failed. Try again.',
        ok: false,
      });
    } finally {
      setLoginPending(false);
    }
  };

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
      setSignupMsg({
        text: 'Use at least 6 characters for password.',
        ok: false,
      });
      return;
    }

    setSignupMsg({ text: '', ok: true });
    setSignupPending(true);
    try {
      await signup({ name, email, password });
      setSignupMsg({
        text: 'Account created. You are signed in.',
        ok: true,
      });
      form.reset();
    } catch (err) {
      setSignupMsg({
        text: err.message || 'Signup failed. Try again.',
        ok: false,
      });
    } finally {
      setSignupPending(false);
    }
  };

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
              href={`http://localhost:3000?token=${encodeURIComponent(token || '')}`}
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
            <form
              className="auth-form"
              onSubmit={handleLogin}
              noValidate
              aria-label="Login"
            >
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={loginPending}
              />
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                required
                disabled={loginPending}
              />
              <button
                type="submit"
                className="btn btn-primary full"
                disabled={loginPending}
              >
                {loginPending ? 'Signing in…' : 'Login'}
              </button>
              <p
                className={`form-message ${loginMsg.ok ? 'ok' : 'err'}`}
                role="status"
              >
                {loginMsg.text}
              </p>
            </form>
          )}

          {tab === 'signup' && (
            <form
              className="auth-form"
              onSubmit={handleSignup}
              noValidate
              aria-label="Sign up"
            >
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                required
                disabled={signupPending}
              />
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={signupPending}
              />
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Create password"
                required
                disabled={signupPending}
              />
              <button
                type="submit"
                className="btn btn-primary full"
                disabled={signupPending}
              >
                {signupPending ? 'Creating account…' : 'Create Account'}
              </button>
              <p
                className={`form-message ${signupMsg.ok ? 'ok' : 'err'}`}
                role="status"
              >
                {signupMsg.text}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
