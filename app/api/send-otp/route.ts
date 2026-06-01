import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Rate limit per IP (in-memory ok, just for spam protection)
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string) {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || now > e.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 3) return false;
  e.count++;
  return true;
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Tunggu 1 menit.' }, { status: 429 });
  }

  const { email } = await req.json();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 });
  }

  const key = email.toLowerCase();
  const now = Date.now();

  // Cek cooldown di Firestore
  const adminDb = getAdminDb();
  const otpRef  = adminDb.doc(`otps/${key.replace(/[.@]/g, '_')}`);

  try {
    const existing = await otpRef.get();
    if (existing.exists) {
      const data = existing.data()!;
      if (data.cooldownUntil > now) {
        const secs = Math.ceil((data.cooldownUntil - now) / 1000);
        return NextResponse.json({ error: `Tunggu ${secs} detik sebelum kirim ulang.` }, { status: 429 });
      }
    }

    const code = generateOTP();

    // Simpan OTP ke Firestore
    await otpRef.set({
      code,
      expiry:        now + 5 * 60 * 1000,
      cooldownUntil: now + 60 * 1000,
      createdAt:     FieldValue.serverTimestamp(),
    });

    // Kirim email
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from:    `"KAMIL-SHOP" <${process.env.SMTP_USER}>`,
      to:      email,
      subject: '🔐 Kode OTP Login KAMIL-SHOP',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0A0F1E;color:white;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2563EB,#1D4ED8);padding:28px;text-align:center;">
            <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:2px;">KAMIL-SHOP</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#F59E0B;margin-top:0;">🔐 Kode OTP Anda</h2>
            <p style="color:rgba(255,255,255,0.7);">Gunakan kode berikut untuk login ke KAMIL-SHOP:</p>
            <div style="background:rgba(37,99,235,0.15);border:2px solid rgba(37,99,235,0.4);border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
              <span style="font-size:40px;font-weight:bold;letter-spacing:14px;color:#F59E0B;">${code}</span>
            </div>
            <p style="color:rgba(255,255,255,0.4);font-size:13px;">⏱ Berlaku 5 menit.<br>❌ Jangan bagikan kode ini ke siapapun!</p>
          </div>
          <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;color:rgba(255,255,255,0.3);font-size:12px;">
            © ${new Date().getFullYear()} KAMIL-SHOP
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Gagal mengirim email. Coba lagi.' }, { status: 500 });
  }
}
