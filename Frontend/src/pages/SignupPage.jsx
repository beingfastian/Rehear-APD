import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import GoogleSignInButton from '../components/shared/GoogleSignInButton';
import { useApp } from '../context/AppContext';

const SignupPage = ({ setCurrentPage }) => {
  const { signupWithPassword, loginWithGoogle, showNotification } = useApp();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signupWithPassword({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      showNotification('Account created successfully.', 'success');
      setCurrentPage('dashboard');
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async (credential) => {
    await loginWithGoogle(credential);
    showNotification('Signed in with Google.', 'success');
    setCurrentPage('dashboard');
  };

  return (
    <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-6xl grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-stretch">
        <div className="bg-white rounded-[2rem] border border-sky-100 shadow-xl shadow-sky-100/60 p-6 sm:p-10 order-2 lg:order-1">
          <div className="max-w-md mx-auto">
            <div className="lg:hidden flex justify-center mb-6">
              <img src="/rehear-logo-transparent.png" alt="Rehear APD" className="h-20 w-auto object-contain" />
            </div>

            <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Create account</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">Start with a verified identity</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Email signup now screens obvious dummy domains. You can also skip the password path and continue with Google.
            </p>

            <div className="mt-6">
              <GoogleSignInButton onCredential={handleGoogleSignup} disabled={isSubmitting} />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.22em] text-gray-400 font-semibold bg-white px-4 w-fit mx-auto">
                or sign up with email
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    placeholder="Repeat your password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                    autoComplete="new-password"
                    minLength={6}
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
                {isSubmitting ? 'Creating account…' : 'Create account'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <p className="mt-6 text-sm text-gray-500 text-center">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setCurrentPage('login')}
                className="font-semibold text-sky-700 hover:text-sky-800"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        <div className="hidden lg:flex rounded-[2rem] bg-white/75 border border-white/70 backdrop-blur-xl p-10 flex-col justify-between order-1 lg:order-2 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_32%)]" />
          <div className="relative">
            <img src="/rehear-logo-transparent.png" alt="Rehear APD" className="h-24 w-auto object-contain" />
            <p className="mt-8 text-sky-700 text-sm uppercase tracking-[0.22em] font-semibold">Protected workspace</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-950">Create one account that can hold usage, subscriptions, and future Google-linked access.</h1>
            <p className="mt-5 text-slate-600 text-base leading-relaxed max-w-lg">
              Local signup uses domain screening to reject obviously disposable or non-routable addresses. Google sign-in remains available when you want a faster verified identity.
            </p>
          </div>

          <div className="relative space-y-4">
            <div className="rounded-3xl bg-white/80 border border-sky-100 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-700 font-semibold">Email screening</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">Signup rejects malformed email, domains with no MX records, and a disposable-domain blocklist.</p>
            </div>
            <div className="rounded-3xl bg-white/80 border border-sky-100 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-700 font-semibold">Google path</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">The backend verifies Google ID tokens and issues the same JWT used by the rest of the app.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;