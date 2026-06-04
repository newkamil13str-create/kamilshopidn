import ProductCard from "./ProductCard"
import type { Product } from "@/types"

interface Props {
  products: Product[]
  emptyMessage?: string
}

export default function ProductGrid({ products, emptyMessage = "Tidak ada produk ditemukan." }: Props) {
  if (!products.length) {
    return (
      <div className="text-center py-16" style={{ color: "#a3a3a3" }}>
        <div className="text-5xl mb-4">📭</div>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
