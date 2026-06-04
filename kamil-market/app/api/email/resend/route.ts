import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { sendProductEmail } from "@/lib/email"
import { getToken } from "next-auth/jwt"

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId wajib diisi" }, { status: 400 })

    const orderDoc = await adminDb.collection("orders").doc(orderId).get()
    if (!orderDoc.exists) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 })

    const orderData = orderDoc.data()!
    if (token.role !== "admin" && orderData.buyerUid !== token.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (orderData.status !== "paid") {
      return NextResponse.json({ error: "Order belum dibayar" }, { status: 400 })
    }

    await sendProductEmail(orderId)
    return NextResponse.json({ success: true, message: "Email berhasil dikirim ulang" })
  } catch (error) {
    console.error("[Email] resend error:", error)
    return NextResponse.json({ error: "Gagal mengirim email" }, { status: 500 })
  }
}
