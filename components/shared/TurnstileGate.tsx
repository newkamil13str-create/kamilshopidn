'use client';

import { useEffect, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

const SESSION_KEY = 'ts_verified';

export default function TurnstileGate() {
  const [verified, setVerified] = useState(true); // default true biar ga flicker
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ok = sessionStorage.getItem(SESSION_KEY);
    if (ok === '1') {
      setVerified(true);
    } else {
      setVerified(false);
    }
    setReady(true);
  }, []);

  const handleSuccess = async (token: string) => {
    try {
      const res = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem(SESSION_KEY, '1');
        setVerified(true);
      }
    } catch {
      // retry on next reload
    }
  };

  if (!ready || verified) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#070C1B]/95 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-yellow-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
          K
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold mb-1">KAMIL-SHOP</h1>
          <p className="text-white/40 text-sm">Verifikasi bahwa kamu bukan bot</p>
        </div>

        {/* Turnstile widget */}
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={handleSuccess}
          options={{ theme: 'dark', language: 'id' }}
        />

        <p className="text-white/20 text-xs">Protected by Cloudflare Turnstile</p>
      </div>
    </div>
  );
}
