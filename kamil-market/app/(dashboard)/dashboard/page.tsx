import { adminDb } from "@/lib/firebase-admin"
import { formatRupiah } from "@/lib/utils"
import { ShoppingBag, Package, Users, TrendingUp } from "lucide-react"
import Link from "next/link"

async function getStats() {
  const [ordersSnap, productsSnap, usersSnap] = await Promise.all([
    adminDb.collection("orders").get(),
    adminDb.collection("products").where("isActive", "==", true).get(),
    adminDb.collection("users").get(),
  ])

  const orders = ordersSnap.docs.map((d) => d.data())
  const paidOrders = orders.filter((o) => o.status === "paid")
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0)

  return {
    totalRevenue,
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    paidOrders: paidOrders.length,
    activeProducts: productsSnap.size,
    totalUsers: usersSnap.size,
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const cards = [
    { icon: <TrendingUp className="w-6 h-6" />, label: "Total Revenue", value: formatRupiah(stats.totalRevenue), color: "#22c55e" },
    { icon: <ShoppingBag className="w-6 h-6" />, label: "Total Order", value: stats.totalOrders, sub: `${stats.paidOrders} lunas · ${stats.pendingOrders} pending`, color: "#60a5fa" },
    { icon: <Package className="w-6 h-6" />, label: "Produk Aktif", value: stats.activeProducts, color: "#f59e0b" },
    { icon: <Users className="w-6 h-6" />, label: "Total User", value: stats.totalUsers, color: "#a78bfa" },
  ]

  const menus = [
    { href: "/dashboard/products", label: "📦 Kelola Produk", desc: "Tambah, edit, hapus produk" },
    { href: "/dashboard/orders", label: "🛍️ Kelola Order", desc: "Lihat & proses semua order" },
    { href: "/dashboard/categories", label: "📂 Kategori", desc: "Kelola kategori produk" },
    { href: "/dashboard/settings", label: "⚙️ Pengaturan", desc: "Konfigurasi toko" },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#f5f5f5" }}>Dashboard Admin</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="p-5 rounded-xl" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <div className="mb-3" style={{ color: card.color }}>{card.icon}</div>
            <div className="text-xs mb-1" style={{ color: "#a3a3a3" }}>{card.label}</div>
            <div className="text-xl font-bold" style={{ color: "#f5f5f5" }}>{card.value}</div>
            {card.sub && <div className="text-xs mt-1" style={{ color: "#a3a3a3" }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {menus.map((menu) => (
          <Link key={menu.href} href={menu.href}
            className="p-5 rounded-xl transition-all"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
          >
            <div className="font-semibold text-sm mb-1" style={{ color: "#f5f5f5" }}>{menu.label}</div>
            <div className="text-xs" style={{ color: "#a3a3a3" }}>{menu.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
