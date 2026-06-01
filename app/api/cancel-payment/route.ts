import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId diperlukan' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const orderRef = adminDb.doc(`orders/${orderId}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const order = orderDoc.data()!;

    // Hanya bisa cancel kalau masih pending
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `Order tidak bisa dicancel, status saat ini: ${order.status}` },
        { status: 400 }
      );
    }

    await orderRef.update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: 'Order berhasil dicancel' });
  } catch (error) {
    console.error('[Cancel Payment Error]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
