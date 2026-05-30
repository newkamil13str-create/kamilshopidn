'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { loginWithEmail, loginWithGoogle } from '@/lib/auth';
import { useAuthStore } from '@/store';
import toast from 'react-hot-toast';

// ─── Schemas ──────────────────────────────────────────────────────────────────
const emailSchema = z.object({
  email:    z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

const otpEmailSchema = z.object({
  email: z.string().email('Email tidak valid'),
});

const otpCodeSchema = z.object({
  code: z.string().length(6, 'Kode OTP harus 6 digit'),
});

type EmailForm    = z.infer<typeof emailSchema>;
type OTPEmailForm = z.infer<typeof otpEmailSchema>;
type OTPCodeForm  = z.infer<typeof otpCodeSchema>;
type Tab          = 'google' | 'email' | 'otp';

function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get('redirect') || '/';
  const setUser      = useAuthStore((s) => s.setUser);

  const [tab,       setTab]       = useState<Tab>('google');
  const [loading,   setLoading]   = useState(false);
  const [showPw,    setShowPw]    = useState(false);
  const [otpSent,   setOtpSent]   = useState(false);
  const [otpEmail,  setOtpEmail]  = useState('');
  const [countdown, setCountdown] = useState(0);

  const emailForm    = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const otpEmailForm = useForm<OTPEmailForm>({ resolver: zodResolver(otpEmailSchema) });
  const otpCodeForm  = useForm<OTPCodeForm>({ resolver: zodResolver(otpCodeSchema) });

  const startCountdown = (secs = 60) => {
    setCountdown(secs);
    const t = setInterval(() => {
      setCountdown((p) => { if (p <= 1) { clearInterval(t); return 0; } return p - 1; });
    }, 1000);
  };

  const goSuccess = (user: unknown) => {
    if (user) setUser(user as never);
    toast.success('Berhasil masuk!');
    router.push(redirect);
  };

  // ─── Google ───────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true);
    try { goSuccess(await loginWithGoogle()); }
    catch { toast.error('Gagal masuk dengan Google'); }
    finally { setLoading(false); }
  };

  // ─── Email + Password ─────────────────────────────────────────────────────
  const handleEmail = async (data: EmailForm) => {
    setLoading(true);
    try { goSuccess(await loginWithEmail(data.email, data.password)); }
    catch { toast.error('Email atau password salah'); }
    finally { setLoading(false); }
  };

  // ─── Kirim OTP ke Email ───────────────────────────────────────────────────
  const handleSendOTP = async (data: OTPEmailForm) => {
    setLoading(true);
    try {
      const res  = await fetch('/api/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: data.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setOtpEmail(data.email);
      setOtpSent(true);
      startCountdown(60);
      toast.success('Kode OTP dikirim ke email kamu!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim OTP');
    } finally {
      setLoading(false);
    }
  };

  // ─── Verifikasi OTP ───────────────────────────────────────────────────────
  const handleVerifyOTP = async (data: OTPCodeForm) => {
    setLoading(true);
    try {
      const res  = await fetch('/api/verify-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: otpEmail, code: data.code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      goSuccess(json.user);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Kode OTP salah atau kadaluarsa');
    } finally {
      setLoading(false);
    }
  };

  // ─── Kirim ulang OTP ──────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: otpEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      startCountdown(60);
      toast.success('Kode OTP baru telah dikirim!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal kirim ulang');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'google', label: '🔵 Google' },
    { id: 'email',  label: '📧 Email' },
    { id: 'otp',    label: '✉️ OTP Email' },
  ] as const;

  return (
    <main className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <div className="fixed top-1/4 left-1/4 w-80 h-80 bg-electric-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-electric-600 to-gold-500 flex items-center justify-center text-white font-display font-bold text-2xl shadow-glow-blue">
              K
            </div>
            <span className="font-display font-bold text-xl text-white">
              KAMIL<span className="text-gold-500">-SHOP</span>
            </span>
          </Link>
          <p className="text-white/40 text-sm mt-2">Masuk ke akun Anda</p>
        </div>

        <div className="glass rounded-3xl p-7 border border-white/5">
          {/* Tabs */}
          <div className="flex gap-1 bg-navy-100 rounded-xl p-1 mb-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setOtpSent(false); }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  tab === t.id
                    ? 'bg-electric-gradient text-white shadow-glow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ── Google ── */}
            {tab === 'google' && (
              <motion.div key="google" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-white/50 text-sm text-center mb-6 leading-relaxed">
                  Masuk dengan akun Google Anda dengan mudah dan aman
                </p>
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl glass border border-white/10 text-white font-medium hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Masuk dengan Google
                      </>
                  }
                </button>
              </motion.div>
            )}

            {/* ── Email + Password ── */}
            {tab === 'email' && (
              <motion.form
                key="email"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={emailForm.handleSubmit(handleEmail)}
                className="space-y-4"
              >
                <div>
                  <label className="text-white/60 text-sm mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      {...emailForm.register('email')}
                      type="email"
                      placeholder="email@contoh.com"
                      className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <p className="text-red-400 text-xs mt-1">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-white/60 text-sm mb-1.5 flex justify-between">
                    <span>Password</span>
                    <Link href="/auth/forgot-password" className="text-electric-400 text-xs hover:underline">
                      Lupa password?
                    </Link>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      {...emailForm.register('password')}
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-dark w-full pl-10 pr-10 py-3 rounded-xl text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {emailForm.formState.errors.password && (
                    <p className="text-red-400 text-xs mt-1">{emailForm.formState.errors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold disabled:opacity-50"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <>Masuk <ArrowRight size={16} /></>
                  }
                </button>
              </motion.form>
            )}

            {/* ── OTP Email ── */}
            {tab === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <Mail size={15} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-blue-300/80 text-xs leading-relaxed">
                    Kode OTP akan dikirim ke alamat email kamu. Cek folder inbox atau spam.
                  </p>
                </div>

                {!otpSent ? (
                  <form onSubmit={otpEmailForm.handleSubmit(handleSendOTP)} className="space-y-4">
                    <div>
                      <label className="text-white/60 text-sm mb-1.5 block">Alamat Email</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          {...otpEmailForm.register('email')}
                          type="email"
                          placeholder="email@contoh.com"
                          className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                        />
                      </div>
                      {otpEmailForm.formState.errors.email && (
                        <p className="text-red-400 text-xs mt-1">{otpEmailForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold disabled:opacity-50"
                    >
                      {loading
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <>Kirim Kode OTP <ArrowRight size={16} /></>
                      }
                    </button>
                  </form>
                ) : (
                  <form onSubmit={otpCodeForm.handleSubmit(handleVerifyOTP)} className="space-y-4">
                    <div>
                      <label className="text-white/60 text-sm mb-1.5 block">
                        Kode OTP
                        <span className="text-white/30 ml-1 text-xs">({otpEmail})</span>
                      </label>
                      <input
                        {...otpCodeForm.register('code')}
                        placeholder="_ _ _ _ _ _"
                        maxLength={6}
                        inputMode="numeric"
                        className="input-dark w-full px-4 py-3.5 rounded-xl text-center tracking-[0.5em] font-mono text-xl"
                      />
                      {otpCodeForm.formState.errors.code && (
                        <p className="text-red-400 text-xs mt-1 text-center">{otpCodeForm.formState.errors.code.message}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold disabled:opacity-50"
                    >
                      {loading
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <>Verifikasi & Masuk <ArrowRight size={16} /></>
                      }
                    </button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={countdown > 0 || loading}
                        className="text-electric-400 disabled:text-white/30 hover:text-electric-300 transition-colors"
                      >
                        {countdown > 0 ? `Kirim ulang (${countdown}s)` : 'Kirim ulang OTP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpEmail(''); otpCodeForm.reset(); }}
                        className="text-white/40 hover:text-white/60 transition-colors"
                      >
                        Ganti email
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}

          </AnimatePresence>

          <p className="text-white/40 text-sm text-center mt-6">
            Belum punya akun?{' '}
            <Link href="/auth/register" className="text-electric-400 hover:text-electric-300 font-medium">
              Daftar Sekarang
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-electric-600/30 border-t-electric-600 rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
