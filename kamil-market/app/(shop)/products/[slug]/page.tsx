import { collection, getDocs, query, where, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Product, Review } from "@/types"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { formatRupiah, CATEGORY_MAP } from "@/lib/utils"
import { Star, ShoppingCart, Zap, Package, Mail, Download } from "lucide-react"
import ReactMarkdown from "react-markdown"
import CountdownTimer from "@/components/shop/CountdownTimer"
import ProductGrid from "@/components/shop/ProductGrid"
import BuyButton from "./BuyButton"

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const snap = await getDocs(query(collection(db, "products"), where("slug", "==", params.slug), limit(1)))
  if (snap.empty) return { title: "Produk Tidak Ditemukan" }
  const p = snap.docs[0].data() as Product
  return {
    title: p.name,
    description: p.shortDesc,
    openGraph: { images: [p.thumbnail] },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const snap = await getDocs(query(collection(db, "products"), where("slug", "==", params.slug), limit(1)))
  if (snap.empty) notFound()

  const product = { id: snap.docs[0].id, ...snap.docs[0].data() } as Product
  const category = CATEGORY_MAP[product.category] ?? CATEGORY_MAP.other

  // Ambil ulasan
  const reviewsSnap = await getDocs(
    query(collection(db, "reviews"), where("productId", "==", product.id), limit(20))
  )
  const reviews = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Review))

  // Related products
  const relatedSnap = await getDocs(
    query(collection(db, "products"), where("category", "==", product.category), where("isActive", "==", true), limit(6))
  )
  const related = relatedSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Product))
    .filter((p) => p.id !== product.id)
    .slice(0, 5)

  const deliveryIcon = product.deliveryType === "download"
    ? <Download className="w-4 h-4" />
    : product.deliveryType === "email"
    ? <Mail className="w-4 h-4" />
    : <Package className="w-4 h-4" />

  const deliveryLabel = product.deliveryType === "download"
    ? "Download otomatis setelah bayar"
    : product.deliveryType === "email"
    ? "Dikirim via email setelah bayar"
    : "Dikirim manual dalam 1×24 jam"

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", background: "#111" }}>
            <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {product.images.map((img, i) => (
                <img key={i} src={img} alt={`img-${i}`}
                  className="w-20 h-14 object-cover rounded-lg shrink-0 border"
                  style={{ borderColor: "#2a2a2a" }} />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border ${category.color}`}>
            {category.icon} {category.label}
          </span>

          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>{product.name}</h1>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4"
                  style={{ fill: i < Math.round(product.rating) ? "#facc15" : "transparent", color: "#facc15" }} />
              ))}
              <span className="ml-1" style={{ color: "#facc15" }}>{product.rating.toFixed(1)}</span>
            </div>
            <span style={{ color: "#a3a3a3" }}>|</span>
            <span className="text-sm" style={{ color: "#a3a3a3" }}>{product.reviewCount} ulasan</span>
            <span style={{ color: "#a3a3a3" }}>|</span>
            <span className="text-sm" style={{ color: "#a3a3a3" }}>{product.sold} terjual</span>
          </div>

          {product.isFlashSale && product.flashSaleEndAt && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid #991b1b" }}>
              <Zap className="w-5 h-5" style={{ color: "#f87171" }} />
              <div>
                <div className="text-xs font-bold mb-1" style={{ color: "#f87171" }}>FLASH SALE — Berakhir dalam:</div>
                <CountdownTimer endAt={product.flashSaleEndAt.toDate()} size="md" />
              </div>
            </div>
          )}

          {/* Price */}
          <div>
            <div className="text-3xl font-bold" style={{ color: "#22c55e" }}>{formatRupiah(product.price)}</div>
            {product.originalPrice && (
              <div className="flex items-center gap-2 mt-1">
                <span className="line-through text-sm" style={{ color: "#a3a3a3" }}>{formatRupiah(product.originalPrice)}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#dc2626" }}>-{discount}%</span>
              </div>
            )}
          </div>

          {/* Stock */}
          <div className="text-sm" style={{ color: "#a3a3a3" }}>
            Stok: <span style={{ color: "#f5f5f5" }}>
              {product.stock === "unlimited" ? "Unlimited ∞" : `${product.stock} unit`}
            </span>
          </div>

          {/* Delivery */}
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "#111", border: "1px solid #2a2a2a" }}>
            <span style={{ color: "#22c55e" }}>{deliveryIcon}</span>
            <span className="text-sm" style={{ color: "#a3a3a3" }}>{deliveryLabel}</span>
          </div>

          <BuyButton product={product} />

          {/* Short desc */}
          <p className="text-sm leading-relaxed" style={{ color: "#a3a3a3" }}>{product.shortDesc}</p>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 rounded-full"
                  style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#a3a3a3" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs: Deskripsi & Ulasan */}
      <div className="mb-12">
        <div style={{ borderBottom: "1px solid #2a2a2a", marginBottom: 24 }}>
          <div className="flex gap-6">
            {["Deskripsi", `Ulasan (${reviews.length})`].map((tab, i) => (
              <div key={tab} className="pb-3 text-sm font-semibold"
                style={{ borderBottom: i === 0 ? "2px solid #22c55e" : "none", color: i === 0 ? "#22c55e" : "#a3a3a3" }}>
                {tab}
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="prose prose-invert max-w-none p-6 rounded-xl" style={{ background: "#111", border: "1px solid #2a2a2a" }}>
          <ReactMarkdown>{product.description || product.shortDesc}</ReactMarkdown>
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="mb-12">
          <h2 className="font-bold text-lg mb-4" style={{ color: "#f5f5f5" }}>⭐ Ulasan Pembeli</h2>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 rounded-xl" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: "#22c55e", color: "#000" }}>
                    {review.userName[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm" style={{ color: "#f5f5f5" }}>{review.userName}</div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-3 h-3"
                          style={{ fill: i < review.rating ? "#facc15" : "transparent", color: "#facc15" }} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm" style={{ color: "#a3a3a3" }}>{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related */}
      {related.length > 0 && (
        <div>
          <h2 className="font-bold text-lg mb-4" style={{ color: "#f5f5f5" }}>Produk Serupa</h2>
          <ProductGrid products={related} />
        </div>
      )}
    </div>
  )
}
