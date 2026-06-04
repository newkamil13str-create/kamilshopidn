import nodemailer from "nodemailer"
import { adminDb } from "./firebase-admin"
import type { Order, OrderItem } from "@/types"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
})

interface ProductEmailItem {
  name: string
  price: number
  qty: number
  downloadUrl?: string
  deliveryContent?: string
  deliveryType?: string
}

export async function sendProductEmail(orderId: string): Promise<void> {
  const orderDoc = await adminDb.collection("orders").doc(orderId).get()
  if (!orderDoc.exists) throw new Error(`Order ${orderId} not found`)

  const order = orderDoc.data() as Order
  const { buyerEmail, buyerName, products } = order

  const productDetails: ProductEmailItem[] = await Promise.all(
    products.map(async (item: OrderItem) => {
      const productDoc = await adminDb.collection("products").doc(item.productId).get()
      const data = productDoc.data()
      return {
        name: item.name,
        price: item.price,
        qty: item.qty,
        downloadUrl: data?.downloadUrl,
        deliveryContent: data?.deliveryContent,
        deliveryType: data?.deliveryType,
      }
    })
  )

  await transporter.sendMail({
    from: `"KAMIL MARKET 🛍️" <${process.env.GMAIL_USER}>`,
    to: buyerEmail,
    subject: `✅ Pembelian Berhasil! Order #${orderId} | KAMIL MARKET`,
    html: generateOrderEmailHTML({ orderId, buyerName, buyerEmail, products: productDetails }),
  })

  console.log(`[Email] Sent to ${buyerEmail} for order ${orderId}`)
}

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"KAMIL MARKET 🛍️" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `🔐 Kode OTP Login KAMIL MARKET: ${otp}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:sans-serif;background:#0a0a0a;padding:20px;">
        <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:32px;">
          <h2 style="color:#22c55e;margin:0 0 8px;">🛍️ KAMIL MARKET</h2>
          <p style="color:#a3a3a3;margin:0 0 24px;font-size:14px;">Kode verifikasi login Anda</p>
          <div style="background:#0a0a0a;border:1px solid #22c55e;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:42px;font-weight:bold;letter-spacing:12px;color:#22c55e;font-family:monospace;">${otp}</span>
          </div>
          <p style="color:#a3a3a3;font-size:13px;line-height:1.6;">
            Kode ini berlaku selama <strong style="color:#f5f5f5;">5 menit</strong>.<br/>
            Jangan bagikan kode ini ke siapapun.<br/>
            Jika Anda tidak melakukan login, abaikan email ini.
          </p>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;"/>
          <p style="color:#555;font-size:11px;">© 2025 KAMIL MARKET · market.kamilshop.my.id</p>
        </div>
      </body>
      </html>
    `,
  })
}

function generateOrderEmailHTML(data: {
  orderId: string
  buyerName: string
  buyerEmail: string
  products: ProductEmailItem[]
}): string {
  const productsHTML = data.products
    .map(
      (p) => `
      <div style="background:#0a0a0a;border:1px solid #2a2a2a;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="margin-bottom:8px;">
          <strong style="color:#f5f5f5;font-size:15px;">${p.name}</strong>
          <div style="color:#a3a3a3;font-size:12px;margin-top:4px;">
            Qty: ${p.qty} × Rp ${p.price.toLocaleString("id-ID")} = 
            <span style="color:#22c55e;">Rp ${(p.price * p.qty).toLocaleString("id-ID")}</span>
          </div>
        </div>
        ${p.downloadUrl
          ? `<a href="${p.downloadUrl}" style="display:inline-block;background:#22c55e;color:#000;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:bold;font-size:13px;">⬇️ Download Produk</a>`
          : ""}
        ${p.deliveryContent
          ? `<div style="margin-top:12px;">
              <div style="color:#a3a3a3;font-size:12px;margin-bottom:6px;">📋 Informasi Produk:</div>
              <pre style="background:#111;border:1px solid #2a2a2a;color:#86efac;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;overflow-x:auto;">${p.deliveryContent}</pre>
             </div>`
          : ""}
        ${p.deliveryType === "manual"
          ? `<div style="background:#1c1007;border:1px solid #422006;color:#fb923c;padding:10px 14px;border-radius:6px;font-size:12px;margin-top:8px;">
              ⏳ Produk ini akan dikirim secara manual dalam 1×24 jam.
             </div>`
          : ""}
      </div>
    `
    )
    .join("")

  const total = data.products.reduce((sum, p) => sum + p.price * p.qty, 0)

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="font-family:sans-serif;background:#0a0a0a;padding:20px;margin:0;">
      <div style="max-width:600px;margin:0 auto;">
        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🛍️</div>
          <h1 style="color:#22c55e;margin:0;font-size:24px;letter-spacing:1px;">KAMIL MARKET</h1>
          <p style="color:#a3a3a3;margin:4px 0 0;font-size:13px;">market.kamilshop.my.id</p>
        </div>
        <div style="background:#14532d;padding:16px 32px;text-align:center;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;">
          <div style="font-size:20px;font-weight:bold;color:#86efac;">✅ Pembayaran Berhasil!</div>
          <div style="color:#a3a3a3;font-size:13px;margin-top:4px;">Order #${data.orderId}</div>
        </div>
        <div style="background:#111111;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
          <p style="color:#f5f5f5;margin:0 0 24px;font-size:15px;">
            Halo <strong>${data.buyerName}</strong>! 👋<br/>
            Terima kasih sudah berbelanja di <strong style="color:#22c55e;">KAMIL MARKET</strong>.
          </p>
          ${productsHTML}
          <div style="border-top:1px solid #2a2a2a;margin-top:20px;padding-top:16px;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#a3a3a3;">Total Pembayaran</span>
            <span style="color:#22c55e;font-size:18px;font-weight:bold;">Rp ${total.toLocaleString("id-ID")}</span>
          </div>
          <div style="background:#0a0a0a;border:1px solid #2a2a2a;border-radius:8px;padding:16px;margin-top:24px;">
            <p style="color:#a3a3a3;font-size:12px;line-height:1.7;margin:0;">
              💬 Pertanyaan? Balas email ini atau hubungi kami.<br/>
              📧 ${process.env.GMAIL_USER}<br/>
              🌐 <a href="https://market.kamilshop.my.id" style="color:#22c55e;">market.kamilshop.my.id</a>
            </p>
          </div>
          <p style="color:#555;font-size:11px;margin:24px 0 0;text-align:center;">© 2025 KAMIL MARKET · Semua hak dilindungi</p>
        </div>
      </div>
    </body>
    </html>
  `
}
