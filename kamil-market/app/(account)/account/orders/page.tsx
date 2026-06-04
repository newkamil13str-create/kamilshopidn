"use client"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { collection, query, where, orderBy, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order } from "@/types"
import { formatRupiah, STATUS_MAP } from "@/lib/utils"
import { RefreshCw, Mail, Package } from "lucide-react"
import { format } from "date-fns"
import { id } from "date-fns/locale"

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.uid) return
    const fetch = async () => {
      const snap = await getDocs(
        query(collection(db, "orders"), where("buyerUid", "==", session.user.uid), orderBy("createdAt", "desc"))
      )
      setOrders(snap.docs.map((d) => ({ orderId: d.id, ...d.data() } as Order)))
      setLoading(false)
    }
    fetch()
  }, [session?.user?.uid])

  const handleResend = async (orderId: string) => {
    setResending(orderId)
    try {
      await fetch("/api/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      alert("Email berhasil dikirim ulang!")
    } catch {
      alert("Gagal mengirim email")
    } finally {
      setResending(null)
    }
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ color: "#22c55e" }}>
      <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#f5f5f5" }}>Pesanan Saya</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16" style={{ color: "#a3a3a3" }}>
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Belum ada pesanan</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = STATUS_MAP[order.status] ?? STATUS_MAP.pending
            return (
              <div key={order.orderId} className="rounded-xl p-5" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-xs mb-1" style={{ color: "#a3a3a3" }}>#{order.orderId}</div>
                    <div className="text-sm" style={{ color: "#a3a3a3" }}>
                      {order.createdAt && format((order.createdAt as any).toDate?.() ?? new Date(order.createdAt as any), "d MMM yyyy, HH:mm", { locale: id })}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  {order.products.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span style={{ color: "#f5f5f5" }}>{item.name} ×{item.qty}</span>
                      <span style={{ color: "#22c55e" }}>{formatRupiah(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid #2a2a2a" }}>
                  <div>
                    <div className="text-xs" style={{ color: "#a3a3a3" }}>Total</div>
                    <div className="font-bold" style={{ color: "#22c55e" }}>{formatRupiah(order.totalAmount)}</div>
                  </div>
                  {order.status === "paid" && (
                    <button onClick={() => handleResend(order.orderId)}
                      disabled={resending === order.orderId}
                      className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors"
                      style={{ borderColor: "#22c55e", color: "#22c55e", background: "transparent" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {resending === order.orderId
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Mail className="w-4 h-4" />}
                      Kirim Ulang Email
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
