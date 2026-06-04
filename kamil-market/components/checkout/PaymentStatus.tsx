"use client"
import { CheckCircle, Mail } from "lucide-react"
import Link from "next/link"

interface Props {
  orderId: string
  buyerEmail: string
  onClose: () => void
}

export default function PaymentStatus({ orderId, buyerEmail, onClose }: Props) {
  return (
    <div className="text-center space-y-5 py-4">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.15)" }}>
          <CheckCircle className="w-10 h-10" style={{ color: "#22c55e" }} />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-2" style={{ color: "#f5f5f5" }}>Pembayaran Berhasil! 🎉</h3>
        <p className="text-sm" style={{ color: "#a3a3a3" }}>Produk sedang diproses dan akan dikirim ke</p>
        <div className="flex items-center justify-center gap-2 mt-2 px-4 py-2 rounded-lg" style={{ background: "#111" }}>
          <Mail className="w-4 h-4" style={{ color: "#22c55e" }} />
          <span className="font-medium text-sm" style={{ color: "#22c55e" }}>{buyerEmail}</span>
        </div>
      </div>

      <div className="text-xs p-3 rounded-xl" style={{ background: "#111", color: "#a3a3a3" }}>
        Order ID: <span className="font-mono" style={{ color: "#f5f5f5" }}>{orderId}</span>
      </div>

      <div className="flex gap-3">
        <Link href="/account/orders"
          className="flex-1 py-2.5 rounded-xl text-sm border transition-colors text-center"
          style={{ borderColor: "#2a2a2a", color: "#a3a3a3" }}
          onClick={onClose}>
          Lihat Pesanan
        </Link>
        <button onClick={onClose}
          className="flex-1 py-2.5 font-semibold rounded-xl text-sm transition-colors"
          style={{ background: "#22c55e", color: "#000" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#16a34a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}>
          Selesai
        </button>
      </div>
    </div>
  )
}
