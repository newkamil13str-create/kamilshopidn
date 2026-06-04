import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { createQRISPayment, getPaymentURL, generateOrderId } from "@/lib/pakasir"
import { Timestamp } from "firebase-admin/firestore"
import { getToken } from "next-auth/jwt"

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const body = await req.json()
    const { products, buyerEmail, buyerName, paymentMethod } = body

    if (!products?.length || !buyerEmail || !buyerName) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 })
    }

    const productDetails = await Promise.all(
      products.map(async (item: { productId: string; qty: number }) => {
        const doc = await adminDb.collection("products").doc(item.productId).get()
        if (!doc.exists) throw new Error(`Produk tidak ditemukan`)
        const data = doc.data()!
        if (!data.isActive) throw new Error(`Produk ${data.name} tidak tersedia`)
        if (data.stock !== "unlimited" && data.stock < item.qty)
          throw new Error(`Stok ${data.name} tidak mencukupi`)
        return {
          productId: item.productId,
          name: data.name,
          price: data.price,
          qty: item.qty,
          thumbnail: data.thumbnail ?? null,
        }
      })
    )

    const totalAmount = productDetails.reduce((sum, p) => sum + p.price * p.qty, 0)
    const orderId = generateOrderId()

    let qrisData: string | undefined
    let qrisExpiredAt: Timestamp | undefined
    let pakasirOrderId: string | undefined

    if (paymentMethod === "qris") {
      const qrisRes = await createQRISPayment(orderId, totalAmount)
      if (!qrisRes.status || !qrisRes.data) {
        return NextResponse.json({ error: "Gagal membuat pembayaran QRIS" }, { status: 500 })
      }
      qrisData = qrisRes.data.qr_string
      qrisExpiredAt = Timestamp.fromDate(new Date(qrisRes.data.expired_at))
      pakasirOrderId = qrisRes.data.order_id
    }

    await adminDb.collection("orders").doc(orderId).set({
      orderId,
      buyerUid: token?.uid ?? null,
      buyerEmail,
      buyerName,
      products: productDetails,
      totalAmount,
      status: "pending",
      paymentMethod,
      pakasirOrderId: pakasirOrderId ?? null,
      qrisData: qrisData ?? null,
      qrisExpiredAt: qrisExpiredAt ?? null,
      createdAt: Timestamp.now(),
      paidAt: null,
    })

    const response: Record<string, unknown> = { success: true, orderId, totalAmount }

    if (paymentMethod === "qris" && qrisData) {
      response.qrisData = qrisData
      response.qrisExpiredAt = qrisExpiredAt?.toDate().toISOString()
    } else if (paymentMethod === "url") {
      response.paymentUrl = getPaymentURL(
        orderId,
        totalAmount,
        `${process.env.NEXT_PUBLIC_APP_URL}/account/orders?orderId=${orderId}`
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan"
    console.error("[Orders] create error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
