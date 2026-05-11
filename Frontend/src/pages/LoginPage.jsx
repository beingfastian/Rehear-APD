import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import GoogleSignInButton from '../components/shared/GoogleSignInButton';
import { useApp } from '../context/AppContext';

const LoginPage = ({ setCurrentPage, pageData = {} }) => {
  const { loginWithPassword, loginWithGoogle, showNotification } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (pageData.email) {
      setEmail(pageData.email);
    }
  }, [pageData.email]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await loginWithPassword({ email, password });
      showNotification('Signed in successfully.', 'success');
      setCurrentPage('dashboard');
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async (credential) => {
    await loginWithGoogle(credential);
    showNotification('Signed in with Google.', 'success');
    setCurrentPage('dashboard');
  };

  return (
    <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-8 items-stretch">
        <div className="hidden lg:flex rounded-[2rem] bg-slate-950 text-white p-10 flex-col justify-between overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(96,165,250,0.2),_transparent_32%)]" />
          <div className="relative">
            <img src="/rehear-logo-transparent.png" alt="Rehear APD" className="h-24 w-auto object-contain" />
            <p className="mt-8 text-sky-200 text-sm uppercase tracking-[0.22em] font-semibold">APD Listener Tool</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">Sign in to manage recordings, AI usage, and subscription-backed access.</h1>
            <p className="mt-5 text-slate-300 text-base leading-relaxed max-w-lg">
              Your account now powers billing, protected jobs, and Google sign-in. Use your email and password or switch to Google for a faster path.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-4">
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Auth</p>
              <p className="mt-3 text-lg font-semibold">Google + password</p>
            </div>
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Billing</p>
              <p className="mt-3 text-lg font-semibold">User-linked credits</p>
            </div>
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Security</p>
              <p className="mt-3 text-lg font-semibold">Screened email signup</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-sky-100 shadow-xl shadow-sky-100/60 p-6 sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="lg:hidden flex justify-center mb-6">
              <img src="/rehear-logo-transparent.png" alt="Rehear APD" className="h-20 w-auto object-contain" />
            </div>

            <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Welcome back</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">Sign in</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Access your dashboard, protected jobs, and RevenueCat-linked subscription state.
            </p>

            <div className="mt-6">
              <GoogleSignInButton onCredential={handleGoogleLogin} disabled={isSubmitting} />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.22em] text-gray-400 font-semibold bg-white px-4 w-fit mx-auto">
                or continue with email
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setCurrentPage('forgot-password')}
                    className="text-sm font-semibold text-sky-700 hover:text-sky-800"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-3.5 shadow-lg shadow-sky-200 hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <p className="mt-6 text-sm text-gray-500 text-center">
              New here?{' '}
              <button
                type="button"
                onClick={() => setCurrentPage('signup')}
                className="font-semibold text-sky-700 hover:text-sky-800"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;