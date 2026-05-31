'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import { Zap, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '@/types';
import toast from 'react-hot-toast';
import Image from 'next/image';

const schema = z.object({
  flashSalePrice: z.coerce.number().min(1000),
  flashSaleEnd:   z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function FlashSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading]   = useState(true);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function load() {
    const snap = await getDocs(collection(db, 'products'));
    setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const onSubmit = async (data: FormData) => {
    if (!selected) return;
    try {
      await updateDoc(doc(db, 'products', selected.id), {
        flashSalePrice: data.flashSalePrice,
        flashSaleEnd:   data.flashSaleEnd,
        badge:          'flash-sale',
      });
      toast.success('Flash sale diaktifkan!');
      setSelected(null);
      reset();
      load();
    } catch {
      toast.error('Gagal menyimpan');
    }
  };

  const handleStop = async (p: Product) => {
    try {
      await updateDoc(doc(db, 'products', p.id), {
        flashSalePrice: null,
        flashSaleEnd:   null,
        badge:          '',
      });
      toast.success('Flash sale dihentikan!');
      load();
    } catch {
      toast.error('Gagal');
    }
  };

  const flashProducts = products.filter((p) => p.flashSalePrice && p.flashSaleEnd);
  const normalProducts = products.filter((p) => !p.flashSalePrice);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap size={24} className="text-gold-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Flash Sale</h1>
          <p className="text-white/40 text-sm">Harga otomatis kembali normal setelah waktu habis</p>
        </div>
      </div>

      {/* Active flash sales */}
      {flashProducts.length > 0 && (
        <div>
          <h2 className="text-white/60 text-sm font-medium mb-3">⚡ Sedang Flash Sale</h2>
          <div className="space-y-3">
            {flashProducts.map((p) => {
              const endDate = p.flashSaleEnd ? new Date(p.flashSaleEnd) : null;
              const isExpired = endDate && endDate < new Date();
              return (
                <div key={p.id} className="glass rounded-xl p-4 border border-gold-500/20 flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gold-400 font-mono text-sm">{formatCurrency(p.flashSalePrice || 0)}</span>
                      <span className="text-white/30 text-xs line-through">{formatCurrency(p.price)}</span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isExpired ? 'text-red-400' : 'text-white/40'}`}>
                      {isExpired ? '⚠️ Sudah berakhir' : `Berakhir: ${endDate?.toLocaleString('id-ID')}`}
                    </p>
                  </div>
                  <button onClick={() => handleStop(p)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20">
                    Stop
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add flash sale */}
      <div>
        <h2 className="text-white/60 text-sm font-medium mb-3">Tambah Flash Sale</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {normalProducts.map((p) => (
            <button key={p.id} onClick={() => { setSelected(p); reset(); }}
              className={`glass rounded-xl p-3 border text-left transition-all ${selected?.id === p.id ? 'border-electric-400/50 bg-electric-600/10' : 'border-white/5 hover:border-white/10'}`}>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                  <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="40px" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <p className="text-white/40 text-xs font-mono">{formatCurrency(p.price)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass rounded-2xl border border-white/5 w-full max-w-sm">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-semibold">⚡ Flash Sale — {selected.name}</h2>
                <button onClick={() => setSelected(null)} className="p-2 rounded-xl glass text-white/40"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Harga Flash Sale (Rp) *</label>
                  <input {...register('flashSalePrice')} type="number"
                    placeholder={String(Math.floor(selected.price * 0.7))}
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
                  {errors.flashSalePrice && <p className="text-red-400 text-xs mt-1">{errors.flashSalePrice.message}</p>}
                  <p className="text-white/30 text-xs mt-1">Harga normal: {formatCurrency(selected.price)}</p>
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Berakhir pada *</label>
                  <input {...register('flashSaleEnd')} type="datetime-local"
                    className="input-dark w-full px-3 py-2.5 rounded-xl text-sm" />
                  {errors.flashSaleEnd && <p className="text-red-400 text-xs mt-1">{errors.flashSaleEnd.message}</p>}
                </div>
                <button type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-electric-gradient text-white font-semibold">
                  <Check size={16} /> Aktifkan Flash Sale
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
