'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

export default function TurnstileGate() {
  const [verified, setVerified]       = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mounted, setMounted]         = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId  = useRef<string>('');

  // Mount check
  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem('cf_verified')) {
      setVerified(true);
    }
  }, []);

  useEffect(() => {
    if (!scriptLoaded || verified || !widgetRef.current || !window.turnstile) return;

    widgetId.current = window.turnstile.render(widgetRef.current, {
      sitekey: SITE_KEY,
      callback: async (token: string) => {
        try {
          const res  = await fetch('/api/verify-turnstile', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token }),
          });
          const data = await res.json();
          if (data.success) {
            sessionStorage.setItem('cf_verified', '1');
            setVerified(true);
          }
        } catch {
          setVerified(true);
        }
      },
      'error-callback': () => setVerified(true),
    });

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [scriptLoaded, verified]);

  // Jangan render jika tidak ada site key atau sudah verified
  if (!SITE_KEY || !mounted || verified) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        onLoad={() => setScriptLoaded(true)}
        strategy="afterInteractive"
      />
      <div className="fixed inset-0 z-[99998] flex flex-col items-center justify-center bg-[#0A0F1E]/95 backdrop-blur-lg">
        <div className="glass rounded-3xl p-8 border border-white/10 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-electric-600 to-gold-500 flex items-center justify-center text-white font-bold text-3xl shadow-glow-blue">
            K
          </div>
          <div className="text-center">
            <h1 className="text-white font-display font-bold text-xl mb-1">KAMIL-SHOP</h1>
            <p className="text-white/50 text-sm">Verifikasi bahwa kamu bukan robot</p>
          </div>
          <div ref={widgetRef} />
          {!scriptLoaded && (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              Memuat verifikasi...
            </div>
          )}
        </div>
      </div>
    </>
  );
}
