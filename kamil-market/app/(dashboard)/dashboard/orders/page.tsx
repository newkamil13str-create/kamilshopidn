"use client"
import { useEffect, useState } from "react"
import { collection, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order } from "@/types"
import { formatRupiah, STATUS_MAP } from "@/lib/utils"
import { Mail, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { id } from "date-fns/locale"

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [resending, setResending] = useState<string | null>(null)

  useEffect(() => {
    getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")))
      .then((snap) => {
        setOrders(snap.docs.map((d) => ({ orderId: d.id, ...d.data() } as Order)))
        setLoading(false)
      })
  }, [])

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter)

  const handleResend = async (orderId: string) => {
    setResending(orderId)
    await fetch("/api/email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
    setResending(null)
    alert("Email terkirim!")
  }

  if (loading) return (
    <div className="flex justify-center py-20" style={{ color: "#22c55e" }}>
      <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#f5f5f5" }}>Kelola Order</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "pending", "paid", "failed", "refunded"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors border"
            style={{
              borderColor: filter === s ? "#22c55e" : "#2a2a2a",
              background: filter === s ? "rgba(34,197,94,0.1)" : "transparent",
              color: filter === s ? "#22c55e" : "#a3a3a3",
            }}>
            {s === "all" ? "Semua" : STATUS_MAP[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((order) => {
          const statusInfo = STATUS_MAP[order.status] ?? STATUS_MAP.pending
          return (
            <div key={order.orderId} className="p-4 rounded-xl" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-mono text-xs mb-0.5" style={{ color: "#a3a3a3" }}>#{order.orderId}</div>
                  <div className="font-medium text-sm" style={{ color: "#f5f5f5" }}>{order.buyerName}</div>
                  <div className="text-xs" style={{ color: "#a3a3a3" }}>{order.buyerEmail}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${statusInfo.color}`}>{statusInfo.label}</span>
                  <div className="font-bold" style={{ color: "#22c55e" }}>{formatRupiah(order.totalAmount)}</div>
                  {order.status === "paid" && (
                    <button onClick={() => handleResend(order.orderId)} disabled={resending === order.orderId}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: "#22c55e", color: "#22c55e" }}>
                      {resending === order.orderId ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                      Resend
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 text-xs" style={{ color: "#a3a3a3" }}>
                {order.products.map((p) => p.name).join(", ")} ·{" "}
                {order.createdAt && format((order.createdAt as any).toDate?.() ?? new Date(), "d MMM yyyy HH:mm", { locale: id })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
