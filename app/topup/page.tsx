'use client';

/**
 * app/topup/page.tsx
 *
 * Halaman daftar semua game yang tersedia untuk top up.
 * Data game diambil dari data/games.json (generated dari daftar_harga.xlsx Qiospay).
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Gamepad2, Zap, Star } from 'lucide-react';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import gamesData from '@/data/games.json';
import { GameData } from '@/types';

const games = gamesData as GameData[];

// Game populer (ditampilkan di bagian atas)
const popularSlugs = [
  'mobile-legends', 'free-fire', 'pubg-mobile', 'honor-of-kings',
  'call-of-duty-mobile', 'genshin-impact', 'valorant', 'ragnarok-x',
];

export default function TopupPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return games;
    const q = search.toLowerCase();
    return games.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.slug.includes(q)
    );
  }, [search]);

  const popular = games.filter((g) => popularSlugs.includes(g.slug));
  const showPopular = !search.trim() && popular.length > 0;

  return (
    <main className="min-h-screen animated-gradient mobile-nav-safe">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-2 text-purple-400 text-sm font-medium mb-4">
            <Gamepad2 className="w-4 h-4" />
            Top Up Game Instan
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
            Top Up{' '}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              All Game
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            {games.length}+ game tersedia. Proses otomatis via Qiospay H2H, instan & aman.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative max-w-lg mx-auto mb-12"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            placeholder="Cari game... (Mobile Legends, Free Fire, dll)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 transition-all"
          />
        </motion.div>

        {/* Popular Games */}
        {showPopular && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <h2 className="text-white font-bold text-lg">Game Populer</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {popular.map((game, i) => (
                <GameCard key={game.slug} game={game} index={i} popular />
              ))}
            </div>
          </motion.div>
        )}

        {/* All Games */}
        {!search.trim() && (
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-electric-400" />
            <h2 className="text-white font-bold text-lg">Semua Game</h2>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-white/50">Game &ldquo;{search}&rdquo; tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((game, i) => (
              <GameCard key={game.slug} game={game} index={i} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

function GameCard({
  game,
  index,
  popular,
}: {
  game: GameData;
  index: number;
  popular?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
    >
      <Link href={`/topup/${game.slug}`}>
        <div
          className={`
            group relative glass border border-white/10 rounded-2xl p-4
            hover:border-purple-500/40 hover:bg-white/8 transition-all duration-200
            cursor-pointer text-center
            ${popular ? 'sm:p-5' : ''}
          `}
        >
          {/* Icon */}
          <div
            className={`
              text-3xl mb-2 transition-transform group-hover:scale-110 duration-200
              ${popular ? 'text-4xl mb-3' : ''}
            `}
          >
            {game.icon}
          </div>

          {/* Name */}
          <p className="text-white text-xs font-semibold leading-tight line-clamp-2 group-hover:text-purple-300 transition-colors">
            {game.name}
          </p>

          {/* Products count */}
          <p className="text-white/30 text-xs mt-1">
            {game.products.length} pilihan
          </p>

          {/* Hover glow */}
          <div className="absolute inset-0 rounded-2xl bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  );
}
