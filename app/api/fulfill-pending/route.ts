import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

/**
 * Dipanggil setelah admin tambah/update stok produk
 * Cek order pending yang stok habis → kirim otomatis
 */
export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json();
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

    const adminDb    = getAdminDb();
    const productRef = adminDb.doc(`products/${productId}`);
    const productDoc = await productRef.get();

    if (!productDoc.exists) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const product = productDoc.data()!;
    const stock: string[] = product.stock || [];

    if (stock.length === 0) {
      return NextResponse.json({ fulfilled: 0, message: 'Stok masih kosong' });
    }

    // Cari order yang paid tapi belum delivered (stok habis waktu itu)
    const pendingOrders = await adminDb
      .collection('orders')
      .where('productId', '==', productId)
      .where('status', '==', 'paid')
      .orderBy('createdAt', 'asc')
      .get();

    if (pendingOrders.empty) {
      return NextResponse.json({ fulfilled: 0, message: 'Tidak ada order pending' });
    }

    let fulfilled = 0;
    const remainingStock = [...stock];

    for (const orderDoc of pendingOrders.docs) {
      if (remainingStock.length === 0) break;

      const order   = orderDoc.data();
      const orderRef = adminDb.doc(`orders/${orderDoc.id}`);

      // Ambil stok dalam transaction
      await adminDb.runTransaction(async (tx) => {
        const freshProduct = await tx.get(productRef);
        const freshStock: string[] = freshProduct.data()?.stock || [];

        if (freshStock.length === 0) return;

        const item         = freshStock[0];
        const updatedStock = freshStock.slice(1);

        tx.update(productRef, {
          stock:     updatedStock,
          totalSold: FieldValue.increment(1),
        });

        tx.update(orderRef, {
          status:          'delivered',
          deliveryContent: item,
          paidAt:          order.paidAt || FieldValue.serverTimestamp(),
        });
      });

      // Kirim email ke customer
      await sendDeliveryEmail(
        order.customerEmail,
        order.customerName,
        order.productName,
        (await orderRef.get()).data()?.deliveryContent || '',
        orderDoc.id,
        product.contentType || 'text'
      );

      fulfilled++;
      remainingStock.shift();
    }

    console.log(`[fulfill-pending] Fulfilled ${fulfilled} orders for product ${productId}`);
    return NextResponse.json({ fulfilled, message: `${fulfilled} order berhasil dikirim` });

  } catch (err) {
    console.error('[fulfill-pending]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendDeliveryEmail(
  email: string,
  name: string,
  productName: string,
  deliveryContent: string,
  orderId: string,
  contentType: string
) {
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const isLink = contentType === 'link' || deliveryContent.startsWith('http');

    const contentHtml = isLink
      ? `<a href="${deliveryContent}" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;">⬇️ Download / Akses Sekarang</a>
         <p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:8px;">Atau copy link: <a href="${deliveryContent}" style="color:#60A5FA;">${deliveryContent}</a></p>`
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
            <div style="background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);border-radius:12px;padding:20px;margin:24px 0;text-align:${isLink ? 'center' : 'left'};">
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
  } catch (err) {
    console.error('[sendDeliveryEmail]', err);
  }
}
