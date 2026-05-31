'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  collection, addDoc, getDocs, query, where, orderBy,
  serverTimestamp, updateDoc, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { Review } from '@/types';

const schema = z.object({
  rating:  z.number().min(1).max(5),
  comment: z.string().min(10, 'Minimal 10 karakter'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  productId: string;
}

export default function ProductReviews({ productId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const user = useAuthStore((s) => s.user);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function load() {
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
    setReviews(data);

    if (user) {
      setHasReviewed(data.some((r) => r.userId === user.id));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [productId, user]);

  const onSubmit = async (data: FormData) => {
    if (!user) return toast.error('Login dulu untuk review');
    if (!selected) return toast.error('Pilih rating bintang');

    setSubmitting(true);
    try {
      const reviewRef = await addDoc(collection(db, 'reviews'), {
        productId,
        userId:      user.id,
        orderId:     '',
        displayName: user.displayName || 'User',
        rating:      selected,
        comment:     data.comment,
        createdAt:   serverTimestamp(),
      });

      // Update product rating
      const allRatings = [...reviews.map((r) => r.rating), selected];
      const avgRating  = allRatings.reduce((s, r) => s + r, 0) / allRatings.length;
      await updateDoc(doc(db, 'products', productId), {
        rating:      Math.round(avgRating * 10) / 10,
        ratingCount: allRatings.length,
      });

      toast.success('Review berhasil dikirim!');
      setHasReviewed(true);
      load();
    } catch {
      toast.error('Gagal kirim review');
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-display font-bold text-xl">
          Ulasan ({reviews.length})
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Star size={16} className="text-gold-400 fill-gold-400" />
            <span className="text-gold-400 font-bold">{avgRating.toFixed(1)}</span>
            <span className="text-white/30 text-sm">/ 5</span>
          </div>
        )}
      </div>

      {/* Form review */}
      {user && !hasReviewed && (
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="text-white font-medium mb-4">Tulis Ulasan</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Star rating */}
            <div>
              <label className="text-white/60 text-sm mb-2 block">Rating *</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => { setSelected(star); setValue('rating', star); }}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={28}
                      className={`transition-colors ${
                        star <= (hovered || selected)
                          ? 'text-gold-400 fill-gold-400'
                          : 'text-white/20'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-white/60 text-sm mb-1 block">Komentar *</label>
              <textarea
                {...register('comment')}
                rows={3}
                placeholder="Ceritakan pengalaman kamu dengan produk ini..."
                className="input-dark w-full px-3 py-2.5 rounded-xl text-sm resize-none"
              />
              {errors.comment && <p className="text-red-400 text-xs mt-1">{errors.comment.message}</p>}
            </div>

            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-electric-gradient text-white font-medium text-sm disabled:opacity-50">
              {submitting ? 'Mengirim...' : 'Kirim Ulasan'}
            </button>
          </form>
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-white/20">
          <Star size={32} className="mx-auto mb-2 opacity-30" />
          Belum ada ulasan
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 border border-white/5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-medium text-sm">{r.displayName}</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={12}
                        className={s <= r.rating ? 'text-gold-400 fill-gold-400' : 'text-white/20'} />
                    ))}
                  </div>
                </div>
                <span className="text-white/30 text-xs">
                  {r.createdAt instanceof Date
                    ? r.createdAt.toLocaleDateString('id-ID')
                    : typeof r.createdAt === 'object' && r.createdAt !== null && 'toDate' in r.createdAt
                    ? (r.createdAt as { toDate: () => Date }).toDate().toLocaleDateString('id-ID')
                    : ''}
                </span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
