import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import HeroSection from "@/components/shop/HeroSection"
import CategoryBar from "@/components/shop/CategoryBar"
import FlashSaleSection from "@/components/shop/FlashSaleSection"
import ProductGrid from "@/components/shop/ProductGrid"
import type { Product, SiteSettings } from "@/types"
import { Flame, Star, Clock } from "lucide-react"

async function getData() {
  const [settingsSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, "settings")),
    getDocs(query(collection(db, "products"), where("isActive", "==", true), orderBy("createdAt", "desc"))),
  ])

  const settings: SiteSettings | null = settingsSnap.empty
    ? null
    : (settingsSnap.docs[0].data() as SiteSettings)

  const allProducts = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product))

  return {
    settings,
    flashSaleProducts: allProducts.filter((p) => p.isFlashSale),
    featuredProducts: allProducts.filter((p) => p.isFeatured),
    latestProducts: allProducts.slice(0, 20),
  }
}

export default async function HomePage() {
  const { settings, flashSaleProducts, featuredProducts, latestProducts } = await getData()

  const sectionTitle = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h2 className="font-bold text-lg" style={{ color: "#f5f5f5" }}>{title}</h2>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      <HeroSection bannerImages={settings?.bannerImages ?? []} />
      <CategoryBar />

      {settings?.flashSaleActive && flashSaleProducts.length > 0 && (
        <FlashSaleSection
          products={flashSaleProducts}
          endAt={settings.flashSaleEndAt?.toDate()}
        />
      )}

      {featuredProducts.length > 0 && (
        <section>
          {sectionTitle(<Star className="w-5 h-5" style={{ color: "#facc15" }} />, "Produk Terlaris")}
          <ProductGrid products={featuredProducts} />
        </section>
      )}

      <section>
        {sectionTitle(<Clock className="w-5 h-5" style={{ color: "#22c55e" }} />, "Produk Terbaru")}
        <ProductGrid products={latestProducts} emptyMessage="Belum ada produk. Nantikan segera!" />
      </section>
    </div>
  )
}
