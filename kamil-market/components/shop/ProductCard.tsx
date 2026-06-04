"use client"
import { useState } from "react"
import { Star, ShoppingCart, Zap } from "lucide-react"
import { formatRupiah, CATEGORY_MAP } from "@/lib/utils"
import type { Product } from "@/types"
import Link from "next/link"
import CheckoutModal from "@/components/checkout/CheckoutModal"
import CountdownTimer from "./CountdownTimer"

export default function ProductCard({ product }: { product: Product }) {
  const [showCheckout, setShowCheckout] = useState(false)
  const category = CATEGORY_MAP[product.category] ?? CATEGORY_MAP.other
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0

  return (
    <>
      <div
        className="group rounded-xl overflow-hidden transition-all duration-200"
        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(34,197,94,0.5)"
          e.currentTarget.style.boxShadow = "0 0 20px rgba(34,197,94,0.08)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#2a2a2a"
          e.currentTarget.style.boxShadow = "none"
        }}
      >
        <Link href={`/products/${product.slug}`} className="block relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <img
            src={product.thumbnail || "/placeholder.png"}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {product.isFlashSale && (
            <div className="absolute top-2 left-2 flex items-center gap-1 text-white text-xs font-bold px-2 py-1 rounded-full"
              style={{ background: "#dc2626" }}>
              <Zap className="w-3 h-3" /> FLASH SALE
            </div>
          )}
          {discount > 0 && (
            <div className="absolute top-2 right-2 text-white text-xs font-bold px-2 py-1 rounded-full"
              style={{ background: "#dc2626" }}>
              -{discount}%
            </div>
          )}
        </Link>

        <div className="p-4">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mb-2 ${category.color}`}
          >
            {category.icon} {category.label}
          </span>

          <Link href={`/products/${product.slug}`}>
            <h3
              className="font-semibold text-sm leading-tight mb-2 line-clamp-2 transition-colors"
              style={{ color: "#f5f5f5" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#22c55e")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#f5f5f5")}
            >
              {product.name}
            </h3>
          </Link>

          {product.isFlashSale && product.flashSaleEndAt && (
            <div className="mb-2">
              <CountdownTimer endAt={product.flashSaleEndAt.toDate()} size="sm" />
            </div>
          )}

          <div className="flex items-center gap-1 text-xs mb-3" style={{ color: "#a3a3a3" }}>
            <Star className="w-3 h-3" style={{ fill: "#facc15", color: "#facc15" }} />
            <span style={{ color: "#facc15" }}>{product.rating.toFixed(1)}</span>
            <span>({product.reviewCount})</span>
            <span className="ml-auto">{product.sold} terjual</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="font-bold text-base" style={{ color: "#22c55e" }}>
                {formatRupiah(product.price)}
              </div>
              {product.originalPrice && (
                <div className="text-xs line-through" style={{ color: "#a3a3a3" }}>
                  {formatRupiah(product.originalPrice)}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              style={{ background: "#22c55e", color: "#000" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#16a34a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Beli
            </button>
          </div>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal product={product} onClose={() => setShowCheckout(false)} />
      )}
    </>
  )
}
