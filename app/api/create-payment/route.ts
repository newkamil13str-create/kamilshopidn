/**
 * app/api/create-payment/route.ts (UPDATED)
 *
 * Perubahan dari versi asli:
 * - Menerima field tambahan: productType, gameName, qiospayProduct,
 *   gameDestination, gameZoneId
 * - Menyimpan field-field tersebut ke Firestore orders
 */

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
    const {
      method, amount, orderId, productId, customerData, productName,
      userId, promoCode, promoId, discount, referralCode,
      // ─── Field baru untuk topup-game ───
      productType,
      gameName,
      qiospayProduct,
      gameDestination,
      gameZoneId,
    } = body;

    if (!method || !amount || !orderId || !productId || !customerData) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Validasi tambahan untuk topup-game
    if (productType === 'topup-game') {
      if (!qiospayProduct) {
        return NextResponse.json({ error: 'Kode produk Qiospay tidak ditemukan' }, { status: 400 });
      }
      if (!gameDestination) {
        return NextResponse.json({ error: 'User ID game belum diisi' }, { status: 400 });
      }
    }

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
        return NextResponse.json(
          { error: (pakasirData as Record<string, unknown>).message as string || 'Gagal menghubungi payment gateway' },
          { status: 502 }
        );
      }
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      return NextResponse.json(
        { error: `Gagal menghubungi payment gateway: ${msg}` },
        { status: 502 }
      );
    }

    const payment = (pakasirData as Record<string, unknown>).payment as Record<string, unknown>;

    // ─── Simpan order ke Firestore ─────────────────────────────────────────────
    const orderData: Record<string, unknown> = {
      orderId,
      userId:           userId || null,
      productId,
      productName:      productName || '',
      customerName:     customerData.name,
      customerEmail:    customerData.email,
      customerWhatsApp: customerData.whatsApp || '',
      amount:           Number(amount),
      fee:              payment.fee             || 0,
      totalPayment:     payment.total_payment   || Number(amount),
      paymentMethod:    method,
      paymentNumber:    payment.payment_number  || '',
      expiredAt:        payment.expired_at      || '',
      status:           'pending',
      promoCode:        promoCode || null,
      promoId:          promoId   || null,
      discount:         discount  || 0,
      referralCode:     referralCode || null,
      createdAt:        FieldValue.serverTimestamp(),
    };

    // Tambahkan field topup-game jika ada
    if (productType === 'topup-game') {
      orderData.productType      = 'topup-game';
      orderData.gameName         = gameName         || productName;
      orderData.qiospayProduct   = qiospayProduct;
      orderData.gameDestination  = gameDestination;
      orderData.gameZoneId       = gameZoneId       || null;
      orderData.topupSent        = false;
      orderData.topupStatus      = 'waiting_payment';
    } else {
      orderData.productType = 'stock';
    }

    await adminDb.doc(`orders/${orderId}`).set(orderData);

    return NextResponse.json({
      success: true,
      payment: {
        order_id:       orderId,
        payment_number: payment.payment_number,
        amount:         Number(amount),
        fee:            payment.fee || 0,
        total_payment:  payment.total_payment,
        expired_at:     payment.expired_at,
        method,
        status:         'pending',
      },
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
