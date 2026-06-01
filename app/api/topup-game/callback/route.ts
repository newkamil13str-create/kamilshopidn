/**
 * app/api/topup-game/callback/route.ts
 *
 * Endpoint callback dari server Qiospay.
 * Qiospay mengirim notifikasi ke URL ini setelah transaksi berhasil/gagal.
 *
 * Format callback Qiospay (method GET/POST):
 *  - refID   : referensi transaksi dari sistem kita (= orderId)
 *  - status  : SUCCESS | FAILED | PENDING
 *  - message : pesan dari Qiospay
 *  - product : kode produk
 *  - dest    : tujuan transaksi
 *  - saldo   : sisa saldo (opsional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

// Qiospay bisa kirim callback via GET maupun POST
export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}

async function handleCallback(req: NextRequest) {
  try {
    let refID: string | null = null;
    let status: string | null = null;
    let message: string | null = null;
    let saldo: string | null = null;

    // Parse parameter dari query string (GET) atau body (POST)
    const url = req.nextUrl;
    if (url.searchParams.get('refID')) {
      refID  = url.searchParams.get('refID');
      status = url.searchParams.get('status');
      message = url.searchParams.get('message');
      saldo  = url.searchParams.get('saldo');
    } else {
      // Try parsing POST body
      try {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await req.json();
          refID   = body.refID   || body.ref_id   || body.orderId;
          status  = body.status;
          message = body.message || body.keterangan;
          saldo   = body.saldo;
        } else {
          const text = await req.text();
          const params = new URLSearchParams(text);
          refID   = params.get('refID')   || params.get('ref_id');
          status  = params.get('status');
          message = params.get('message') || params.get('keterangan');
          saldo   = params.get('saldo');
        }
      } catch {
        // Jika body parsing gagal, cek apakah ada di query string raw
        const rawBody = url.searchParams.toString();
        const params  = new URLSearchParams(rawBody);
        refID   = params.get('refID');
        status  = params.get('status');
        message = params.get('message');
      }
    }

    // Log semua callback untuk debugging
    console.log('[Qiospay Callback]', { refID, status, message, saldo });

    if (!refID) {
      return NextResponse.json({ error: 'refID tidak ditemukan' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const orderRef = adminDb.doc(`orders/${refID}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.warn(`[Qiospay Callback] Order tidak ditemukan: ${refID}`);
      // Return 200 agar Qiospay tidak retry terus-menerus
      return NextResponse.json({ ok: true });
    }

    const order = orderDoc.data()!;
    const upperStatus = (status || '').toUpperCase();

    // Simpan raw callback ke Firestore untuk audit
    await orderRef.update({
      topupCallbackRaw: JSON.stringify({ refID, status, message, saldo }),
      topupCallbackAt: FieldValue.serverTimestamp(),
    });

    if (upperStatus === 'SUCCESS' || upperStatus === 'SUKSES' || upperStatus === 'BERHASIL') {
      // Topup berhasil → mark delivered
      const deliveryContent = buildDeliveryContent(order, message);

      await orderRef.update({
        status: 'delivered',
        topupStatus: 'success',
        topupNote: message || 'Topup berhasil',
        deliveryContent,
        paidAt: order.paidAt || FieldValue.serverTimestamp(),
      });

      // Update totalSold pada produk
      if (order.productId) {
        await adminDb.doc(`products/${order.productId}`).update({
          totalSold: FieldValue.increment(1),
        }).catch(() => {});
      }

      // Kirim email notifikasi
      sendTopupSuccessEmail(order, deliveryContent).catch(console.error);

      console.log(`[Qiospay Callback] Order ${refID} → DELIVERED`);

    } else if (upperStatus === 'FAILED' || upperStatus === 'GAGAL' || upperStatus === 'ERROR') {
      // Topup gagal
      await orderRef.update({
        status: 'topup_failed',
        topupStatus: 'failed',
        topupNote: message || 'Topup gagal',
        topupFailedAt: FieldValue.serverTimestamp(),
      });

      // Notifikasi admin
      await adminDb.collection('notifications').add({
        type: 'topup_failed_callback',
        orderId: refID,
        message: message || 'Topup gagal',
        gameName: order.gameName || order.productName,
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(`[Qiospay Callback] Order ${refID} → FAILED: ${message}`);

    } else {
      // Status lain (PENDING, dll) → simpan saja
      await orderRef.update({
        topupStatus: upperStatus.toLowerCase() || 'pending',
        topupNote: message || '',
      });
    }

    // Qiospay membutuhkan respons 200 OK
    return NextResponse.json({ ok: true, received: true });
  } catch (err) {
    console.error('[Qiospay Callback] Error:', err);
    return NextResponse.json({ ok: true }); // tetap 200 agar tidak retry
  }
}

function buildDeliveryContent(
  order: FirebaseFirestore.DocumentData,
  message: string | null
): string {
  const lines = [
    `✅ Top Up Berhasil!`,
    ``,
    `🎮 Game     : ${order.gameName || order.productName}`,
    `📦 Produk   : ${order.productName}`,
    `🎯 Tujuan   : ${order.gameDestination}${order.gameZoneId ? ` (Zone: ${order.gameZoneId})` : ''}`,
    `📋 Order ID : ${order.orderId}`,
  ];

  if (message) {
    lines.push(``, `📝 Info: ${message}`);
  }

  lines.push(``, `Terima kasih telah berbelanja! 🙏`);
  return lines.join('\n');
}

async function sendTopupSuccessEmail(
  order: FirebaseFirestore.DocumentData,
  deliveryContent: string
) {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'KAMIL-SHOP';

  await transporter.sendMail({
    from: `"${siteName}" <${process.env.SMTP_USER || 'admin@kamilshop.my.id'}>`,
    to: order.customerEmail,
    subject: `✅ Top Up Berhasil — ${order.productName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0F1E; color: white; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7C3AED, #4F46E5); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">${siteName}</h1>
          <p style="margin: 8px 0 0; opacity: 0.8;">Top Up Game Instan & Terpercaya</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #34D399; margin-top: 0;">✅ Top Up Berhasil!</h2>
          <p>Halo <strong>${order.customerName}</strong>,</p>
          <p>Top up kamu sudah berhasil diproses. Detail transaksi:</p>
          <div style="background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.4); border-radius: 12px; padding: 20px; margin: 24px 0;">
            <table style="width:100%; border-collapse:collapse;">
              <tr><td style="color:#A78BFA; padding: 6px 0;">🎮 Game</td><td style="padding: 6px 0;">${order.gameName || order.productName}</td></tr>
              <tr><td style="color:#A78BFA; padding: 6px 0;">📦 Produk</td><td style="padding: 6px 0;">${order.productName}</td></tr>
              <tr><td style="color:#A78BFA; padding: 6px 0;">🎯 Tujuan</td><td style="padding: 6px 0;">${order.gameDestination}${order.gameZoneId ? ` (Zone: ${order.gameZoneId})` : ''}</td></tr>
              <tr><td style="color:#A78BFA; padding: 6px 0;">📋 Order ID</td><td style="padding: 6px 0;">${order.orderId}</td></tr>
            </table>
          </div>
          <p style="color: rgba(255,255,255,0.5); font-size: 13px;">Jika ada pertanyaan, hubungi admin kami.</p>
        </div>
        <div style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; color: rgba(255,255,255,0.3); font-size: 12px;">
          © ${new Date().getFullYear()} ${siteName}. Semua hak dilindungi.
        </div>
      </div>
    `,
  });
}
