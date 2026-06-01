'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, ChevronRight, AlertTriangle, Zap } from 'lucide-react';
import { useAuthStore } from '@/store';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import { PAYMENT_METHODS } from '@/lib/pakasir';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 200000, 500000];

export default function DepositPage() {
  const router  = useRouter();
  const { user, loading: authLoading } = useAuthStore();

  const [amount, setAmount]               = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [submitting, setSubmitting]       = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/deposit');
    }
  }, [user, authLoading, router]);

  const numAmount = Number(amount.replace(/\D/g, ''));

  const handleAmountInput = (val: string) => {
    const digits = val.replace(/\D/g, '');
    setAmount(digits);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (numAmount < 10000) {
      toast.error('Minimal deposit Rp 10.000');
      return;
    }
    if (!selectedMethod) {
      toast.error('Pilih metode pembayaran');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method:        selectedMethod,
          amount:        numAmount,
          userId:        user.id,
          customerName:  user.displayName,
          customerEmail: user.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal membuat deposit');
        return;
      }
      router.push(`/deposit/${data.depositId}`);
    } catch {
      toast.error('Terjadi kesalahan, coba lagi');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-electric-600/30 border-t-electric-600 rounded-full animate-spin" />
      </main>
    );
  }

  const categories = [
    { id: 'qr',     label: 'QR Code',        methods: PAYMENT_METHODS.filter((m) => m.category === 'qr') },
    { id: 'bank',   label: 'Virtual Account', methods: PAYMENT_METHODS.filter((m) => m.category === 'bank') },
    { id: 'ewallet',label: 'E-Wallet',        methods: PAYMENT_METHODS.filter((m) => m.category === 'ewallet') },
  ];

  return (
    <main className="min-h-screen animated-gradient mobile-nav-safe">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-electric-600/20 flex items-center justify-center">
              <Wallet size={20} className="text-electric-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Top Up Saldo</h1>
          </div>
          <p className="text-white/40 text-sm ml-13">Saldo akan langsung masuk setelah pembayaran dikonfirmasi</p>
        </motion.div>

        {/* Saldo saat ini */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-5 border border-electric-600/20 mb-6">
          <p className="text-white/40 text-xs mb-1">Saldo Saat Ini</p>
          <p className="text-2xl font-bold font-mono text-gold-400">
            {formatCurrency(user.balance || 0)}
          </p>
        </motion.div>

        {/* Nominal */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 border border-white/5 mb-5">
          <p className="text-white font-semibold mb-4">Nominal Deposit</p>

          {/* Preset amounts */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(String(preset))}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  numAmount === preset
                    ? 'bg-electric-600/20 border-electric-600/40 text-electric-400'
                    : 'glass border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {formatCurrency(preset)}
              </button>
            ))}
          </div>

          {/* Manual input */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">Rp</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="0"
              value={numAmount > 0 ? numAmount.toLocaleString('id-ID') : ''}
              onChange={(e) => handleAmountInput(e.target.value)}
              className="w-full bg-navy-100 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white text-right font-mono text-lg focus:outline-none focus:border-electric-600/50 placeholder-white/20"
            />
          </div>
          {numAmount > 0 && numAmount < 10000 && (
            <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Minimal deposit Rp 10.000
            </p>
          )}
        </motion.div>

        {/* Metode Pembayaran */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-5 border border-white/5 mb-6">
          <p className="text-white font-semibold mb-4">Metode Pembayaran</p>
          <div className="space-y-4">
            {categories.map(({ id, label, methods }) => (
              methods.length > 0 && (
                <div key={id}>
                  <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
                  <div className="space-y-1.5">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMethod(m.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${
                          selectedMethod === m.id
                            ? 'bg-electric-600/15 border-electric-600/40 text-white'
                            : 'glass border-white/5 text-white/70 hover:border-white/15 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{m.icon}</span>
                          <span className="text-sm font-medium">{m.label}</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedMethod === m.id ? 'border-electric-400' : 'border-white/20'
                        }`}>
                          {selectedMethod === m.id && (
                            <div className="w-2 h-2 rounded-full bg-electric-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-xl p-4 border border-yellow-400/10 mb-6">
          <div className="flex gap-2.5">
            <Zap size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-white/50 text-xs leading-relaxed">
              Saldo akan dikreditkan <strong className="text-white/70">otomatis</strong> setelah pembayaran terverifikasi oleh sistem. Proses biasanya kurang dari 1 menit.
            </p>
          </div>
        </motion.div>

        {/* Submit */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onClick={handleSubmit}
          disabled={submitting || numAmount < 10000 || !selectedMethod}
          className="w-full py-4 rounded-2xl bg-electric-gradient text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-glow-blue"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              Lanjut Bayar {numAmount >= 10000 ? formatCurrency(numAmount) : ''}
              <ChevronRight size={18} />
            </>
          )}
        </motion.button>

      </div>
      <Footer />
    </main>
  );
}
