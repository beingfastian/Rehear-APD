import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ForgotPasswordPage = ({ setCurrentPage, pageData = {} }) => {
  const { requestPasswordReset, showNotification } = useApp();
  const [email, setEmail] = useState(pageData.email || '');
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
      const response = await requestPasswordReset({ email });
      showNotification(response.message || 'Verification code sent.', 'success');
      setCurrentPage('verify-reset-code', { email });
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to send verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-6xl grid lg:grid-cols-[1.02fr_0.98fr] gap-8 items-stretch">
        <div className="hidden lg:flex rounded-[2rem] bg-slate-950 text-white p-10 flex-col justify-between overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(96,165,250,0.2),_transparent_32%)]" />
          <div className="relative">
            <img src="/rehear-logo.png" alt="Rehear APD" className="h-16 w-auto object-contain" />
            <p className="mt-8 text-sky-200 text-sm uppercase tracking-[0.22em] font-semibold">Password recovery</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">Request a verification code for your account email.</h1>
            <p className="mt-5 text-slate-300 text-base leading-relaxed max-w-lg">
              Enter the email tied to your APD Listener Tool account. If the account exists, we will send a six-digit reset code and move you to verification.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-4">
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Step 1</p>
              <p className="mt-3 text-lg font-semibold">Submit email</p>
            </div>
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Step 2</p>
              <p className="mt-3 text-lg font-semibold">Verify code</p>
            </div>
            <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Step 3</p>
              <p className="mt-3 text-lg font-semibold">Choose password</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-sky-100 shadow-xl shadow-sky-100/60 p-6 sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="lg:hidden flex justify-center mb-6">
              <img src="/rehear-logo.png" alt="Rehear APD" className="h-14 w-auto object-contain" />
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage('login', { email })}
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>

            <p className="mt-6 text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Reset password</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">Send a verification code</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              We will send a six-digit code to your email address. For security, the response stays the same even if the account does not exist.
            </p>

            <form className="space-y-4 mt-8" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Account email</label>
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
                {isSubmitting ? 'Sending code…' : 'Send verification code'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;