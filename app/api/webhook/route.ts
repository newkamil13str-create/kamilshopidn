import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import { notifyAdminNewOrder } from '@/app/api/telegram/route';

/**
 * Webhook Pakasir
 * URL: https://kamilshop.my.id/api/webhook
 * Daftarkan URL ini di dashboard Pakasir → Settings → Webhook
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Webhook] Received:', JSON.stringify(body));

    // Pakasir mengirim: order_id, status, payment_method, amount
    const orderId = body.order_id || body.orderId;
    const status  = body.status;

    if (!orderId) {
      return NextResponse.json({ error: 'order_id diperlukan' }, { status: 400 });
    }

    const adminDb  = getAdminDb();
    const orderRef = adminDb.doc(`orders/${orderId}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.error('[Webhook] Order tidak ditemukan:', orderId);
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const order = orderDoc.data()!;

    // Sudah diproses sebelumnya
    if (order.status === 'delivered') {
      return NextResponse.json({ success: true, message: 'Already delivered' });
    }

    const isPaid = ['paid', 'success', 'settlement'].includes(String(status).toLowerCase());
    const isFailed = ['failed', 'expired', 'cancel'].includes(String(status).toLowerCase());

    if (isPaid) {
      // Update status jadi paid dulu
      await orderRef.update({
        status: 'paid',
        paidAt: FieldValue.serverTimestamp(),
      });

      // Proses delivery (ambil stok)
      await processDelivery(orderId, order, adminDb);

      // Notif admin via Telegram
      try {
        const finalOrder = (await orderRef.get()).data();
        await notifyAdminNewOrder({
          orderId,
          productName: order.productName,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          totalPayment: order.totalPayment || order.amount,
          paymentMethod: order.paymentMethod,
          deliveryContent: finalOrder?.deliveryContent,
        });
      } catch (tgErr) {
        console.error("[Telegram Notif Error]", tgErr);
      }

      // Proses komisi affiliate jika ada referral code
      if (order.affiliateCode) {
        await processAffiliateCommission(orderId, order, adminDb);
      }

    } else if (isFailed) {
      await orderRef.update({ status: 'failed' });
      console.log('[Webhook] Order failed:', orderId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET untuk verifikasi webhook dari Pakasir
export async function GET() {
  return NextResponse.json({ status: 'ok', webhook: 'kamilshop.my.id/api/webhook' });
}

async function processDelivery(
  orderId: string,
  order: FirebaseFirestore.DocumentData,
  adminDb: FirebaseFirestore.Firestore
) {
  const productRef = adminDb.doc(`products/${order.productId}`);
  const orderRef   = adminDb.doc(`orders/${orderId}`);

  try {
    await adminDb.runTransaction(async (tx) => {
      const productDoc = await tx.get(productRef);
      if (!productDoc.exists) return;

      const product = productDoc.data()!;
      const stock: string[] = product.stock || [];

      if (stock.length === 0) {
        tx.update(orderRef, {
          status:          'paid',
          deliveryContent: 'STOK_HABIS',
        });
        return;
      }

      const claimedItem  = stock[0];
      const remainingStock = stock.slice(1);

      tx.update(productRef, {
        stock:     remainingStock,
        totalSold: FieldValue.increment(1),
      });

      tx.update(orderRef, {
        status:          'delivered',
        deliveryContent: claimedItem,
        paidAt:          order.paidAt || FieldValue.serverTimestamp(),
      });
    });

    // Kirim email setelah transaksi selesai
    const updatedOrder = (await orderRef.get()).data();
    if (
      updatedOrder?.status === 'delivered' &&
      updatedOrder?.deliveryContent &&
      updatedOrder?.deliveryContent !== 'STOK_HABIS'
    ) {
      await sendDeliveryEmail(
        order.customerEmail,
        order.customerName,
        order.productName,
        updatedOrder.deliveryContent,
        orderId,
        updatedOrder?.contentType || order.contentType || 'text'
      );
    } else if (updatedOrder?.deliveryContent === 'STOK_HABIS') {
      // Notif admin stok habis
      await sendAdminNotif(order.productName, orderId, order.customerEmail);
    }
  } catch (err) {
    console.error('[processDelivery]', err);
  }
}

async function sendDeliveryEmail(
  email: string,
  name: string,
  productName: string,
  deliveryContent: string,
  orderId: string,
  contentType: string = 'text'
) {
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const isLink = contentType === 'link' || deliveryContent.startsWith('http');

    const contentHtml = isLink
      ? `<div style="text-align:center;">
           <a href="${deliveryContent}" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;">⬇️ Download / Akses Sekarang</a>
           <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:8px;">Atau copy link: <a href="${deliveryContent}" style="color:#60A5FA;">${deliveryContent}</a></p>
         </div>`
      : `<pre style="background:rgba(0,0,0,.3);padding:16px;border-radius:8px;color:#F59E0B;overflow:auto;word-break:break-all;white-space:pre-wrap;">${deliveryContent}</pre>`;
    await transporter.sendMail({
      from:    `"KAMIL-SHOP" <${process.env.SMTP_USER}>`,
      to:      email,
      subject: `✅ Produk Kamu Sudah Dikirim — ${productName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;color:white;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2563EB,#1D4ED8);padding:32px;text-align:center;">
            <h1 style="margin:0;font-size:28px;font-weight:800;">KAMIL-SHOP</h1>
            <p style="margin:8px 0 0;opacity:.8;font-size:14px;">Solusi Digital Terpercaya</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#F59E0B;margin-top:0;">✅ Pembayaran Berhasil!</h2>
            <p>Halo <strong>${name}</strong>,</p>
            <p>Terima kasih sudah belanja di KAMIL-SHOP. Berikut detail produk kamu:</p>
            <p style="color:rgba(255,255,255,.5);font-size:13px;"><strong>Order ID:</strong> ${orderId}</p>
            <div style="background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);border-radius:12px;padding:20px;margin:24px 0;">
              <h3 style="margin-top:0;color:#60A5FA;">${productName}</h3>
              ${contentHtml}
            </div>
            <p style="color:rgba(255,255,255,.4);font-size:13px;">
              Simpan email ini baik-baik. Ada pertanyaan? Hubungi kami di
              <a href="mailto:${process.env.SMTP_USER}" style="color:#60A5FA;">${process.env.SMTP_USER}</a>
            </p>
          </div>
          <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,.1);text-align:center;color:rgba(255,255,255,.3);font-size:12px;">
            © ${new Date().getFullYear()} KAMIL-SHOP
          </div>
        </div>
      `,
    });
    console.log('[Email] Delivery email sent to', email);
  } catch (err) {
    console.error('[Email Error]', err);
  }
}

async function sendAdminNotif(productName: string, orderId: string, customerEmail: string) {
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from:    `"KAMIL-SHOP System" <${process.env.SMTP_USER}>`,
      to:      process.env.SMTP_USER,
      subject: `⚠️ STOK HABIS — ${productName}`,
      html: `
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Produk:</strong> ${productName}</p>
        <p><strong>Customer:</strong> ${customerEmail}</p>
        <p>Stok habis! Segera tambah stok dan kirim produk manual ke customer.</p>
      `,
    });
  } catch {}
}

async function processAffiliateCommission(
  orderId: string,
  order: FirebaseFirestore.DocumentData,
  adminDb: FirebaseFirestore.Firestore
) {
  try {
    // Cari user pemilik kode referral
    const usersSnap = await adminDb
      .collection('users')
      .where('referralCode', '==', order.affiliateCode)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      console.log('[Affiliate] Referral code not found:', order.affiliateCode);
      return;
    }

    const affiliateUser = usersSnap.docs[0];
    const affiliateUserId = affiliateUser.id;

    // Jangan kasih komisi ke diri sendiri
    if (affiliateUserId === order.userId) return;

    // Ambil % komisi dari settings (default 10%)
    let commissionPercent = 10;
    try {
      const settingsDoc = await adminDb.doc('settings/site').get();
      if (settingsDoc.exists) {
        const s = settingsDoc.data();
        if (s?.affiliateCommissionPercent) commissionPercent = Number(s.affiliateCommissionPercent);
      }
    } catch {}

    const commission = Math.floor((order.amount * commissionPercent) / 100);
    if (commission <= 0) return;

    // Tulis transaksi affiliate
    await adminDb.collection('affiliate_transactions').add({
      affiliateUserId,
      referredUserId: order.userId || null,
      orderId,
      commission,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Tambah saldo ke affiliator
    await adminDb.doc(`users/${affiliateUserId}`).update({
      affiliateBalance: FieldValue.increment(commission),
    });

    console.log(`[Affiliate] Komisi Rp${commission} → user ${affiliateUserId}`);
  } catch (err) {
    console.error('[processAffiliateCommission]', err);
  }
}
