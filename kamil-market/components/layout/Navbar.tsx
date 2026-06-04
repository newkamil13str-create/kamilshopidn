"use client"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
import { ShoppingBag, User, LogOut, LayoutDashboard, Package, ChevronDown } from "lucide-react"
import SearchBar from "@/components/shop/SearchBar"

export default function Navbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ background: "rgba(17,17,17,0.85)", borderColor: "#2a2a2a" }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <ShoppingBag className="w-6 h-6" style={{ color: "#22c55e" }} />
          <span style={{ color: "#f5f5f5" }}>
            KAMIL <span style={{ color: "#22c55e" }}>MARKET</span>
          </span>
        </Link>

        <div className="flex-1 max-w-xl mx-auto hidden md:block">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {session?.user ? (
            <div className="relative" ref={ref}>
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{ color: "#f5f5f5" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {session.user.image ? (
                  <img src={session.user.image} className="w-7 h-7 rounded-full" alt="" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(34,197,94,0.2)" }}
                  >
                    <User className="w-4 h-4" style={{ color: "#22c55e" }} />
                  </div>
                )}
                <span className="hidden sm:block text-sm max-w-[120px] truncate">
                  {session.user.name?.split(" ")[0]}
                </span>
                <ChevronDown className="w-4 h-4" style={{ color: "#a3a3a3" }} />
              </button>

              {open && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl overflow-hidden z-50 border"
                  style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}
                >
                  {[
                    { href: "/account", icon: <User className="w-4 h-4" />, label: "Profil Saya" },
                    { href: "/account/orders", icon: <Package className="w-4 h-4" />, label: "Pesanan Saya" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                      style={{ color: "#f5f5f5" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#111")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ color: "#a3a3a3" }}>{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                  {session.user.role === "admin" && (
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                      style={{ color: "#22c55e" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#111")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard Admin
                    </Link>
                  )}
                  <div style={{ borderTop: "1px solid #2a2a2a" }} />
                  <button
                    onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }) }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                    style={{ color: "#f87171" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#111")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors"
              style={{ background: "#22c55e", color: "#000" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#16a34a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
      <div className="md:hidden px-4 pb-3">
        <SearchBar />
      </div>
    </nav>
  )
}
