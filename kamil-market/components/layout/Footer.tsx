import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { CATEGORY_MAP } from "@/lib/utils"

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #2a2a2a", background: "#111111" }}>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg mb-3" style={{ color: "#f5f5f5" }}>
              <ShoppingBag className="w-5 h-5" style={{ color: "#22c55e" }} />
              KAMIL <span style={{ color: "#22c55e" }}>MARKET</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#a3a3a3" }}>
              Marketplace produk digital terpercaya di Indonesia. Bot, Script, Template & Jasa Website.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3" style={{ color: "#f5f5f5" }}>Kategori</h4>
            <ul className="space-y-2">
              {Object.entries(CATEGORY_MAP).slice(0, 5).map(([slug, data]) => (
                <li key={slug}>
                  <Link href={`/category/${slug}`} className="text-sm transition-colors" style={{ color: "#a3a3a3" }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#22c55e")}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#a3a3a3")}
                  >
                    {data.icon} {data.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3" style={{ color: "#f5f5f5" }}>Akun</h4>
            <ul className="space-y-2">
              {[
                { href: "/login", label: "Masuk" },
                { href: "/register", label: "Daftar" },
                { href: "/account", label: "Profil Saya" },
                { href: "/account/orders", label: "Pesanan Saya" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm transition-colors" style={{ color: "#a3a3a3" }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#22c55e")}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#a3a3a3")}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3" style={{ color: "#f5f5f5" }}>Info</h4>
            <ul className="space-y-2">
              {[
                { href: "/", label: "🏠 Beranda" },
                { href: "/search", label: "🔍 Cari Produk" },
                { href: "/dashboard", label: "⚙️ Dashboard" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm transition-colors" style={{ color: "#a3a3a3" }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#22c55e")}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#a3a3a3")}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ borderTop: "1px solid #2a2a2a", color: "#a3a3a3" }}
        >
          <p>© 2025 KAMIL MARKET · market.kamilshop.my.id</p>
          <p>Powered by Next.js + Firebase + Pakasir</p>
        </div>
      </div>
    </footer>
  )
}
