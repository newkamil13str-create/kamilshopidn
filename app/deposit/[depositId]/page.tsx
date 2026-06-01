'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy, CheckCircle, Clock, RefreshCw, AlertTriangle,
  XCircle, Ban, Wallet, ArrowRight,
} from 'lucide-react';
import { subscribeToDeposit } from '@/lib/firestore';
import { formatCurrency, getStatusColor } from '@/lib/utils';
import { getTimeRemaining, PAYMENT_METHODS } from '@/lib/pakasir';
import { Deposit } from '@/types';
import toast from 'react-hot-toast';

export default function DepositDetailPage() {
  const { depositId } = useParams();
  const router        = useRouter();

  const [deposit, setDeposit]             = useState<Deposit | null>(null);
  const [loading, setLoading]             = useState(true);
  const [timeLeft, setTimeLeft]           = useState({ hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [copied, setCopied]               = useState(false);
  const [checking, setChecking]           = useState(false);
  const [cancelling, setCancelling]       = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  // Realtime listener
  useEffect(() => {
    const unsub = subscribeToDeposit(depositId as string, (dep) => {
      setDeposit(dep);
      setLoading(false);

      if (!dep) return;
      const prev = prevStatusRef.current;
      const curr = dep.status;

      if (prev !== null && prev !== curr) {
        if (curr === 'paid') {
          toast.success('🎉 Deposit berhasil! Saldo sudah ditambahkan.');
        } else if (curr === 'failed') {
          toast.error('❌ Deposit gagal atau kadaluarsa.');
        } else if (curr === 'cancelled') {
          toast('🚫 Deposit dibatalkan.', { icon: '🚫' });
        }
      }
      prevStatusRef.current = curr;
    });
    return () => unsub();
  }, [depositId]);

  // Countdown
  useEffect(() => {
    if (!deposit?.expiredAt) return;
    const tick = () => setTimeLeft(getTimeRemaining(deposit.expiredAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deposit?.expiredAt]);

  // Auto-check via Pakasir setiap 10 detik
  const checkDeposit = useCallback(async () => {
    if (!depositId || checking) return;
    setChecking(true);
    try {
      // Gunakan endpoint check-payment yang sama — depositId diawali "DEP-"
      await fetch(`/api/check-payment?orderId=${depositId}&type=deposit`);
    } finally {
      setChecking(false);
    }
  }, [depositId, checking]);

  useEffect(() => {
    if (!deposit || deposit.status !== 'pending') return;
    checkDeposit();
    const id = setInterval(checkDeposit, 10000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposit?.status]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Disalin ke clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = async () => {
    if (!depositId || cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/deposit/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || 'Gagal membatalkan deposit');
    } catch {
      toast.error('Terjadi kesalahan, coba lagi');
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const methodInfo = PAYMENT_METHODS.find((m) => m.id === deposit?.paymentMethod);

  if (loading) {
    return (
      <main className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-electric-600/30 border-t-electric-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Memuat detail deposit...</p>
        </div>
      </main>
    );
  }

  if (!deposit) {
    return (
      <main className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-white text-2xl font-bold mb-2">Deposit Tidak Ditemukan</h1>
          <button onClick={() => router.push('/deposit')} className="text-electric-400 hover:underline">
            Kembali
          </button>
        </div>
      </main>
    );
  }

  const isExpired = timeLeft.total <= 0 && deposit.status === 'pending';

  return (
    <main className="min-h-screen animated-gradient py-10 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-electric-600 to-gold-500 flex items-center justify-center text-white font-display font-bold text-2xl shadow-glow-blue mx-auto mb-4">
            K
          </div>
          <h1 className="font-display text-2xl font-bold text-white">KAMIL-SHOP</h1>
          <p className="text-white/40 text-sm mt-1">Top Up Saldo</p>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── PAID ── */}
          {deposit.status === 'paid' && (
            <motion.div
              key="paid"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-3xl p-8 border border-green-400/20 mb-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-green-400/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <h2 className="text-white font-display text-2xl font-bold mb-2">Deposit Berhasil!</h2>
              <p className="text-white/50 mb-6">Saldo sudah ditambahkan ke akun Anda</p>

              <div className="glass-blue rounded-2xl p-5 mb-6">
                <p className="text-white/40 text-xs mb-1">Jumlah Deposit</p>
                <p className="text-gold-400 font-bold font-mono text-3xl">{formatCurrency(deposit.amount)}</p>
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold flex items-center justify-center gap-2"
              >
                <Wallet size={16} />
                Lihat Saldo
                <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ── FAILED ── */}
          {deposit.status === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-3xl p-8 border border-red-400/20 mb-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-5">
                <XCircle size={40} className="text-red-400" />
              </div>
              <h2 className="text-white font-display text-2xl font-bold mb-2">Deposit Gagal</h2>
              <p className="text-white/50 mb-6">Transaksi kadaluarsa atau gagal diproses</p>
              <button
                onClick={() => router.push('/deposit')}
                className="w-full py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold"
              >
                Coba Lagi
              </button>
            </motion.div>
          )}

          {/* ── CANCELLED ── */}
          {deposit.status === 'cancelled' && (
            <motion.div
              key="cancelled"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-3xl p-8 border border-orange-400/20 mb-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-orange-400/10 flex items-center justify-center mx-auto mb-5">
                <Ban size={40} className="text-orange-400" />
              </div>
              <h2 className="text-white font-display text-2xl font-bold mb-2">Deposit Dibatalkan</h2>
              <p className="text-white/50 mb-6">Tidak ada saldo yang ditambahkan.</p>
              <button
                onClick={() => router.push('/deposit')}
                className="w-full py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold"
              >
                Top Up Lagi
              </button>
            </motion.div>
          )}

          {/* ── PENDING ── */}
          {deposit.status === 'pending' && (
            <motion.div key="pending" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

              {/* Countdown */}
              <div className={`glass rounded-2xl p-4 border mb-5 ${isExpired ? 'border-red-400/20' : 'border-yellow-400/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className={isExpired ? 'text-red-400' : 'text-yellow-400'} />
                    <span className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-yellow-400'}`}>
                      {isExpired ? 'Deposit Kadaluarsa' : 'Batas Waktu Pembayaran'}
                    </span>
                  </div>
                  {!isExpired && (
                    <div className="flex gap-1 font-mono text-sm font-bold">
                      <span className="bg-navy-100 px-2 py-1 rounded text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
                      <span className="text-white/40 self-center">:</span>
                      <span className="bg-navy-100 px-2 py-1 rounded text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
                      <span className="text-white/40 self-center">:</span>
                      <span className="bg-navy-100 px-2 py-1 rounded text-white">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deposit info card */}
              <div className="glass rounded-3xl border border-white/5 overflow-hidden mb-5">
                <div className="p-5 border-b border-white/5">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-white/40 text-xs">Deposit ID</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(deposit.status)}`}>
                      Menunggu Pembayaran
                    </span>
                  </div>
                  <p className="text-white font-mono text-sm font-medium">{deposit.depositId}</p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/40 text-sm">Metode</span>
                    <span className="text-white text-sm">{methodInfo?.label || deposit.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 text-sm">Nominal</span>
                    <span className="text-white text-sm font-mono">{formatCurrency(deposit.amount)}</span>
                  </div>
                  {deposit.fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-white/40 text-sm">Biaya Admin</span>
                      <span className="text-white text-sm font-mono">{formatCurrency(deposit.fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span className="text-white font-semibold">Total Bayar</span>
                    <span className="text-gold-400 font-bold font-mono text-lg">
                      {formatCurrency(deposit.totalPayment || deposit.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment details */}
              <div className="glass rounded-2xl p-5 border border-electric-600/20 mb-5">
                {deposit.paymentMethod === 'qris' && deposit.paymentNumber ? (
                  <div className="text-center">
                    <p className="text-electric-400 text-sm font-medium mb-4">Scan QR Code untuk Membayar</p>
                    <div className="bg-white rounded-2xl p-4 inline-block mb-4">
                      <QRCodeSVG value={deposit.paymentNumber} size={200} level="H" includeMargin={false} />
                    </div>
                    <p className="text-white/40 text-xs">Buka aplikasi e-wallet Anda dan scan QR di atas</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-electric-400 text-sm font-medium mb-3">
                      {deposit.paymentMethod.toUpperCase()} Virtual Account
                    </p>
                    <div className="bg-navy-100 rounded-xl p-4 flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-white/40 text-xs mb-1">Nomor VA</p>
                        <p className="text-white font-mono text-lg font-bold tracking-wider">
                          {deposit.paymentNumber || '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopy(deposit.paymentNumber)}
                        className="p-2.5 rounded-xl bg-electric-600/20 text-electric-400 hover:bg-electric-600/30 transition-all flex-shrink-0"
                      >
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <div className="bg-navy-100 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white/40 text-xs mb-1">Jumlah Transfer</p>
                        <p className="text-gold-400 font-mono text-lg font-bold">
                          {formatCurrency(deposit.totalPayment || deposit.amount)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopy(String(deposit.totalPayment || deposit.amount))}
                        className="p-2.5 rounded-xl bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-all flex-shrink-0"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto check */}
              <div className="flex items-center justify-between glass rounded-xl p-3.5 mb-4">
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <RefreshCw size={14} className={checking ? 'animate-spin text-electric-400' : ''} />
                  {checking ? 'Mengecek status...' : 'Auto cek setiap 10 detik'}
                </div>
                <button
                  onClick={checkDeposit}
                  disabled={checking}
                  className="text-electric-400 text-sm hover:text-electric-300 transition-colors disabled:opacity-50"
                >
                  Cek Sekarang
                </button>
              </div>

              {/* Cancel */}
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-3 rounded-2xl glass border border-red-400/20 text-red-400/60 text-sm hover:text-red-400 hover:border-red-400/40 hover:bg-red-400/5 transition-all flex items-center justify-center gap-2"
                >
                  <Ban size={14} />
                  Batalkan Deposit
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-4 border border-red-400/30"
                >
                  <p className="text-white text-sm font-medium text-center mb-1">Batalkan deposit ini?</p>
                  <p className="text-white/40 text-xs text-center mb-4">Tindakan ini tidak bisa dibatalkan</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-2.5 rounded-xl glass border border-white/10 text-white/60 text-sm hover:text-white transition-all"
                    >
                      Kembali
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-400/40 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {cancelling ? (
                        <><div className="w-3.5 h-3.5 border border-red-400/40 border-t-red-400 rounded-full animate-spin" /> Membatalkan...</>
                      ) : (
                        <><Ban size={14} /> Ya, Batalkan</>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
