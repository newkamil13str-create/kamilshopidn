'use client';

import { useState } from 'react';
import { Tag, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';

interface PromoResult {
  code: string;
  discount: number;
  finalAmount: number;
  type: string;
  value: number;
}

interface Props {
  amount: number;
  onApply: (result: PromoResult | null) => void;
}

export default function PromoInput({ amount, onApply }: Props) {
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [applied, setApplied]   = useState<PromoResult | null>(null);

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/validate-promo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.trim(), amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApplied(data);
      onApply(data);
      toast.success(`Promo berhasil! Hemat ${formatCurrency(data.discount)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Kode tidak valid');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setApplied(null);
    setCode('');
    onApply(null);
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-green-400" />
          <div>
            <p className="text-green-400 font-mono font-bold text-sm">{applied.code}</p>
            <p className="text-green-300/70 text-xs">Hemat {formatCurrency(applied.discount)}</p>
          </div>
        </div>
        <button onClick={handleRemove} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-red-400">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          placeholder="Kode promo (opsional)"
          className="input-dark w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-mono uppercase"
        />
      </div>
      <button
        onClick={handleApply}
        disabled={loading || !code.trim()}
        className="px-4 py-2.5 rounded-xl bg-electric-gradient text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? '...' : 'Pakai'}
      </button>
    </div>
  );
}
