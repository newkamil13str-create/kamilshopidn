'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store';
import { Copy, Users, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

function generateReferralCode(userId: string): string {
  return 'KML' + userId.slice(-6).toUpperCase();
}

export default function ReferralCard() {
  const user = useAuthStore((s) => s.user);
  const [referralCode, setReferralCode] = useState('');
  const [balance, setBalance]           = useState(0);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.id));
      const data    = userDoc.data();
      let code      = data?.referralCode;

      if (!code) {
        code = generateReferralCode(user.id);
        await updateDoc(doc(db, 'users', user.id), { referralCode: code, affiliateBalance: 0 });
      }

      setReferralCode(code);
      setBalance(data?.affiliateBalance || 0);
      setLoading(false);
    };
    load();
  }, [user]);

  const referralLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kamilshop.my.id'}?ref=${referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Link referral disalin!');
  };

  if (loading || !user) return null;

  return (
    <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-electric-400" />
        <h3 className="text-white font-semibold">Program Affiliate</h3>
      </div>

      <p className="text-white/50 text-sm">
        Bagikan link referral kamu. Dapatkan komisi dari setiap order yang masuk melalui link kamu.
      </p>

      {/* Referral code */}
      <div>
        <label className="text-white/40 text-xs mb-1.5 block">Kode Referral Kamu</label>
        <div className="flex items-center gap-2 bg-navy-100 rounded-xl px-4 py-3">
          <span className="font-mono font-bold text-gold-400 text-lg flex-1">{referralCode}</span>
          <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white">
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* Link */}
      <div>
        <label className="text-white/40 text-xs mb-1.5 block">Link Referral</label>
        <div className="flex items-center gap-2">
          <p className="text-white/50 text-xs font-mono flex-1 truncate bg-navy-100 rounded-xl px-3 py-2.5">
            {referralLink}
          </p>
          <button onClick={copyLink} className="flex-shrink-0 px-3 py-2.5 rounded-xl bg-electric-gradient text-white text-xs font-medium">
            Salin
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-green-400" />
          <span className="text-white/60 text-sm">Saldo Komisi</span>
        </div>
        <span className="text-green-400 font-bold font-mono">{formatCurrency(balance)}</span>
      </div>

      <p className="text-white/30 text-xs">
        * Saldo komisi dapat dicairkan manual melalui admin. Hubungi admin untuk proses pencairan.
      </p>
    </div>
  );
}
