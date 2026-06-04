"use client"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { User, LogOut, Package, ShoppingBag } from "lucide-react"
import Link from "next/link"

export default function AccountPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ color: "#22c55e" }}>
      <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )

  if (!session) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#f5f5f5" }}>Profil Saya</h1>

      <div className="rounded-2xl p-6 mb-6" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
        <div className="flex items-center gap-4 mb-6">
          {session.user.image ? (
            <img src={session.user.image} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e" }}>
              {session.user.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-bold text-lg" style={{ color: "#f5f5f5" }}>{session.user.name}</h2>
            <p className="text-sm" style={{ color: "#a3a3a3" }}>{session.user.email}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
              style={{
                background: session.user.role === "admin" ? "rgba(34,197,94,0.15)" : "rgba(163,163,163,0.15)",
                color: session.user.role === "admin" ? "#22c55e" : "#a3a3a3",
                border: `1px solid ${session.user.role === "admin" ? "#22c55e" : "#2a2a2a"}`,
              }}>
              {session.user.role === "admin" ? "👑 Admin" : "👤 User"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/account/orders"
            className="flex items-center gap-3 p-4 rounded-xl transition-colors"
            style={{ background: "#111", border: "1px solid #2a2a2a" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
          >
            <Package className="w-5 h-5" style={{ color: "#22c55e" }} />
            <span className="font-medium text-sm" style={{ color: "#f5f5f5" }}>Pesanan Saya</span>
          </Link>
          <Link href="/"
            className="flex items-center gap-3 p-4 rounded-xl transition-colors"
            style={{ background: "#111", border: "1px solid #2a2a2a" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
          >
            <ShoppingBag className="w-5 h-5" style={{ color: "#22c55e" }} />
            <span className="font-medium text-sm" style={{ color: "#f5f5f5" }}>Belanja</span>
          </Link>
        </div>
      </div>

      <button onClick={() => signOut({ callbackUrl: "/" })}
        className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors border"
        style={{ borderColor: "#991b1b", color: "#f87171", background: "rgba(153,27,27,0.1)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(153,27,27,0.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(153,27,27,0.1)")}
      >
        <LogOut className="w-5 h-5" />
        Keluar
      </button>
    </div>
  )
}
