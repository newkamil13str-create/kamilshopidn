"use client"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { X, QrCode, ExternalLink, Loader2 } from "lucide-react"
import type { Product } from "@/types"
import { formatRupiah } from "@/lib/utils"
import QRISDisplay from "./QRISDisplay"
import PaymentStatus from "./PaymentStatus"

interface Props {
  product: Product
  onClose: () => void
}

type Step = "form" | "qris" | "status"

export default function CheckoutModal({ product, onClose }: Props) {
  const { data: session } = useSession()
  const [step, setStep] = useState<Step>("form")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [orderId, setOrderId] = useState("")
  const [qrisData, setQrisData] = useState("")
  const [qrisExpiredAt, setQrisExpiredAt] = useState<Date>()
  const [form, setForm] = useState({
    buyerName: session?.user?.name ?? "",
    buyerEmail: session?.user?.email ?? "",
    paymentMethod: "qris" as "qris" | "url",
  })

  const handleSubmit = async () => {
    if (!form.buyerName || !form.buyerEmail) { setError("Nama dan email wajib diisi"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: [{ productId: product.id, qty: 1 }],
          buyerName: form.buyerName,
          buyerEmail: form.buyerEmail,
          paymentMethod: form.paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrderId(data.orderId)
      if (form.paymentMethod === "qris") {
        setQrisData(data.qrisData)
        setQrisExpiredAt(data.qrisExpiredAt ? new Date(data.qrisExpiredAt) : undefined)
        setStep("qris")
      } else {
        window.location.href = data.paymentUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2a2a2a",
    borderRadius: 8, color: "#f5f5f5", fontSize: 14, outline: "none",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden overflow-y-auto"
        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid #2a2a2a" }}>
          <h2 className="font-bold" style={{ color: "#f5f5f5" }}>
            {step === "form" ? "Checkout" : step === "qris" ? "Scan QRIS" : "Status Pembayaran"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#a3a3a3" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#111")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {step === "form" && (
            <div className="space-y-4">
              {/* Product summary */}
              <div className="flex gap-3 p-3 rounded-xl" style={{ background: "#111" }}>
                <img src={product.thumbnail || "/placeholder.png"} alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2" style={{ color: "#f5f5f5" }}>{product.name}</p>
                  <p className="font-bold mt-1" style={{ color: "#22c55e" }}>{formatRupiah(product.price)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: "#a3a3a3" }}>Nama Lengkap</label>
                <input value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                  placeholder="Masukkan nama lengkap" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: "#a3a3a3" }}>Email</label>
                <input type="email" value={form.buyerEmail} onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })}
                  placeholder="email@contoh.com" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                <p className="text-xs mt-1" style={{ color: "#a3a3a3" }}>Produk akan dikirim ke email ini</p>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-sm mb-2" style={{ color: "#a3a3a3" }}>Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "qris", label: "QRIS", icon: <QrCode className="w-5 h-5" />, desc: "Scan QR Code" },
                    { value: "url", label: "Via Link", icon: <ExternalLink className="w-5 h-5" />, desc: "Redirect Pakasir" },
                  ].map((method) => {
                    const active = form.paymentMethod === method.value
                    return (
                      <button key={method.value}
                        onClick={() => setForm({ ...form, paymentMethod: method.value as "qris" | "url" })}
                        className="flex flex-col items-center gap-1 p-3 rounded-xl border text-sm transition-all"
                        style={{
                          borderColor: active ? "#22c55e" : "#2a2a2a",
                          background: active ? "rgba(34,197,94,0.1)" : "transparent",
                          color: active ? "#22c55e" : "#a3a3a3",
                        }}>
                        {method.icon}
                        <span className="font-medium">{method.label}</span>
                        <span className="text-xs opacity-70">{method.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && (
                <div className="text-sm rounded-lg px-4 py-3"
                  style={{ background: "rgba(153,27,27,0.3)", border: "1px solid #991b1b", color: "#f87171" }}>
                  {error}
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading}
                className="w-full py-3 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                style={{ background: loading ? "#16a34a" : "#22c55e", color: "#000", opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? "Memproses..." : `Bayar ${formatRupiah(product.price)}`}
              </button>
            </div>
          )}

          {step === "qris" && (
            <QRISDisplay qrisData={qrisData} orderId={orderId} expiredAt={qrisExpiredAt}
              amount={product.price} onPaid={() => setStep("status")} />
          )}

          {step === "status" && (
            <PaymentStatus orderId={orderId} buyerEmail={form.buyerEmail} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}
