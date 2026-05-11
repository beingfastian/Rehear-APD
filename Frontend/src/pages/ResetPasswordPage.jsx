import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Lock, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ResetPasswordPage = ({ setCurrentPage, pageData = {} }) => {
  const { resetPassword, showNotification } = useApp();
  const email = useMemo(() => (pageData.email || '').trim(), [pageData.email]);
  const resetToken = pageData.resetToken || '';
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!email || !resetToken) {
      showNotification('Verify your reset code before choosing a new password.', 'warning');
      setCurrentPage('forgot-password', email ? { email } : {});
    }
  }, [email, resetToken, setCurrentPage, showNotification]);

  const updateField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resetPassword({
        resetToken,
        newPassword: form.password,
      });
      showNotification(response.message || 'Password has been reset successfully.', 'success');
      setCurrentPage('login', { email });
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!email || !resetToken) {
    return null;
  }

  return (
    <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-6xl grid lg:grid-cols-[1.02fr_0.98fr] gap-8 items-stretch">
        <div className="hidden lg:flex rounded-[2rem] bg-slate-950 text-white p-10 flex-col justify-between overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(96,165,250,0.2),_transparent_32%)]" />
          <div className="relative">
            <img src="/rehear-logo-transparent.png" alt="Rehear APD" className="h-24 w-auto object-contain" />
            <p className="mt-8 text-sky-200 text-sm uppercase tracking-[0.22em] font-semibold">Final step</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">Choose a new password and return to sign-in.</h1>
            <p className="mt-5 text-slate-300 text-base leading-relaxed max-w-lg">
              Your code has already been accepted. This screen only needs the new password, backed by the temporary reset token returned after verification.
            </p>
          </div>

          <div className="relative grid grid-cols-2 gap-4">
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Verified</p>
              <p className="mt-3 text-lg font-semibold break-all">{email}</p>
            </div>
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Guardrail</p>
              <p className="mt-3 text-lg font-semibold">Minimum 6 characters</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-sky-100 shadow-xl shadow-sky-100/60 p-6 sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="lg:hidden flex justify-center mb-6">
              <img src="/rehear-logo-transparent.png" alt="Rehear APD" className="h-20 w-auto object-contain" />
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage('verify-reset-code', { email })}
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to code verification
            </button>

            <p className="mt-6 text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Set new password</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">Create a replacement password</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Choose a password for <span className="font-semibold text-gray-700">{email}</span> and sign in again with the updated credentials.
            </p>

            <form className="space-y-4 mt-8" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New password</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm new password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    placeholder="Repeat your new password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900 flex items-start gap-3">
                <Shield className="w-4 h-4 mt-0.5 text-sky-600 flex-shrink-0" />
                <p>
                  After this step, the verified reset code is consumed and the old password stops working.
                </p>
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
                {isSubmitting ? 'Resetting password…' : 'Save new password'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;