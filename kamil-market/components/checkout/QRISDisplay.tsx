"use client"
import { useEffect, useRef } from "react"
import { QRCodeCanvas } from "qrcode.react"
import CountdownTimer from "@/components/shop/CountdownTimer"
import { formatRupiah } from "@/lib/utils"
import { RefreshCw } from "lucide-react"

interface Props {
  qrisData: string
  orderId: string
  expiredAt?: Date
  amount: number
  onPaid: () => void
}

export default function QRISDisplay({ qrisData, orderId, expiredAt, amount, onPaid }: Props) {
  const pollingRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/status/${orderId}`)
        const data = await res.json()
        if (data.status === "paid") {
          clearInterval(pollingRef.current)
          onPaid()
        }
      } catch {}
    }, 3000)
    return () => clearInterval(pollingRef.current)
  }, [orderId, onPaid])

  return (
    <div className="text-center space-y-4">
      <p className="text-sm" style={{ color: "#a3a3a3" }}>
        Scan QR code menggunakan aplikasi mobile banking / e-wallet
      </p>

      <div className="inline-block p-4 bg-white rounded-2xl">
        <QRCodeCanvas value={qrisData || "https://market.kamilshop.my.id"} size={220} level="H" />
      </div>

      <div className="p-3 rounded-xl" style={{ background: "#111" }}>
        <div className="text-xs mb-1" style={{ color: "#a3a3a3" }}>Total Pembayaran</div>
        <div className="font-bold text-xl" style={{ color: "#22c55e" }}>{formatRupiah(amount)}</div>
        <div className="text-xs mt-1 font-mono" style={{ color: "#a3a3a3" }}>Order ID: {orderId}</div>
      </div>

      {expiredAt && (
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "#a3a3a3" }}>
          <span>Expired dalam:</span>
          <CountdownTimer endAt={expiredAt} size="sm" />
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "#a3a3a3" }}>
        <RefreshCw className="w-3 h-3 animate-spin" />
        Menunggu konfirmasi pembayaran...
      </div>
    </div>
  )
}
