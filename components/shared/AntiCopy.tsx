'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

const ALERT_IMAGE = 'https://iili.io/C3RSJDv.th.jpg';
const ALERT_SOUND = '/alert.mp3';
const COOLDOWN_MS = 30 * 1000; // 30 detik sebelum bisa dismiss

let lastLogTime = 0;

interface CopyAttempt {
  type: string;
  page: string;
  time: string;
  ua: string;
}

async function logAttempt(type: string) {
  const now = Date.now();
  // Throttle log — max 1 log per 5 detik
  if (now - lastLogTime < 5000) return;
  lastLogTime = now;

  try {
    await fetch('/api/log-copy-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        page: window.location.pathname,
        time: new Date().toISOString(),
        ua: navigator.userAgent,
      } as CopyAttempt),
    });
  } catch {}
}

export default function AntiCopy() {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAlert = (type: string) => {
    setShow(true);
    setCountdown(Math.ceil(COOLDOWN_MS / 1000));
    logAttempt(type);

    // Play sound
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(ALERT_SOUND);
        audioRef.current.volume = 1.0;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}

    // Countdown
    if (timerRef.current) clearInterval(timerRef.current);
    let secs = Math.ceil(COOLDOWN_MS / 1000);
    timerRef.current = setInterval(() => {
      secs--;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(timerRef.current!);
      }
    }, 1000);
  };

  const dismiss = () => {
    if (countdown > 0) return;
    setShow(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    // Disable klik kanan
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerAlert('right-click');
    };

    // Disable select + copy keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (
        isCtrl && ['c', 'C', 'u', 'U', 's', 'S', 'a', 'A', 'p', 'P'].includes(e.key)
      ) {
        e.preventDefault();
        triggerAlert(`keyboard-${e.key.toLowerCase()}`);
      }
      // Print screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        triggerAlert('printscreen');
      }
      // F12 devtools
      if (e.key === 'F12') {
        e.preventDefault();
        triggerAlert('devtools');
      }
    };

    // Disable copy event
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerAlert('copy');
    };

    // Disable cut event
    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerAlert('cut');
    };

    // Disable text selection via CSS
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-lg">
      {/* Gambar alert */}
      <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-4 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.8)] animate-pulse">
        <Image
          src={ALERT_IMAGE}
          alt="Terdeteksi!"
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Pesan */}
      <div className="mt-6 text-center px-6">
        <h1 className="text-red-500 font-bold text-3xl mb-2 animate-bounce">
          ⚠️ TERDETEKSI!
        </h1>
        <p className="text-white text-lg font-semibold mb-1">
          Aktivitas mencurigakan terdeteksi
        </p>
        <p className="text-white/50 text-sm mb-4">
          Percobaan kamu sudah dicatat dan dilaporkan ke admin.
        </p>

        {/* Countdown */}
        {countdown > 0 ? (
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-6 py-3">
            <p className="text-red-400 text-sm">
              Tunggu <span className="font-bold text-xl text-red-400">{countdown}</span> detik
            </p>
          </div>
        ) : (
          <button
            onClick={dismiss}
            className="mt-2 px-8 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );
}
