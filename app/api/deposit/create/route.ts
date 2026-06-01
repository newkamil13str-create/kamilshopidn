import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

function generateDepositId(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `DEP-${ts}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, amount, userId, customerName, customerEmail } = body;

    if (!method || !amount || !userId || !customerName || !customerEmail) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 10000) {
      return NextResponse.json({ error: 'Minimal deposit Rp 10.000' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // Ambil Pakasir config
    let pakasirSlug   = process.env.PAKASIR_SLUG   || '';
    let pakasirApiKey = process.env.PAKASIR_API_KEY || '';
    let minDeposit    = 10000;
    let maxDeposit    = 10000000;

    try {
      const settingsDoc = await adminDb.doc('settings/site').get();
      if (settingsDoc.exists) {
        const s = settingsDoc.data();
        if (s?.pakasirSlug)   pakasirSlug   = s.pakasirSlug;
        if (s?.pakasirApiKey) pakasirApiKey = s.pakasirApiKey;
        if (s?.depositMin)    minDeposit    = Number(s.depositMin);
        if (s?.depositMax)    maxDeposit    = Number(s.depositMax);
      }
    } catch {}

    if (!pakasirSlug || !pakasirApiKey) {
      return NextResponse.json({ error: 'Konfigurasi pembayaran belum diatur' }, { status: 500 });
    }

    if (numAmount < minDeposit) {
      return NextResponse.json({ error: `Minimal deposit ${numAmount < minDeposit ? `Rp ${minDeposit.toLocaleString('id-ID')}` : ''}` }, { status: 400 });
    }
    if (numAmount > maxDeposit) {
      return NextResponse.json({ error: `Maksimal deposit Rp ${maxDeposit.toLocaleString('id-ID')}` }, { status: 400 });
    }

    const depositId = generateDepositId();

    // Panggil Pakasir
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 15000);

    let pakasirData: Record<string, unknown>;
    try {
      const res = await fetch(
        `https://app.pakasir.com/api/transactioncreate/${method}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project:  pakasirSlug,
            order_id: depositId,
            amount:   numAmount,
            api_key:  pakasirApiKey,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      pakasirData = await res.json();

      if (!res.ok || !pakasirData.payment) {
        console.error('[Deposit Pakasir Error]', pakasirData);
        return NextResponse.json(
          { error: (pakasirData.message as string) || 'Gagal menghubungi payment gateway' },
          { status: 502 }
        );
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Gagal menghubungi payment gateway: ${msg}` }, { status: 502 });
    }

    const payment = pakasirData.payment as Record<string, unknown>;

    // Simpan deposit ke Firestore
    await adminDb.doc(`deposits/${depositId}`).set({
      depositId,
      userId,
      customerName,
      customerEmail,
      amount:        numAmount,
      fee:           payment.fee           || 0,
      totalPayment:  payment.total_payment || numAmount,
      paymentMethod: method,
      paymentNumber: payment.payment_number || '',
      expiredAt:     payment.expired_at    || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status:        'pending',
      createdAt:     FieldValue.serverTimestamp(),
      paidAt:        null,
    });

    return NextResponse.json({ success: true, payment, depositId });
  } catch (error) {
    console.error('[deposit/create]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
