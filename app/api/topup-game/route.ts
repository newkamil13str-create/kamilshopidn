/**
 * app/api/topup-game/route.ts
 *
 * Endpoint untuk memproses top up game via Qiospay H2H.
 * Dipanggil oleh check-payment/route.ts ketika order.productType === 'topup-game'
 * dan status payment sudah 'paid'.
 *
 * Flow:
 *  1. Payment gateway (Pakasir) → webhook → check-payment/route.ts
 *  2. check-payment deteksi productType === 'topup-game'
 *  3. Panggil POST /api/topup-game dengan orderId
 *  4. Route ini kirim transaksi ke Qiospay H2H
 *  5. Qiospay kirim callback ke /api/topup-game/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  sendTopupTransaction,
  getQiospayConfig,
  validateQiospayConfig,
} from '@/lib/qiospay';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId diperlukan' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const orderDoc = await adminDb.doc(`orders/${orderId}`).get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const order = orderDoc.data()!;

    // Validasi order sudah paid dan belum diproses
    if (order.status !== 'paid') {
      return NextResponse.json(
        { error: `Status order tidak valid: ${order.status}` },
        { status: 400 }
      );
    }

    if (order.topupSent) {
      return NextResponse.json({ success: true, message: 'Topup sudah dikirim sebelumnya' });
    }

    // Validasi data topup game ada
    const { qiospayProduct, gameDestination, gameZoneId } = order;
    if (!qiospayProduct || !gameDestination) {
      return NextResponse.json(
        { error: 'Data topup game tidak lengkap (qiospayProduct / gameDestination)' },
        { status: 400 }
      );
    }

    // Format destination: beberapa game butuh "userID(zoneID)"
    const dest = gameZoneId
      ? `${gameDestination}(${gameZoneId})`
      : gameDestination;

    // Validasi konfigurasi Qiospay
    const config = getQiospayConfig();
    const configError = validateQiospayConfig(config);
    if (configError) {
      console.error('[Qiospay] Config error:', configError);
      await adminDb.doc(`orders/${orderId}`).update({
        topupStatus: 'config_error',
        topupNote: configError,
      });
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    // Mark sebagai sudah dikirim untuk mencegah double-send (idempotency)
    await adminDb.doc(`orders/${orderId}`).update({ topupSent: true, topupSentAt: FieldValue.serverTimestamp() });

    // Kirim transaksi ke Qiospay
    const result = await sendTopupTransaction(config, {
      product: qiospayProduct,
      dest,
      refID: orderId,
      // Tambahkan harga_max sebagai proteksi harga (harga produk + toleransi 5%)
      hargaMax: order.amount ? Math.floor(order.amount * 1.05) : undefined,
    });

    console.log(`[Qiospay] Order ${orderId} result:`, result);

    // Simpan hasil ke Firestore
    await adminDb.doc(`orders/${orderId}`).update({
      topupStatus: result.status,
      topupRaw: result.raw,
      topupNote: result.message,
      topupUpdatedAt: FieldValue.serverTimestamp(),
    });

    if (result.status === 'processing' || result.status === 'success') {
      // Jika langsung sukses (jarang), update ke delivered
      if (result.status === 'success') {
        await adminDb.doc(`orders/${orderId}`).update({
          status: 'delivered',
          deliveryContent: `Top Up berhasil!\nProduk: ${order.productName}\nTujuan: ${dest}\nRef: ${orderId}`,
        });
      }
      // Jika masih processing → callback dari Qiospay yang akan update status
      return NextResponse.json({
        success: true,
        status: result.status,
        message: result.message,
      });
    }

    // Jika gagal → tandai dan beri notifikasi admin
    await adminDb.doc(`orders/${orderId}`).update({
      status: 'topup_failed',
      topupFailedAt: FieldValue.serverTimestamp(),
    });

    // Notifikasi admin via Firestore (bisa di-extend ke Telegram/email)
    await adminDb.collection('notifications').add({
      type: 'topup_failed',
      orderId,
      gameName: order.gameName || order.productName,
      product: qiospayProduct,
      dest,
      message: result.message,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: false,
      status: result.status,
      message: result.message,
    });
  } catch (err) {
    console.error('[Topup Game] Error:', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

/**
 * GET — Status cek topup (opsional, untuk admin)
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId diperlukan' }, { status: 400 });

  const adminDb = getAdminDb();
  const doc = await adminDb.doc(`orders/${orderId}`).get();
  if (!doc.exists) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });

  const data = doc.data()!;
  return NextResponse.json({
    status: data.status,
    topupStatus: data.topupStatus,
    topupNote: data.topupNote,
    topupRaw: data.topupRaw,
    deliveryContent: data.deliveryContent,
  });
}
