import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const doc = await adminDb.collection("orders").doc(params.orderId).get()
    if (!doc.exists) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 })
    const data = doc.data()!
    return NextResponse.json({
      orderId: params.orderId,
      status: data.status,
      paidAt: data.paidAt?.toDate?.()?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("[Orders] status error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 })
  }
}
