'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Zap, AlertCircle, ChevronRight,
  Gamepad2, User, Globe, Search, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import { useCheckoutStore } from '@/store';
import { formatCurrency } from '@/lib/utils';
import { GameData, GameProduct, Product } from '@/types';
import gamesData from '@/data/games.json';
import toast from 'react-hot-toast';

const games = gamesData as GameData[];

const MARKUP_PERCENT = Number(process.env.NEXT_PUBLIC_TOPUP_MARKUP || '10');
function applyMarkup(supplierPrice: number): number {
  return Math.ceil((supplierPrice * (1 + MARKUP_PERCENT / 100)) / 100) * 100;
}

// Game yang support cek nickname otomatis
const SUPPORTED_CHECK_GAMES = ['free-fire', 'mobile-legends', 'mobile-legends-malaysia'];

type CheckState = 'idle' | 'loading' | 'valid' | 'invalid' | 'not_supported';

export default function GameTopupPage() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const router = useRouter();
  const { setSelectedProduct } = useCheckoutStore();

  const game = useMemo(
    () => games.find((g) => g.slug === gameSlug) || null,
    [gameSlug]
  );

  const [selectedProduct, setSelectedGameProduct] = useState<GameProduct | null>(null);
  const [userId, setUserId]     = useState('');
  const [zoneId, setZoneId]     = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [checkedUsername, setCheckedUsername] = useState('');
  const [checkError, setCheckError] = useState('');
  const [loading, setLoading]   = useState(false);

  if (!game) {
    return (
      <main className="min-h-screen animated-gradient">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">🎮</div>
            <h1 className="text-white text-2xl font-bold mb-2">Game Tidak Ditemukan</h1>
            <Link href="/topup" className="text-purple-400 hover:underline">← Kembali ke daftar game</Link>
          </div>
        </div>
      </main>
    );
  }

  const supportsCheck = SUPPORTED_CHECK_GAMES.includes(game.slug);
  const idLabel   = 'User ID';
  const zoneLabel = 'Zone ID / Server';

  // Reset check state kalau user ubah ID atau Zone ID
  const handleUserIdChange = (val: string) => {
    setUserId(val);
    setCheckState('idle');
    setCheckedUsername('');
    setCheckError('');
  };
  const handleZoneIdChange = (val: string) => {
    setZoneId(val);
    setCheckState('idle');
    setCheckedUsername('');
    setCheckError('');
  };

  // ─── Cek Nickname ───────────────────────────────────────────────────────────
  const handleCheckId = async () => {
    if (!userId.trim()) {
      toast.error(`Masukkan ${idLabel} terlebih dahulu`);
      return;
    }
    if (game.needsZoneId && !zoneId.trim()) {
      toast.error('Masukkan Zone ID terlebih dahulu');
      return;
    }

    setCheckState('loading');
    setCheckedUsername('');
    setCheckError('');

    try {
      const params = new URLSearchParams({ game: game.slug, userId: userId.trim() });
      if (game.needsZoneId && zoneId.trim()) params.append('zoneId', zoneId.trim());

      const res  = await fetch(`/api/check-game-id?${params.toString()}`);
      const data = await res.json();

      if (!data.supported) {
        setCheckState('not_supported');
        return;
      }

      if (data.valid && data.username) {
        setCheckState('valid');
        setCheckedUsername(data.username);
      } else {
        setCheckState('invalid');
        setCheckError(data.error || 'Akun tidak ditemukan. Periksa kembali ID kamu.');
      }
    } catch {
      setCheckState('invalid');
      setCheckError('Gagal menghubungi server. Coba lagi.');
    }
  };

  // ─── Lanjut ke Checkout ─────────────────────────────────────────────────────
  const handleCheckout = () => {
    if (!selectedProduct) {
      toast.error('Pilih nominal top up terlebih dahulu');
      return;
    }
    if (!userId.trim()) {
      toast.error(`Masukkan ${idLabel} game kamu`);
      return;
    }
    if (game.needsZoneId && !zoneId.trim()) {
      toast.error('Masukkan Zone ID / Server game kamu');
      return;
    }
    // Kalau game support cek tapi belum dicek atau invalid → blokir
    if (supportsCheck && checkState !== 'valid' && checkState !== 'not_supported') {
      toast.error('Cek akun terlebih dahulu sebelum melanjutkan');
      return;
    }

    setLoading(true);

    const markedUpPrice = applyMarkup(selectedProduct.price);
    const checkoutProduct: Product = {
      id: `topup-${game.slug}-${selectedProduct.code}`,
      name: `${game.name} — ${selectedProduct.name}`,
      slug: `${game.slug}-${selectedProduct.code.toLowerCase()}`,
      description: `Top Up ${game.name} ${selectedProduct.name}`,
      features: [
        `Nominal: ${selectedProduct.name}`,
        `Game: ${game.name}`,
        'Proses otomatis',
        'Instan & aman',
      ],
      price: markedUpPrice,
      originalPrice: markedUpPrice,
      category: 'top-up-game',
      imageUrl: `/images/games/${game.slug}.jpg`,
      badge: '' as const,
      rating: 5.0,
      totalSold: 0,
      stock: [],
      isActive: true,
      productType: 'topup-game',
      qiospayProduct: selectedProduct.code,
      gameName: game.name,
      needsZoneId: game.needsZoneId,
      needsNick: game.needsNick,
      idLabel,
      zoneLabel,
    };

    setSelectedProduct(checkoutProduct, 1, {
      gameDestination: userId.trim(),
      gameZoneId: game.needsZoneId ? zoneId.trim() : undefined,
    });

    router.push('/checkout');
  };

  // Tombol checkout hanya aktif kalau:
  // 1. Ada produk dipilih
  // 2. Ada userId
  // 3. Jika needsZoneId → ada zoneId
  // 4. Jika supportsCheck → checkState === 'valid' atau 'not_supported'
  const canCheckout =
    !!selectedProduct &&
    !!userId.trim() &&
    (!game.needsZoneId || !!zoneId.trim()) &&
    (!supportsCheck || checkState === 'valid' || checkState === 'not_supported');

  return (
    <main className="min-h-screen animated-gradient mobile-nav-safe">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        {/* Breadcrumb */}
        <Link
          href="/topup"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Semua Game
        </Link>

        {/* Game Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/10 rounded-3xl p-6 sm:p-8 mb-6"
        >
          <div className="flex items-center gap-5">
            <div className="text-5xl sm:text-6xl">{game.icon}</div>
            <div>
              <h1 className="text-white text-2xl sm:text-3xl font-extrabold">{game.name}</h1>
              <p className="text-white/40 text-sm mt-1">
                {game.products.length} pilihan nominal · Proses otomatis
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-400 text-xs px-2.5 py-1 rounded-full border border-green-500/20">
                  <Zap className="w-3 h-3" /> Instan
                </span>
                <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-400 text-xs px-2.5 py-1 rounded-full border border-purple-500/20">
                  <Gamepad2 className="w-3 h-3" /> H2H
                </span>
                {supportsCheck && (
                  <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Cek Akun
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Step 1 — Pilih Nominal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass border border-white/10 rounded-3xl p-6 sm:p-8 mb-6"
        >
          <h2 className="text-white font-bold text-lg mb-4">1. Pilih Nominal</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {game.products.map((prod) => {
              const price      = applyMarkup(prod.price);
              const isSelected = selectedProduct?.code === prod.code;
              return (
                <button
                  key={prod.code}
                  onClick={() => setSelectedGameProduct(prod)}
                  className={`
                    relative text-left p-3.5 rounded-2xl border transition-all duration-200
                    ${isSelected
                      ? 'border-purple-500 bg-purple-500/15 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                      : 'border-white/10 bg-white/3 hover:border-purple-500/40 hover:bg-white/6'}
                  `}
                >
                  <p className="text-white text-sm font-semibold leading-tight mb-1">{prod.name}</p>
                  <p className={`text-xs font-bold ${isSelected ? 'text-purple-300' : 'text-white/60'}`}>
                    {formatCurrency(price)}
                  </p>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Step 2 — Input Data Akun */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass border border-white/10 rounded-3xl p-6 sm:p-8 mb-6"
        >
          <h2 className="text-white font-bold text-lg mb-4">2. Masukkan Data Akun</h2>

          <div className="space-y-4">
            {/* User ID */}
            <div>
              <label className="flex items-center gap-2 text-white/70 text-sm font-medium mb-2">
                <User className="w-4 h-4" />
                {idLabel}
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => handleUserIdChange(e.target.value)}
                placeholder={`Masukkan ${idLabel} kamu`}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-all"
              />
            </div>

            {/* Zone ID */}
            {game.needsZoneId && (
              <div>
                <label className="flex items-center gap-2 text-white/70 text-sm font-medium mb-2">
                  <Globe className="w-4 h-4" />
                  {zoneLabel}
                </label>
                <input
                  type="text"
                  value={zoneId}
                  onChange={(e) => handleZoneIdChange(e.target.value)}
                  placeholder="Contoh: 1234"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
            )}

            {/* Tombol Cek Akun — hanya muncul untuk game yang support */}
            {supportsCheck && (
              <button
                onClick={handleCheckId}
                disabled={checkState === 'loading' || !userId.trim() || (game.needsZoneId && !zoneId.trim())}
                className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 disabled:opacity-40 border border-white/15 hover:border-purple-500/40 text-white font-semibold py-3 rounded-xl transition-all duration-200"
              >
                {checkState === 'loading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Mengecek akun...</>
                ) : (
                  <><Search className="w-4 h-4" /> Cek Akun</>
                )}
              </button>
            )}

            {/* Hasil Cek */}
            <AnimatePresence>
              {checkState === 'valid' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-green-300 font-semibold text-sm">Akun Ditemukan</p>
                    <p className="text-white font-bold text-base mt-0.5">{checkedUsername}</p>
                    <p className="text-white/40 text-xs mt-0.5">Pastikan ini akun yang benar sebelum melanjutkan</p>
                  </div>
                </motion.div>
              )}

              {checkState === 'invalid' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4"
                >
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-red-300 font-semibold text-sm">Akun Tidak Ditemukan</p>
                    <p className="text-white/60 text-xs mt-0.5">{checkError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info */}
            <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5">
              <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-blue-300/80 text-xs leading-relaxed">
                {supportsCheck
                  ? `Klik "Cek Akun" untuk memastikan ${idLabel} kamu benar sebelum melanjutkan. Top up yang salah tidak dapat direfund.`
                  : `Pastikan ${idLabel} yang kamu masukkan sudah benar. Top up yang salah tidak dapat direfund.`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Step 3 — Konfirmasi & Checkout */}
        <AnimatePresence>
          {selectedProduct && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="glass border border-purple-500/30 rounded-3xl p-6 sm:p-8"
            >
              <h2 className="text-white font-bold text-lg mb-4">3. Konfirmasi</h2>

              <div className="space-y-2 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Game</span>
                  <span className="text-white font-medium">{game.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Nominal</span>
                  <span className="text-white font-medium">{selectedProduct.name}</span>
                </div>
                {userId && (
                  <div className="flex justify-between">
                    <span className="text-white/50">{idLabel}</span>
                    <span className="text-white font-medium">{userId}</span>
                  </div>
                )}
                {game.needsZoneId && zoneId && (
                  <div className="flex justify-between">
                    <span className="text-white/50">{zoneLabel}</span>
                    <span className="text-white font-medium">{zoneId}</span>
                  </div>
                )}
                {/* Tampilkan username kalau sudah dicek */}
                {checkState === 'valid' && checkedUsername && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Nickname</span>
                    <span className="text-green-400 font-bold">{checkedUsername}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 mt-2 flex justify-between">
                  <span className="text-white/70 font-semibold">Total</span>
                  <span className="text-purple-300 font-extrabold text-lg">
                    {formatCurrency(applyMarkup(selectedProduct.price))}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading || !canCheckout}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all duration-200 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    {supportsCheck && checkState !== 'valid' && checkState !== 'not_supported'
                      ? 'Cek Akun Dulu'
                      : 'Lanjut ke Pembayaran'}
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Warning kalau belum cek */}
              {supportsCheck && checkState === 'idle' && userId.trim() && (
                <p className="text-center text-yellow-400/70 text-xs mt-3">
                  ⚠️ Klik &quot;Cek Akun&quot; terlebih dahulu untuk verifikasi
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </main>
  );
}
