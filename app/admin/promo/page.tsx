'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, X, Check, Tag, Copy } from 'lucide-react';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { PromoCode } from '@/types';

const schema = z.object({
  code:      z.string().min(3).max(20).toUpperCase(),
  type:      z.enum(['percent', 'fixed']),
  value:     z.coerce.number().min(1),
  minOrder:  z.coerce.number().min(0),
  maxUses:   z.coerce.number().min(0),
  expiredAt: z.string(),
  isActive:  z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function PromoPage() {
  const [promos, setPromos]     = useState<PromoCode[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'percent', isActive: true, minOrder: 0, maxUses: 0 },
  });

  async function load() {
    const q = query(collection(db, 'promo_codes'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setPromos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCode)));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'promo_codes'), {
        ...data,
        code:      data.code.toUpperCase(),
        usedCount: 0,
        createdAt: serverTimestamp(),
      });
      toast.success('Kode promo ditambahkan!');
      setShowModal(false);
      reset();
      load();
    } catch {
      toast.error('Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: PromoCode) => {
    await updateDoc(doc(db, 'promo_codes', p.id), { isActive: !p.isActive });
    toast.success(p.isActive ? 'Dinonaktifkan' : 'Diaktifkan');
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'promo_codes', id));
    toast.success('Dihapus');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Kode Promo</h1>
          <p className="text-white/40 text-sm">{promos.length} kode aktif</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-electric-gradient text-white font-medium text-sm"
        >
          <Plus size={16} /> Tambah Promo
        </button>
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Kode', 'Diskon', 'Min Order', 'Digunakan', 'Expired', 'Status', 'Aksi'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-white/30 text-xs font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded w-20" /></td>
                      ))}
                    </tr>
                  ))
                : promos.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gold-400">{p.code}</span>
                          <button onClick={() => { navigator.clipboard.writeText(p.code); toast.success('Disalin!'); }}>
                            <Copy size={12} className="text-white/30 hover:text-white" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-green-400 font-mono text-xs">
                        {p.type === 'percent' ? `${p.value}%` : formatCurrency(p.value)}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {p.minOrder ? formatCurrency(p.minOrder) : '-'}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {p.usedCount}/{p.maxUses || '∞'}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {p.expiredAt ? new Date(p.expiredAt).toLocaleDateString('id-ID') : '∞'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggle(p)} className={`text-xs px-2 py-1 rounded-lg ${p.isActive ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'}`}>
                          {p.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && promos.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <Tag size={32} className="mx-auto mb-2 opacity-30" />
              Belum ada kode promo
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass rounded-2xl border border-white/5 w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-semibold">Tambah Kode Promo</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl glass text-white/40"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Kode *</label>
                    <input {...register('code')} placeholder="KAMIL10" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm font-mono uppercase" />
                    {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code.message}</p>}
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Tipe</label>
                    <select {...register('type')} className="input-dark w-full px-3 py-2.5 rounded-xl text-sm">
                      <option value="percent">Persen (%)</option>
                      <option value="fixed">Nominal (Rp)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Nilai *</label>
                    <input {...register('value')} type="number" placeholder="10" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Min Order (Rp)</label>
                    <input {...register('minOrder')} type="number" placeholder="0" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Max Penggunaan (0=∞)</label>
                    <input {...register('maxUses')} type="number" placeholder="0" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Expired</label>
                    <input {...register('expiredAt')} type="date" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-electric-gradient text-white font-semibold disabled:opacity-50">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={16} /> Simpan</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
