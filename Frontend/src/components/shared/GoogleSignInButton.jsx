import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleScriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);

      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}

const GoogleSignInButton = ({ onCredential, disabled = false }) => {
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

  onCredentialRef.current = onCredential;

  useEffect(() => {
    let isMounted = true;

    const renderGoogleButton = async () => {
      if (!clientId) {
        setError('Google sign-in is not configured for this environment.');
        return;
      }

      try {
        await loadGoogleScript();
        if (!isMounted || !containerRef.current || !window.google?.accounts?.id) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response?.credential) {
              setError('Google did not return a credential.');
              return;
            }

            setIsBusy(true);
            setError('');
            try {
              await onCredentialRef.current(response.credential);
            } catch (submissionError) {
              setError(submissionError.message || 'Google sign-in failed.');
            } finally {
              if (isMounted) {
                setIsBusy(false);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 360,
        });
      } catch (scriptError) {
        if (isMounted) {
          setError(scriptError.message || 'Unable to initialize Google sign-in.');
        }
      }
    };

    renderGoogleButton();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  return (
    <div className="space-y-3">
      <div className={`relative ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
        <div
          ref={containerRef}
          className="min-h-[44px] flex items-center justify-center"
        />

        {isBusy && (
          <div className="absolute inset-0 rounded-full bg-white/80 flex items-center justify-center gap-2 text-sm font-medium text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing you in…
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default GoogleSignInButton;