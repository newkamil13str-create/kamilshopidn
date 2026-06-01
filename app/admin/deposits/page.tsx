'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, Search, RefreshCw, TrendingUp,
  Clock, CheckCircle, XCircle, Ban,
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, where, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deposit } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_TABS = [
  { id: 'all',       label: 'Semua',    icon: Wallet },
  { id: 'pending',   label: 'Pending',  icon: Clock },
  { id: 'paid',      label: 'Berhasil', icon: CheckCircle },
  { id: 'failed',    label: 'Gagal',    icon: XCircle },
  { id: 'cancelled', label: 'Dibatal',  icon: Ban },
];

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  paid:      'text-green-400  bg-green-400/10  border-green-400/20',
  failed:    'text-red-400    bg-red-400/10    border-red-400/20',
  cancelled: 'text-gray-400  bg-gray-400/10  border-gray-400/20',
};

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  paid:      'Berhasil',
  failed:    'Gagal',
  cancelled: 'Dibatalkan',
};

export default function AdminDepositsPage() {
  const [deposits, setDeposits]   = useState<Deposit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch]       = useState('');

  useEffect(() => {
    setLoading(true);
    const constraints: QueryConstraint[] = [];
    if (activeTab !== 'all') {
      constraints.push(where('status', '==', activeTab));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      query(collection(db, 'deposits'), ...constraints),
      (snap) => {
        setDeposits(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deposit)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [activeTab]);

  const filtered = deposits.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.depositId.toLowerCase().includes(q) ||
      d.customerName.toLowerCase().includes(q) ||
      d.customerEmail.toLowerCase().includes(q)
    );
  });

  // Stats
  const totalPaid   = deposits.filter((d) => d.status === 'paid').reduce((s, d) => s + d.amount, 0);
  const countPaid   = deposits.filter((d) => d.status === 'paid').length;
  const countPending = deposits.filter((d) => d.status === 'pending').length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center">
          <Wallet size={20} className="text-gold-400" />
        </div>
        <div>
          <h1 className="text-white font-display text-xl font-bold">Manajemen Deposit</h1>
          <p className="text-white/40 text-sm">Kelola semua transaksi top up saldo user</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} className="text-green-400" />
            <span className="text-white/40 text-xs">Total Deposit</span>
          </div>
          <p className="text-white text-xl font-bold font-mono">{formatCurrency(totalPaid)}</p>
          <p className="text-white/30 text-xs mt-1">{countPaid} transaksi berhasil</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={15} className="text-yellow-400" />
            <span className="text-white/40 text-xs">Pending</span>
          </div>
          <p className="text-white text-xl font-bold">{countPending}</p>
          <p className="text-white/30 text-xs mt-1">Menunggu pembayaran</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={15} className="text-electric-400" />
            <span className="text-white/40 text-xs">Total Transaksi</span>
          </div>
          <p className="text-white text-xl font-bold">{deposits.length}</p>
          <p className="text-white/30 text-xs mt-1">Semua status</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex gap-1.5 glass rounded-xl p-1 overflow-x-auto flex-shrink-0">
          {STATUS_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === id
                  ? 'bg-electric-600/20 text-electric-400 border border-electric-600/30'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Cari deposit ID, nama, atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-electric-600/40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw size={24} className="text-white/20 animate-spin mx-auto mb-3" />
            <p className="text-white/30 text-sm">Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet size={36} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Tidak ada deposit ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3.5 text-white/30 text-xs font-medium uppercase tracking-wider">Deposit ID</th>
                  <th className="text-left px-5 py-3.5 text-white/30 text-xs font-medium uppercase tracking-wider">User</th>
                  <th className="text-left px-5 py-3.5 text-white/30 text-xs font-medium uppercase tracking-wider">Nominal</th>
                  <th className="text-left px-5 py-3.5 text-white/30 text-xs font-medium uppercase tracking-wider">Metode</th>
                  <th className="text-left px-5 py-3.5 text-white/30 text-xs font-medium uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-white/30 text-xs font-medium uppercase tracking-wider">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((deposit, i) => (
                  <motion.tr
                    key={deposit.depositId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-white font-mono text-xs">{deposit.depositId}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-white text-sm font-medium">{deposit.customerName}</p>
                      <p className="text-white/30 text-xs">{deposit.customerEmail}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gold-400 font-mono text-sm font-bold">{formatCurrency(deposit.amount)}</p>
                      {deposit.fee > 0 && (
                        <p className="text-white/30 text-xs">+{formatCurrency(deposit.fee)} fee</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-white/60 text-xs uppercase">{deposit.paymentMethod}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${STATUS_COLORS[deposit.status] || ''}`}>
                        {STATUS_LABELS[deposit.status] || deposit.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-white/40 text-xs">
                        {deposit.createdAt ? formatDate(deposit.createdAt as Date) : '—'}
                      </p>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
