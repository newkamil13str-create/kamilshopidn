'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import ReferralCard from '@/components/public/ReferralCard';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { Order } from '@/types';
import { Package, ShoppingBag, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', user.id),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (authLoading || !user) {
    return (
      <main className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-electric-600/30 border-t-electric-600 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen animated-gradient mobile-nav-safe">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white mb-1">
            Halo, {user.displayName || 'Pengguna'} 👋
          </h1>
          <p className="text-white/40 text-sm">{user.email}</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-electric-500/20 flex items-center justify-center">
                <ShoppingBag size={16} className="text-electric-400" />
              </div>
              <span className="text-white/40 text-sm">Total Order</span>
            </div>
            <p className="text-white text-3xl font-bold">{orders.length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Package size={16} className="text-green-400" />
              </div>
              <span className="text-white/40 text-sm">Terkirim</span>
            </div>
            <p className="text-white text-3xl font-bold">
              {orders.filter((o) => o.status === 'delivered').length}
            </p>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-electric-400" />
            <h2 className="text-white font-semibold">Program Affiliate</h2>
          </div>
          <ReferralCard />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-white font-semibold mb-4">Riwayat Pesanan</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-4 border border-white/5">
                  <div className="h-4 shimmer rounded w-1/3 mb-2" />
                  <div className="h-3 shimmer rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="glass rounded-2xl p-10 border border-white/5 text-center">
              <ShoppingBag size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 mb-4">Belum ada pesanan</p>
              <Link href="/products"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-electric-gradient text-white text-sm font-medium">
                Mulai Belanja <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link key={order.orderId} href={`/order/${order.orderId}`}>
                  <div className="glass rounded-2xl p-4 border border-white/5 hover:border-electric-600/20 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium text-sm truncate pr-4">{order.productName}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs font-mono">{order.orderId}</span>
                      <span className="text-gold-400 font-mono text-sm font-bold">
                        {formatCurrency(order.totalPayment || order.amount)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

      </div>
      <Footer />
    </main>
  );
}
