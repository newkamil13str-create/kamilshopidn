'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { Shield, AlertTriangle, Ban } from 'lucide-react';
import toast from 'react-hot-toast';

interface CopyAttempt {
  id: string;
  type: string;
  page: string;
  time: string;
  ip: string;
  ua: string;
  blacklisted: boolean;
}

export default function SecurityPage() {
  const [attempts, setAttempts] = useState<CopyAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const q = query(
        collection(db, 'copy_attempts'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CopyAttempt)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleBlacklist = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'copy_attempts', id), { blacklisted: !current });
      toast.success(current ? 'Dihapus dari blacklist' : 'IP di-blacklist!');
      load();
    } catch {
      toast.error('Gagal update');
    }
  };

  // Group by IP
  const ipStats = attempts.reduce((acc, a) => {
    acc[a.ip] = (acc[a.ip] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={24} className="text-electric-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Security Log</h1>
          <p className="text-white/40 text-sm">{attempts.length} percobaan tercatat</p>
        </div>
      </div>

      {/* IP Stats */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <h2 className="text-white/60 text-sm font-medium mb-3">Top IP Mencurigakan</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ipStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([ip, count]) => (
              <span key={ip} className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                {ip} ({count}x)
              </span>
            ))}
        </div>
      </div>

      {/* Log table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Waktu', 'Tipe', 'Halaman', 'IP', 'Status', 'Aksi'].map((h) => (
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
                : attempts.map((a) => (
                    <tr key={a.id} className={`border-b border-white/5 ${a.blacklisted ? 'bg-red-500/5' : ''}`}>
                      <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{a.time ? new Date(a.time).toLocaleString('id-ID') : '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-xs font-mono">{a.type}</span>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs font-mono">{a.page}</td>
                      <td className="px-4 py-3 text-white/70 text-xs font-mono">{a.ip}</td>
                      <td className="px-4 py-3">
                        {a.blacklisted
                          ? <span className="text-red-400 text-xs flex items-center gap-1"><Ban size={12} /> Blacklisted</span>
                          : <span className="text-green-400 text-xs">Normal</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleBlacklist(a.id, a.blacklisted)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            a.blacklisted
                              ? 'bg-white/5 text-white/40 hover:text-white'
                              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          }`}
                        >
                          {a.blacklisted ? 'Unban' : 'Blacklist'}
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && attempts.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
              Belum ada log
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
