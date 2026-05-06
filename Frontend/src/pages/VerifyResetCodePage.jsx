import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

const RESEND_COOLDOWN_SECONDS = 45;

const VerifyResetCodePage = ({ setCurrentPage, pageData = {} }) => {
  const { resendPasswordResetCode, verifyPasswordResetCode, showNotification } = useApp();
  const email = useMemo(() => (pageData.email || '').trim(), [pageData.email]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!email) {
      showNotification('Start the password reset flow by entering your email first.', 'warning');
      setCurrentPage('forgot-password');
    }
  }, [email, setCurrentPage, showNotification]);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCooldownRemaining((previous) => {
        if (previous <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownRemaining]);

  const handleCodeChange = (event) => {
    const nextValue = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(nextValue);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await verifyPasswordResetCode({ email, code });
      showNotification(response.message || 'Code verified successfully.', 'success');
      setCurrentPage('reset-password', {
        email,
        resetToken: response.reset_token,
      });
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to verify reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setIsResending(true);
    try {
      const response = await resendPasswordResetCode({ email });
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      showNotification(response.message || 'Verification code resent.', 'success');
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to resend verification code.');
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-6xl grid lg:grid-cols-[0.98fr_1.02fr] gap-8 items-stretch">
        <div className="bg-white rounded-[2rem] border border-sky-100 shadow-xl shadow-sky-100/60 p-6 sm:p-10 order-2 lg:order-1">
          <div className="max-w-md mx-auto">
            <div className="lg:hidden flex justify-center mb-6">
              <img src="/rehear-logo.png" alt="Rehear APD" className="h-14 w-auto object-contain" />
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage('forgot-password', { email })}
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to email step
            </button>

            <p className="mt-6 text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Verify code</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">Enter the six-digit code</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              We sent a code to <span className="font-semibold text-gray-700">{email}</span>. Enter it below to continue to a new password.
            </p>

            <form className="space-y-4 mt-8" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="000000"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-2xl tracking-[0.55em] font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-sky-600 flex-shrink-0" />
                <p>
                  Codes expire after a short time. If yours stops working, request another one below and use the latest email.
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
                {isSubmitting ? 'Verifying code…' : 'Verify code'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-4 text-sm">
              <p className="text-gray-500">Didn&apos;t get the email?</p>
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || cooldownRemaining > 0}
                className="inline-flex items-center gap-2 font-semibold text-sky-700 hover:text-sky-800 disabled:text-gray-400 disabled:hover:text-gray-400"
              >
                <RotateCcw className="w-4 h-4" />
                {isResending
                  ? 'Sending again…'
                  : cooldownRemaining > 0
                    ? `Resend in ${cooldownRemaining}s`
                    : 'Resend code'}
              </button>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex rounded-[2rem] bg-white/75 border border-white/70 backdrop-blur-xl p-10 flex-col justify-between order-1 lg:order-2 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_32%)]" />
          <div className="relative">
            <img src="/rehear-logo.png" alt="Rehear APD" className="h-16 w-auto object-contain" />
            <p className="mt-8 text-sky-700 text-sm uppercase tracking-[0.22em] font-semibold">Recovery in progress</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-950">Confirm the code before the password can change.</h1>
            <p className="mt-5 text-slate-600 text-base leading-relaxed max-w-lg">
              This step proves the mailbox is under your control. The next screen only appears after the code is accepted by the backend.
            </p>
          </div>

          <div className="relative space-y-4">
            <div className="rounded-3xl bg-white/80 border border-sky-100 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-700 font-semibold">Email target</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed break-all">{email}</p>
            </div>
            <div className="rounded-3xl bg-white/80 border border-sky-100 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-700 font-semibold">Resend protection</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">A cooldown keeps repeated resend requests under control while still letting users recover from expired or lost emails.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyResetCodePage;