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
    const isCancelled = ['cancel', 'cancelled'].includes(String(status).toLowerCase());
    const isFailed = ['failed', 'expired'].includes(String(status).toLowerCase());

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

    } else if (isCancelled) {
      await orderRef.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
      console.log('[Webhook] Order cancelled:', orderId);
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
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const isLink = contentType === 'link' || deliveryContent.startsWith('http');

    // ── Parse akun: deteksi format KEY: VALUE per baris ──────────────────────
    const parseAccountLines = (raw: string): { key: string; value: string }[] => {
      return raw.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const idx = line.indexOf(':');
          if (idx > 0) {
            return { key: line.slice(0, idx).trim().toUpperCase(), value: line.slice(idx + 1).trim() };
          }
          return { key: '', value: line };
        });
    };

    const isAccount = !isLink && /LOGIN|EMAIL|PASS|USER|TOKEN|KEY|AKUN/i.test(deliveryContent);
    const parsedLines = isAccount ? parseAccountLines(deliveryContent) : [];

    // ── Build content HTML ────────────────────────────────────────────────────
    let contentHtml = '';

    if (isLink) {
      contentHtml = `
        <div style="text-align:center;margin:8px 0;">
          <a href="${deliveryContent}"
             style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#1D4ED8);
                    color:white;padding:16px 36px;border-radius:12px;text-decoration:none;
                    font-weight:700;font-size:16px;letter-spacing:.3px;
                    box-shadow:0 4px 20px rgba(59,130,246,.4);">
            ⬇️ Akses / Download Sekarang
          </a>
          <p style="margin:14px 0 0;font-size:12px;color:#64748B;">
            Atau salin link:<br>
            <a href="${deliveryContent}" style="color:#60A5FA;word-break:break-all;">${deliveryContent}</a>
          </p>
        </div>`;
    } else if (isAccount && parsedLines.length > 0) {
      // Tentukan field mana yang "sensitif" (perlu tombol copy)
      const sensitiveKeys = ['PASS', 'PASSWORD', 'TOKEN', 'KEY', 'SECRET', 'SANDI'];
      const rows = parsedLines.map(({ key, value }) => {
        const isSensitive = sensitiveKeys.some(k => key.includes(k));
        const copyBtn = `
          <a href="mailto:?body=${encodeURIComponent(value)}"
             onclick="navigator.clipboard&&navigator.clipboard.writeText('${value.replace(/'/g,"\\'")}');return false;"
             style="display:inline-block;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.4);
                    color:#93C5FD;padding:4px 12px;border-radius:6px;font-size:11px;text-decoration:none;
                    white-space:nowrap;cursor:pointer;">
            📋 Salin
          </a>`;
        return `
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);
                        vertical-align:middle;width:35%;">
              <span style="font-size:11px;font-weight:700;letter-spacing:1px;color:#64748B;
                            text-transform:uppercase;">${key || '—'}</span>
            </td>
            <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);
                        vertical-align:middle;">
              <code style="font-family:'Courier New',monospace;font-size:14px;
                            color:${isSensitive ? '#FCD34D' : '#E2E8F0'};
                            word-break:break-all;">${value}</code>
            </td>
            <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);
                        vertical-align:middle;white-space:nowrap;">
              ${copyBtn}
            </td>
          </tr>`;
      }).join('');

      contentHtml = `
        <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;
                      background:rgba(15,23,42,.6);border:1px solid rgba(59,130,246,.2);">
          ${rows}
        </table>
        <p style="margin:14px 0 0;font-size:11px;color:#475569;text-align:center;">
          🔒 Simpan informasi ini. Jangan bagikan kepada siapapun.
        </p>`;
    } else {
      // Plain text / fallback
      contentHtml = `
        <div style="background:rgba(15,23,42,.6);border:1px solid rgba(59,130,246,.2);
                    border-radius:12px;padding:20px;">
          <pre style="margin:0;color:#E2E8F0;font-family:'Courier New',monospace;
                      font-size:13px;white-space:pre-wrap;word-break:break-all;">${deliveryContent}</pre>
        </div>`;
    }

    const year = new Date().getFullYear();

    await transporter.sendMail({
      from:    `"KAMIL-SHOP" <${process.env.SMTP_USER}>`,
      to:      email,
      subject: `Pesanan Berhasil - ${productName} | KAMIL-SHOP`,
      headers: {
        'X-Priority':        '1',
        'X-MSMail-Priority': 'High',
        'Importance':        'high',
        'X-Mailer':          'KAMIL-SHOP Mailer',
        'Precedence':        'transactional',
        'Auto-Submitted':    'auto-generated',
      },
      html: `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Pesanan Berhasil - KAMIL-SHOP</title>
</head>
<body style="margin:0;padding:0;background:#060D1F;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060D1F;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#1E3A8A 0%,#1D4ED8 50%,#2563EB 100%);
                   border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
          <div style="display:inline-block;background:rgba(255,255,255,.1);
                      border-radius:50%;width:60px;height:60px;line-height:60px;
                      font-size:28px;margin-bottom:16px;">🛍️</div>
          <h1 style="margin:0;font-size:26px;font-weight:800;color:white;
                     letter-spacing:2px;text-transform:uppercase;">KAMIL-SHOP</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.6);font-size:13px;
                    letter-spacing:1px;">Solusi Digital Terpercaya #1</p>
        </td>
      </tr>

      <!-- STATUS BADGE -->
      <tr>
        <td style="background:#0F172A;padding:0 40px;">
          <div style="background:linear-gradient(135deg,rgba(16,185,129,.15),rgba(5,150,105,.1));
                      border:1px solid rgba(16,185,129,.3);border-radius:12px;
                      padding:20px 24px;margin:28px 0 0;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">✅</div>
            <h2 style="margin:0;font-size:22px;font-weight:700;
                       color:#10B981;letter-spacing:.5px;">Pembayaran Berhasil!</h2>
            <p style="margin:6px 0 0;color:#94A3B8;font-size:14px;">
              Produk kamu sudah siap digunakan
            </p>
          </div>
        </td>
      </tr>

      <!-- GREETING -->
      <tr>
        <td style="background:#0F172A;padding:24px 40px 8px;">
          <p style="margin:0;color:#CBD5E1;font-size:15px;line-height:1.7;">
            Halo <strong style="color:white;">${name}</strong>,<br>
            Terima kasih telah berbelanja di <strong style="color:#3B82F6;">KAMIL-SHOP</strong>.
            Berikut detail produk yang kamu beli:
          </p>
        </td>
      </tr>

      <!-- ORDER INFO -->
      <tr>
        <td style="background:#0F172A;padding:16px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:rgba(30,58,138,.12);border:1px solid rgba(59,130,246,.15);
                        border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);">
                <span style="font-size:11px;color:#64748B;text-transform:uppercase;
                              letter-spacing:1px;font-weight:700;">Produk</span><br>
                <span style="color:#E2E8F0;font-size:15px;font-weight:600;">${productName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;">
                <span style="font-size:11px;color:#64748B;text-transform:uppercase;
                              letter-spacing:1px;font-weight:700;">Order ID</span><br>
                <code style="color:#60A5FA;font-size:13px;">${orderId}</code>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- PRODUCT CONTENT -->
      <tr>
        <td style="background:#0F172A;padding:8px 40px 28px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#64748B;
                    text-transform:uppercase;letter-spacing:1px;">
            📦 Data Produk
          </p>
          ${contentHtml}
        </td>
      </tr>

      <!-- DIVIDER -->
      <tr>
        <td style="background:#0F172A;padding:0 40px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(59,130,246,.3),transparent);"></div>
        </td>
      </tr>

      <!-- FOOTER NOTE -->
      <tr>
        <td style="background:#0F172A;padding:24px 40px;">
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;text-align:center;">
            Simpan email ini dengan baik sebagai bukti pembelian.<br>
            Ada pertanyaan? Hubungi kami di
            <a href="mailto:admin@kamilshop.my.id"
               style="color:#60A5FA;text-decoration:none;">admin@kamilshop.my.id</a>
          </p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#0A0F1E;border-radius:0 0 16px 16px;
                   padding:20px 40px;text-align:center;
                   border-top:1px solid rgba(255,255,255,.06);">
          <p style="margin:0;font-size:12px;color:#334155;">
            © ${year} <strong style="color:#475569;">KAMIL-SHOP</strong> — Semua hak dilindungi.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
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
