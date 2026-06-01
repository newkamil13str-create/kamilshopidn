import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Webhook Pakasir untuk Deposit
 * URL: https://kamilshop.my.id/api/deposit/webhook
 * Daftarkan di dashboard Pakasir untuk transaksi deposit.
 *
 * Atau bisa juga diarahkan dari webhook utama (/api/webhook)
 * dengan mendeteksi depositId yang diawali "DEP-".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Deposit Webhook] Received:', JSON.stringify(body));

    const depositId = body.order_id || body.orderId || body.depositId;
    const status    = body.status;

    if (!depositId) {
      return NextResponse.json({ error: 'order_id diperlukan' }, { status: 400 });
    }

    const adminDb    = getAdminDb();
    const depositRef = adminDb.doc(`deposits/${depositId}`);
    const depositDoc = await depositRef.get();

    if (!depositDoc.exists) {
      console.error('[Deposit Webhook] Deposit tidak ditemukan:', depositId);
      return NextResponse.json({ error: 'Deposit tidak ditemukan' }, { status: 404 });
    }

    const deposit = depositDoc.data()!;

    if (deposit.status === 'paid') {
      return NextResponse.json({ success: true, message: 'Already paid' });
    }

    const isPaid      = ['paid', 'success', 'settlement'].includes(String(status).toLowerCase());
    const isCancelled = ['cancel', 'cancelled'].includes(String(status).toLowerCase());
    const isFailed    = ['failed', 'expired'].includes(String(status).toLowerCase());

    if (isPaid) {
      // Gunakan transaksi Firestore agar kredit saldo atomik
      await adminDb.runTransaction(async (tx) => {
        const userRef = adminDb.doc(`users/${deposit.userId}`);
        const userDoc = await tx.get(userRef);

        if (!userDoc.exists) {
          throw new Error(`User ${deposit.userId} tidak ditemukan`);
        }

        // Update status deposit
        tx.update(depositRef, {
          status: 'paid',
          paidAt: FieldValue.serverTimestamp(),
        });

        // Kredit saldo user
        tx.update(userRef, {
          balance: FieldValue.increment(deposit.amount),
        });
      });

      console.log(`[Deposit Webhook] Deposit ${depositId} paid — kredit Rp${deposit.amount} ke user ${deposit.userId}`);

    } else if (isCancelled) {
      await depositRef.update({
        status:      'cancelled',
        cancelledAt: FieldValue.serverTimestamp(),
      });
      console.log('[Deposit Webhook] Deposit cancelled:', depositId);

    } else if (isFailed) {
      await depositRef.update({ status: 'failed' });
      console.log('[Deposit Webhook] Deposit failed:', depositId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Deposit Webhook Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', webhook: 'kamilshop.my.id/api/deposit/webhook' });
}
