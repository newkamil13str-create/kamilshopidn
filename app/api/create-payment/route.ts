import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string) {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || now > e.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 10) return false;
  e.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { method, amount, orderId, productId, customerData, productName, userId, promoCode, promoId, discount, referralCode } = body;

    if (!method || !amount || !orderId || !productId || !customerData) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Ambil Pakasir config
    const adminDb = getAdminDb();
    let pakasirSlug   = process.env.PAKASIR_SLUG   || '';
    let pakasirApiKey = process.env.PAKASIR_API_KEY || '';

    try {
      const settingsDoc = await adminDb.doc('settings/site').get();
      if (settingsDoc.exists) {
        const s = settingsDoc.data();
        if (s?.pakasirSlug)   pakasirSlug   = s.pakasirSlug;
        if (s?.pakasirApiKey) pakasirApiKey = s.pakasirApiKey;
      }
    } catch {}

    if (!pakasirSlug || !pakasirApiKey) {
      return NextResponse.json({ error: 'Konfigurasi pembayaran belum diatur' }, { status: 500 });
    }

    // Panggil Pakasir API dengan timeout 15 detik
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 15000);

    let pakasirData: Record<string, unknown>;
    try {
      const pakasirRes = await fetch(
        `https://app.pakasir.com/api/transactioncreate/${method}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            project:  pakasirSlug,
            order_id: orderId,
            amount:   Number(amount),
            api_key:  pakasirApiKey,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      pakasirData = await pakasirRes.json();

      if (!pakasirRes.ok || !pakasirData.payment) {
        console.error('[Pakasir Error]', pakasirData);
        return NextResponse.json(
          { error: (pakasirData as Record<string, unknown>).message as string || 'Gagal menghubungi payment gateway' },
          { status: 502 }
        );
      }
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('[Pakasir Fetch Error]', msg);
      return NextResponse.json(
        { error: `Gagal menghubungi payment gateway: ${msg}` },
        { status: 502 }
      );
    }

    const payment = (pakasirData as Record<string, unknown>).payment as Record<string, unknown>;

    // Simpan order ke Firestore
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook`;
    await adminDb.doc(`orders/${orderId}`).set({
      orderId,
      userId:          userId || null,
      productId,
      productName:     productName || '',
      customerName:    customerData.name,
      customerEmail:   customerData.email,
      customerWhatsApp: customerData.whatsApp || '',
      amount:          Number(amount),
      fee:             payment.fee             || 0,
      totalPayment:    payment.total_payment   || Number(amount),
      paymentMethod:   method,
      paymentNumber:   payment.payment_number  || '',
      expiredAt:       payment.expired_at      || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      webhookUrl,
      status:          'pending',
      deliveryContent: null,
      promoCode:       promoCode   || null,
      promoId:         promoId     || null,
      discount:        Number(discount) || 0,
      affiliateCode:   referralCode || null,
      createdAt:       FieldValue.serverTimestamp(),
      paidAt:          null,
    });

    // Increment totalOrders user
    if (userId) {
      try {
        await adminDb.doc(`users/${userId}`).update({ totalOrders: FieldValue.increment(1) });
      } catch {}
    }

    // Increment promo usedCount
    if (promoId) {
      try {
        await adminDb.doc(`promo_codes/${promoId}`).update({ usedCount: FieldValue.increment(1) });
      } catch {}
    }

    return NextResponse.json({ success: true, payment, orderId });
  } catch (error) {
    console.error('[create-payment]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
