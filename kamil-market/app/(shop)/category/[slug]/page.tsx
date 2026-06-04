import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import ProductGrid from "@/components/shop/ProductGrid"
import CategoryBar from "@/components/shop/CategoryBar"
import type { Product } from "@/types"
import { CATEGORY_MAP } from "@/lib/utils"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = CATEGORY_MAP[params.slug]
  if (!cat) return { title: "Kategori Tidak Ditemukan" }
  return { title: `${cat.icon} ${cat.label} — KAMIL MARKET` }
}

export default async function CategoryPage({ params }: Props) {
  const cat = CATEGORY_MAP[params.slug]
  if (!cat) notFound()

  const snap = await getDocs(
    query(collection(db, "products"), where("isActive", "==", true), where("category", "==", params.slug))
  )
  const products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-bold text-2xl" style={{ color: "#f5f5f5" }}>
          {cat.icon} {cat.label}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#a3a3a3" }}>{products.length} produk</p>
      </div>
      <CategoryBar />
      <ProductGrid products={products} emptyMessage={`Belum ada produk dalam kategori ${cat.label}`} />
    </div>
  )
}
