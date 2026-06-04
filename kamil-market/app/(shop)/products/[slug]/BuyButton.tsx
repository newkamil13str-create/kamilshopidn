"use client"
import { useState } from "react"
import { ShoppingCart } from "lucide-react"
import type { Product } from "@/types"
import CheckoutModal from "@/components/checkout/CheckoutModal"

export default function BuyButton({ product }: { product: Product }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="w-full py-3.5 font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-colors"
        style={{ background: "#22c55e", color: "#000" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#16a34a")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}
      >
        <ShoppingCart className="w-5 h-5" />
        Beli Sekarang
      </button>
      {show && <CheckoutModal product={product} onClose={() => setShow(false)} />}
    </>
  )
}
