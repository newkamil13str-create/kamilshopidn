import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import ProductGrid from "@/components/shop/ProductGrid"
import CategoryBar from "@/components/shop/CategoryBar"
import type { Product } from "@/types"
import { Search } from "lucide-react"

interface Props {
  searchParams: { q?: string }
}

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.toLowerCase().trim() ?? ""

  const snap = await getDocs(query(collection(db, "products"), where("isActive", "==", true)))
  const allProducts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product))

  const results = q
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortDesc?.toLowerCase().includes(q) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    : allProducts

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Search className="w-5 h-5" style={{ color: "#22c55e" }} />
          <h1 className="font-bold text-xl" style={{ color: "#f5f5f5" }}>
            {q ? `Hasil pencarian: "${q}"` : "Semua Produk"}
          </h1>
        </div>
        <p className="text-sm" style={{ color: "#a3a3a3" }}>
          {results.length} produk ditemukan
        </p>
      </div>
      <CategoryBar />
      <ProductGrid products={results} emptyMessage={`Tidak ada produk untuk "${q}"`} />
    </div>
  )
}
