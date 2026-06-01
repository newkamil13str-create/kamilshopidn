import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { depositId } = await req.json();
    if (!depositId) {
      return NextResponse.json({ error: 'depositId diperlukan' }, { status: 400 });
    }

    const adminDb    = getAdminDb();
    const depositRef = adminDb.doc(`deposits/${depositId}`);
    const depositDoc = await depositRef.get();

    if (!depositDoc.exists) {
      return NextResponse.json({ error: 'Deposit tidak ditemukan' }, { status: 404 });
    }

    const deposit = depositDoc.data()!;

    if (deposit.status !== 'pending') {
      return NextResponse.json(
        { error: `Deposit tidak bisa dicancel, status saat ini: ${deposit.status}` },
        { status: 400 }
      );
    }

    await depositRef.update({
      status:      'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Deposit Cancel Error]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
