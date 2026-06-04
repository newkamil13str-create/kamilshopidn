"use client"
import { Zap } from "lucide-react"
import type { Product } from "@/types"
import ProductCard from "./ProductCard"
import CountdownTimer from "./CountdownTimer"

interface Props {
  products: Product[]
  endAt?: Date
}

export default function FlashSaleSection({ products, endAt }: Props) {
  if (!products.length) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold px-3 py-1.5 rounded-lg text-white text-sm"
            style={{ background: "#dc2626" }}>
            <Zap className="w-4 h-4 animate-pulse" /> FLASH SALE
          </div>
          {endAt && <CountdownTimer endAt={endAt} size="md" />}
        </div>
        <span className="text-sm" style={{ color: "#a3a3a3" }}>Terbatas!</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {products.slice(0, 5).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  )
}
