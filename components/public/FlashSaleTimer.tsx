'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface Props {
  endTime: string;
  salePrice: number;
  normalPrice: number;
  onExpire?: () => void;
}

export default function FlashSaleTimer({ endTime, salePrice, normalPrice, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, expired: true });
        onExpire?.();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s, expired: false });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endTime]);

  if (timeLeft.expired) return null;

  const discount = Math.round(((normalPrice - salePrice) / normalPrice) * 100);

  return (
    <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={18} className="text-gold-400 fill-gold-400" />
        <span className="text-gold-400 font-bold text-sm">FLASH SALE</span>
        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
          -{discount}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-xs">Berakhir dalam:</span>
        <div className="flex gap-1.5">
          {[
            { val: timeLeft.h, label: 'Jam' },
            { val: timeLeft.m, label: 'Mnt' },
            { val: timeLeft.s, label: 'Dtk' },
          ].map(({ val, label }, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="bg-black/40 rounded-lg px-2.5 py-1 font-mono font-bold text-white text-lg min-w-[40px] text-center">
                {String(val).padStart(2, '0')}
              </div>
              <span className="text-white/30 text-[10px] mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
