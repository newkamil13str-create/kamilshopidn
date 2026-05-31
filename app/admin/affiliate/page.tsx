'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import { Users, DollarSign, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface AffiliateUser {
  id: string;
  displayName: string;
  email: string;
  referralCode: string;
  affiliateBalance: number;
  totalOrders: number;
}

interface AffiliateTrx {
  id: string;
  affiliateUserId: string;
  orderId: string;
  commission: number;
  status: 'pending' | 'paid';
}

export default function AffiliatePage() {
  const [users, setUsers]   = useState<AffiliateUser[]>([]);
  const [trxs, setTrxs]     = useState<AffiliateTrx[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'users' | 'transactions'>('users');

  async function load() {
    const [uSnap, tSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('affiliateBalance', '>', 0))),
      getDocs(query(collection(db, 'affiliate_transactions'), orderBy('createdAt', 'desc'))),
    ]);
    setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AffiliateUser)));
    setTrxs(tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AffiliateTrx)));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const handlePay = async (trx: AffiliateTrx) => {
    try {
      await updateDoc(doc(db, 'affiliate_transactions', trx.id), { status: 'paid' });
      // Kurangi balance user
      const userRef = doc(db, 'users', trx.affiliateUserId);
      const user = users.find((u) => u.id === trx.affiliateUserId);
      if (user) {
        await updateDoc(userRef, {
          affiliateBalance: Math.max(0, (user.affiliateBalance || 0) - trx.commission),
        });
      }
      toast.success('Komisi ditandai sudah dibayar!');
      load();
    } catch {
      toast.error('Gagal update');
    }
  };

  const totalPending = trxs.filter((t) => t.status === 'pending').reduce((s, t) => s + t.commission, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users size={24} className="text-electric-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Affiliate</h1>
          <p className="text-white/40 text-sm">Kelola komisi affiliate</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-white/40 text-xs mb-1">Total Affiliator</p>
          <p className="text-white text-2xl font-bold">{users.length}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-white/40 text-xs mb-1">Komisi Pending</p>
          <p className="text-gold-400 text-2xl font-bold">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['users', 'transactions'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-electric-gradient text-white' : 'glass text-white/40'}`}>
            {t === 'users' ? 'Affiliator' : 'Transaksi'}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Nama', 'Email', 'Kode Referral', 'Saldo Komisi'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-white/30 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white text-sm">{u.displayName}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-gold-400 text-xs bg-gold-500/10 px-2 py-1 rounded">
                      {u.referralCode || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-green-400 font-mono text-sm">
                    {formatCurrency(u.affiliateBalance || 0)}
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-white/20">Belum ada affiliator</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Order ID', 'Komisi', 'Status', 'Aksi'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-white/30 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trxs.map((t) => (
                <tr key={t.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white/50 font-mono text-xs">{t.orderId}</td>
                  <td className="px-4 py-3 text-green-400 font-mono text-sm">{formatCurrency(t.commission)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-lg ${t.status === 'paid' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      {t.status === 'paid' ? 'Dibayar' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.status === 'pending' && (
                      <button onClick={() => handlePay(t)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                        <CheckCircle size={12} /> Tandai Dibayar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && trxs.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-white/20">Belum ada transaksi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
