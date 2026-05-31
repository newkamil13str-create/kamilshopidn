import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { code, amount } = await req.json();
    if (!code) return NextResponse.json({ error: 'Kode tidak boleh kosong' }, { status: 400 });

    const adminDb = getAdminDb();
    const snap = await adminDb
      .collection('promo_codes')
      .where('code', '==', String(code).toUpperCase().trim())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Kode promo tidak valid atau sudah tidak aktif' }, { status: 404 });
    }

    const promo = snap.docs[0].data();
    const now = new Date().toISOString();

    // Cek expired
    if (promo.expiredAt && promo.expiredAt < now) {
      return NextResponse.json({ error: 'Kode promo sudah kadaluarsa' }, { status: 400 });
    }

    // Cek max uses
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ error: 'Kode promo sudah habis digunakan' }, { status: 400 });
    }

    // Cek min order
    if (promo.minOrder && amount < promo.minOrder) {
      return NextResponse.json({
        error: `Minimum order Rp ${promo.minOrder.toLocaleString('id-ID')} untuk kode ini`,
      }, { status: 400 });
    }

    // Hitung diskon
    let discount = 0;
    if (promo.type === 'percent') {
      discount = Math.floor((amount * promo.value) / 100);
    } else {
      discount = promo.value;
    }

    return NextResponse.json({
      success: true,
      promoId: snap.docs[0].id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discount,
      finalAmount: Math.max(0, amount - discount),
    });
  } catch (err) {
    console.error('[validate-promo]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
