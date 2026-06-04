import { NextRequest } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { sendProductEmail } from "@/lib/email"
import { Timestamp } from "firebase-admin/firestore"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log("[Webhook Pakasir]", JSON.stringify(body))

    const { order_id, status } = body
    if (!order_id) return new Response("Missing order_id", { status: 400 })

    if (status === "paid" || status === "success") {
      const orderRef = adminDb.collection("orders").doc(order_id)
      const orderDoc = await orderRef.get()

      if (!orderDoc.exists) return new Response("Order not found", { status: 404 })

      const orderData = orderDoc.data()!
      if (orderData.status === "paid") return new Response("Already processed", { status: 200 })

      await orderRef.update({ status: "paid", paidAt: Timestamp.now() })

      for (const item of orderData.products) {
        const productRef = adminDb.collection("products").doc(item.productId)
        const productDoc = await productRef.get()
        if (productDoc.exists) {
          const pd = productDoc.data()!
          if (pd.stock !== "unlimited") {
            await productRef.update({
              stock: Math.max(0, pd.stock - item.qty),
              sold: (pd.sold ?? 0) + item.qty,
            })
          } else {
            await productRef.update({ sold: (pd.sold ?? 0) + item.qty })
          }
        }
      }

      await sendProductEmail(order_id)
    }

    return new Response("OK", { status: 200 })
  } catch (error) {
    console.error("[Webhook] error:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}
