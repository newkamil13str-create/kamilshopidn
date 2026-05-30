import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Shared OTP store — same in-memory map
// NOTE: Vercel serverless functions may run in different instances,
// so we use a signed token approach for reliability
// For simplicity on single-instance or dev, we use the same map pattern
// In production, consider using Redis or Firestore for OTP storage

const otpStore = new Map<string, { code: string; expiry: number }>();

// This endpoint also receives the store populated by send-otp
// Since both run in same Next.js server process (not edge), this works on Railway/Render
// On Vercel: store OTP in Firestore instead (see below)

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: 'Email dan kode wajib diisi.' }, { status: 400 });
  }

  const key = email.toLowerCase();

  // ─── Verifikasi via Firestore (Vercel-safe) ───────────────────────────────
  const adminDb = getAdminDb();

  try {
    const otpRef = adminDb.doc(`otps/${key.replace(/[.@]/g, '_')}`);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json({ error: 'OTP tidak ditemukan. Minta kode baru.' }, { status: 400 });
    }

    const data = otpDoc.data()!;

    if (Date.now() > data.expiry) {
      await otpRef.delete();
      return NextResponse.json({ error: 'OTP sudah kadaluarsa. Minta kode baru.' }, { status: 400 });
    }

    if (data.code !== String(code).trim()) {
      return NextResponse.json({ error: 'Kode OTP salah.' }, { status: 400 });
    }

    // Hapus OTP setelah berhasil
    await otpRef.delete();

    // ─── Cari/buat user ───────────────────────────────────────────────────
    const usersRef = adminDb.collection('users');
    const snap     = await usersRef.where('email', '==', key).limit(1).get();

    let userId: string;
    let userRole = 'user';
    let displayName: string;

    if (snap.empty) {
      const newRef = usersRef.doc();
      userId      = newRef.id;
      displayName = key.split('@')[0];
      await newRef.set({
        displayName,
        email:       key,
        phone:       '',
        role:        'user',
        totalOrders: 0,
        createdAt:   FieldValue.serverTimestamp(),
      });
    } else {
      const doc   = snap.docs[0];
      userId      = doc.id;
      userRole    = doc.data().role || 'user';
      displayName = doc.data().displayName || key.split('@')[0];
    }

    const response = NextResponse.json({
      success: true,
      user: { id: userId, displayName, email: key, role: userRole },
    });

    response.cookies.set('session', userId,   { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('role',    userRole, { path: '/', maxAge: 86400, sameSite: 'lax' });

    return response;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
