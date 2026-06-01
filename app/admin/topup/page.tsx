'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Gamepad2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

interface TopupOrder {
  id: string;
  orderId: string;
  gameName: string;
  productName: string;
  gameDestination: string;
  gameZoneId?: string;
  amount: number;
  status: string;
  topupStatus?: string;
  topupNote?: string;
  customerEmail: string;
  createdAt: { toDate?: () => Date } | Date | string;
}

export default function AdminTopupPage() {
  const [orders, setOrders] = useState<TopupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'processing' | 'delivered' | 'topup_failed'>('all');

  async function load() {
    setLoading(true);
    try {
      let q;
      if (filter === 'all') {
        q = query(
          collection(db, 'orders'),
          where('productType', '==', 'topup-game'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
      } else {
        q = query(
          collection(db, 'orders'),
          where('productType', '==', 'topup-game'),
          where('status', '==', filter),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
      }
      const snap = await getDocs(q);
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TopupOrder)));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  const handleRetry = async (orderId: string) => {
    try {
      const res = await fetch('/api/topup-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Topup retry berhasil dikirim!');
      } else {
        toast.error(data.error || data.message || 'Gagal retry');
      }
      load();
    } catch {
      toast.error('Gagal menghubungi server');
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'delivered') return <CheckCircle size={14} className="text-green-400" />;
    if (status === 'topup_failed') return <XCircle size={14} className="text-red-400" />;
    return <Clock size={14} className="text-yellow-400" />;
  };

  const statusLabel = (status: string) => {
    if (status === 'delivered') return 'Berhasil';
    if (status === 'topup_failed') return 'Gagal';
    if (status === 'paid') return 'Processing';
    return status;
  };

  const stats = {
    total:      orders.length,
    delivered:  orders.filter((o) => o.status === 'delivered').length,
    failed:     orders.filter((o) => o.status === 'topup_failed').length,
    processing: orders.filter((o) => ['paid', 'pending'].includes(o.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Gamepad2 size={24} className="text-purple-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Top Up Game</h1>
            <p className="text-white/40 text-sm">Monitor transaksi top up via Qiospay</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-white/60 text-sm hover:text-white">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Berhasil', value: stats.delivered, color: 'text-green-400' },
          { label: 'Processing', value: stats.processing, color: 'text-yellow-400' },
          { label: 'Gagal', value: stats.failed, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-4 border border-white/5">
            <p className="text-white/40 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'processing', 'delivered', 'topup_failed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f ? 'bg-electric-gradient text-white' : 'glass text-white/40 hover:text-white'}`}>
            {f === 'all' ? 'Semua' : f === 'processing' ? 'Processing' : f === 'delivered' ? 'Berhasil' : 'Gagal'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Game', 'Produk', 'Tujuan', 'Nominal', 'Status', 'Aksi'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-white/30 text-xs font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded w-20" /></td>
                      ))}
                    </tr>
                  ))
                : orders.map((o) => (
                    <tr key={o.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-4 py-3">
                        <p className="text-white text-sm font-medium">{o.gameName || '-'}</p>
                        <p className="text-white/30 text-xs">{o.customerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-xs">{o.productName}</td>
                      <td className="px-4 py-3">
                        <p className="text-white/70 text-xs font-mono">{o.gameDestination}</p>
                        {o.gameZoneId && <p className="text-white/30 text-xs">Zone: {o.gameZoneId}</p>}
                      </td>
                      <td className="px-4 py-3 text-gold-400 font-mono text-xs whitespace-nowrap">
                        {formatCurrency(o.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(o.status)}
                          <span className={`text-xs ${o.status === 'delivered' ? 'text-green-400' : o.status === 'topup_failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {statusLabel(o.status)}
                          </span>
                        </div>
                        {o.topupNote && (
                          <p className="text-white/30 text-xs mt-0.5 max-w-[200px] truncate" title={o.topupNote}>
                            {o.topupNote}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(o.status === 'topup_failed' || o.status === 'paid') && (
                          <button
                            onClick={() => handleRetry(o.orderId)}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 whitespace-nowrap"
                          >
                            <RefreshCw size={11} /> Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && orders.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <Gamepad2 size={32} className="mx-auto mb-2 opacity-30" />
              Belum ada transaksi top up
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
