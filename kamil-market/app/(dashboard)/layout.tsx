import Link from "next/link"
import { ShoppingBag, LayoutDashboard, Package, ShoppingCart, FolderOpen, Settings, ArrowLeft } from "lucide-react"

const navItems = [
  { href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Overview" },
  { href: "/dashboard/products", icon: <Package className="w-4 h-4" />, label: "Produk" },
  { href: "/dashboard/orders", icon: <ShoppingCart className="w-4 h-4" />, label: "Order" },
  { href: "/dashboard/categories", icon: <FolderOpen className="w-4 h-4" />, label: "Kategori" },
  { href: "/dashboard/settings", icon: <Settings className="w-4 h-4" />, label: "Pengaturan" },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "#0a0a0a" }}>
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col py-6 px-3" style={{ background: "#111", borderRight: "1px solid #2a2a2a" }}>
        <div className="flex items-center gap-2 px-3 mb-6">
          <ShoppingBag className="w-5 h-5" style={{ color: "#22c55e" }} />
          <span className="font-bold text-sm" style={{ color: "#f5f5f5" }}>
            KAMIL <span style={{ color: "#22c55e" }}>ADMIN</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{ color: "#a3a3a3" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1a1a1a"
                e.currentTarget.style.color = "#f5f5f5"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = "#a3a3a3"
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors"
          style={{ color: "#a3a3a3" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#22c55e")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a3a3a3")}
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Toko
        </Link>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
