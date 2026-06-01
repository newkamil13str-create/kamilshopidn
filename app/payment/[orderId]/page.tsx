'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, CheckCircle, Clock, RefreshCw, ArrowRight, AlertTriangle, XCircle, Ban } from 'lucide-react';
import { subscribeToOrder } from '@/lib/firestore';
import { formatCurrency, getStatusColor, getStatusLabel } from '@/lib/utils';
import { getTimeRemaining, PAYMENT_METHODS } from '@/lib/pakasir';
import { Order } from '@/types';
import toast from 'react-hot-toast';

export default function PaymentPage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  // Subscribe to order realtime — auto-react saat status berubah
  useEffect(() => {
    const unsub = subscribeToOrder(orderId as string, (ord) => {
      setOrder(ord);
      setLoading(false);

      if (!ord) return;

      const prev = prevStatusRef.current;
      const curr = ord.status;

      // Baru pertama kali atau status berubah
      if (prev !== null && prev !== curr) {
        if (curr === 'delivered') {
          toast.success('🎉 Pembayaran berhasil! Produk siap digunakan.');
        } else if (curr === 'paid') {
          toast.success('✅ Pembayaran diterima! Memproses pesanan...');
        } else if (curr === 'failed') {
          toast.error('❌ Pembayaran gagal atau kadaluarsa.');
        } else if (curr === 'cancelled') {
          toast('🚫 Order telah dibatalkan.', { icon: '🚫' });
        }
      }

      prevStatusRef.current = curr;
    });
    return () => unsub();
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    if (!order?.expiredAt) return;
    const tick = () => setTimeLeft(getTimeRemaining(order.expiredAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order?.expiredAt]);

  // Auto-check payment status dari Pakasir setiap 10 detik
  const checkPayment = useCallback(async () => {
    if (!orderId || checking) return;
    setChecking(true);
    try {
      await fetch(`/api/check-payment?orderId=${orderId}`);
    } finally {
      setChecking(false);
    }
  }, [orderId, checking]);

  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    // Langsung cek sekali saat mount
    checkPayment();
    const id = setInterval(checkPayment, 10000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Disalin ke clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = async () => {
    if (!orderId || cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/cancel-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal membatalkan order');
      }
      // Status akan update otomatis via Firestore realtime listener
    } catch {
      toast.error('Terjadi kesalahan, coba lagi');
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const methodInfo = PAYMENT_METHODS.find((m) => m.id === order?.paymentMethod);

  if (loading) {
    return (
      <main className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-electric-600/30 border-t-electric-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Memuat detail pembayaran...</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-white text-2xl font-bold mb-2">Order Tidak Ditemukan</h1>
          <button onClick={() => router.push('/')} className="text-electric-400 hover:underline">
            Kembali ke Beranda
          </button>
        </div>
      </main>
    );
  }

  const isExpired = timeLeft.total <= 0 && order.status === 'pending';

  return (
    <main className="min-h-screen animated-gradient py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-electric-600 to-gold-500 flex items-center justify-center text-white font-display font-bold text-2xl shadow-glow-blue mx-auto mb-4">
            K
          </div>
          <h1 className="font-display text-2xl font-bold text-white">KAMIL-SHOP</h1>
          <p className="text-white/40 text-sm mt-1">Selesaikan Pembayaran</p>
        </motion.div>

        {/* Status Panels */}
        <AnimatePresence mode="wait">

          {/* ── DELIVERED ── */}
          {order.status === 'delivered' && (
            <motion.div
              key="delivered"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-3xl p-8 border border-green-400/20 mb-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-green-400/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <h2 className="text-white font-display text-2xl font-bold mb-2">Pembayaran Berhasil!</h2>
              <p className="text-white/50 mb-6">Produk digital Anda sudah dikirim</p>

              <div className="glass-blue rounded-2xl p-5 text-left mb-5">
                <p className="text-electric-400 text-sm font-medium mb-2">📦 {order.productName}</p>
                <div className="bg-navy-100 rounded-xl p-4">
                  <pre className="text-gold-400 text-sm font-mono break-all whitespace-pre-wrap">
                    {order.deliveryContent}
                  </pre>
                </div>
                <button
                  onClick={() => handleCopy(order.deliveryContent || '')}
                  className="mt-3 w-full py-2.5 rounded-xl glass border border-white/10 text-white/60 text-sm flex items-center justify-center gap-2 hover:text-white hover:bg-white/5 transition-all"
                >
                  {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  {copied ? 'Tersalin!' : 'Salin Konten'}
                </button>
              </div>

              <button
                onClick={() => router.push(`/order/${orderId}`)}
                className="w-full py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold flex items-center justify-center gap-2"
              >
                Lihat Detail Pesanan
                <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ── PAID (sedang diproses) ── */}
          {order.status === 'paid' && (
            <motion.div
              key="paid"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-3xl p-8 border border-electric-600/20 mb-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-electric-600/10 flex items-center justify-center mx-auto mb-5">
                <div className="w-10 h-10 border-2 border-electric-600/40 border-t-electric-400 rounded-full animate-spin" />
              </div>
              <h2 className="text-white font-display text-2xl font-bold mb-2">Pembayaran Diterima!</h2>
              <p className="text-white/50 mb-2">Sedang memproses pengiriman produk...</p>
              <p className="text-white/30 text-sm">Halaman akan otomatis diperbarui</p>
            </motion.div>
          )}

          {/* ── FAILED ── */}
          {order.status === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-3xl p-8 border border-red-400/20 mb-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-5">
                <XCircle size={40} className="text-red-400" />
              </div>
              <h2 className="text-white font-display text-2xl font-bold mb-2">Pembayaran Gagal</h2>
              <p className="text-white/50 mb-6">Transaksi telah kadaluarsa atau gagal diproses</p>
              <button
                onClick={() => router.push('/checkout')}
                className="w-full py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold"
              >
                Coba Lagi
              </button>
            </motion.div>
          )}

          {/* ── CANCELLED ── */}
          {order.status === 'cancelled' && (
            <motion.div
              key="cancelled"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-3xl p-8 border border-orange-400/20 mb-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-orange-400/10 flex items-center justify-center mx-auto mb-5">
                <Ban size={40} className="text-orange-400" />
              </div>
              <h2 className="text-white font-display text-2xl font-bold mb-2">Order Dibatalkan</h2>
              <p className="text-white/50 mb-2">Order <span className="text-white/70 font-mono">{order.orderId}</span> telah dibatalkan.</p>
              <p className="text-white/30 text-sm mb-6">Tidak ada biaya yang dikenakan.</p>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3.5 rounded-2xl bg-electric-gradient text-white font-semibold"
              >
                Kembali ke Beranda
              </button>
            </motion.div>
          )}

          {/* ── PENDING ── */}
          {order.status === 'pending' && (
            <motion.div key="pending" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Countdown */}
              <div className={`glass rounded-2xl p-4 border mb-5 ${isExpired ? 'border-red-400/20' : 'border-yellow-400/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className={isExpired ? 'text-red-400' : 'text-yellow-400'} />
                    <span className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-yellow-400'}`}>
                      {isExpired ? 'Pembayaran Kadaluarsa' : 'Batas Waktu Pembayaran'}
                    </span>
                  </div>
                  {!isExpired && (
                    <div className="flex gap-1 font-mono text-sm font-bold">
                      <span className="bg-navy-100 px-2 py-1 rounded text-white">
                        {String(timeLeft.hours).padStart(2, '0')}
                      </span>
                      <span className="text-white/40 self-center">:</span>
                      <span className="bg-navy-100 px-2 py-1 rounded text-white">
                        {String(timeLeft.minutes).padStart(2, '0')}
                      </span>
                      <span className="text-white/40 self-center">:</span>
                      <span className="bg-navy-100 px-2 py-1 rounded text-white">
                        {String(timeLeft.seconds).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order info card */}
              <div className="glass rounded-3xl border border-white/5 overflow-hidden mb-5">
                <div className="p-5 border-b border-white/5">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-white/40 text-xs">Order ID</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className="text-white font-mono text-sm font-medium">{order.orderId}</p>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/40 text-sm">Produk</span>
                    <span className="text-white text-sm font-medium text-right max-w-48 leading-tight">{order.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 text-sm">Metode</span>
                    <span className="text-white text-sm">{methodInfo?.label || order.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 text-sm">Subtotal</span>
                    <span className="text-white text-sm font-mono">{formatCurrency(order.amount)}</span>
                  </div>
                  {order.fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-white/40 text-sm">Biaya Admin</span>
                      <span className="text-white text-sm font-mono">{formatCurrency(order.fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span className="text-white font-semibold">Total Bayar</span>
                    <span className="text-gold-400 font-bold font-mono text-lg">
                      {formatCurrency(order.totalPayment || order.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="glass rounded-2xl p-5 border border-electric-600/20 mb-5">
                {order.paymentMethod === 'qris' && order.paymentNumber ? (
                  <div className="text-center">
                    <p className="text-electric-400 text-sm font-medium mb-4">Scan QR Code untuk Membayar</p>
                    <div className="bg-white rounded-2xl p-4 inline-block mb-4">
                      <QRCodeSVG
                        value={order.paymentNumber}
                        size={200}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-white/40 text-xs">Buka aplikasi e-wallet Anda dan scan QR di atas</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-electric-400 text-sm font-medium mb-3">
                      {order.paymentMethod.toUpperCase()} Virtual Account
                    </p>
                    <div className="bg-navy-100 rounded-xl p-4 flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-white/40 text-xs mb-1">Nomor VA</p>
                        <p className="text-white font-mono text-lg font-bold tracking-wider">
                          {order.paymentNumber || '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopy(order.paymentNumber)}
                        className="p-2.5 rounded-xl bg-electric-600/20 text-electric-400 hover:bg-electric-600/30 transition-all flex-shrink-0"
                      >
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <div className="bg-navy-100 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white/40 text-xs mb-1">Jumlah Transfer</p>
                        <p className="text-gold-400 font-mono text-lg font-bold">
                          {formatCurrency(order.totalPayment || order.amount)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopy(String(order.totalPayment || order.amount))}
                        className="p-2.5 rounded-xl bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-all flex-shrink-0"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto check status */}
              <div className="flex items-center justify-between glass rounded-xl p-3.5 mb-4">
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <RefreshCw size={14} className={checking ? 'animate-spin text-electric-400' : ''} />
                  {checking ? 'Mengecek status...' : 'Auto cek setiap 10 detik'}
                </div>
                <button
                  onClick={checkPayment}
                  disabled={checking}
                  className="text-electric-400 text-sm hover:text-electric-300 transition-colors disabled:opacity-50"
                >
                  Cek Sekarang
                </button>
              </div>

              {/* Cancel Button */}
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-3 rounded-2xl glass border border-red-400/20 text-red-400/60 text-sm hover:text-red-400 hover:border-red-400/40 hover:bg-red-400/5 transition-all flex items-center justify-center gap-2"
                >
                  <Ban size={14} />
                  Batalkan Order
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-4 border border-red-400/30"
                >
                  <p className="text-white text-sm font-medium text-center mb-1">Batalkan order ini?</p>
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
