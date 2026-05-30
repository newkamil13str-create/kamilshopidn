import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { type, page, time, ua } = await req.json();

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const adminDb = getAdminDb();

    await adminDb.collection('copy_attempts').add({
      type,
      page,
      time,
      ip,
      ua: ua?.substring(0, 200) || '',
      blacklisted: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[log-copy-attempt]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
