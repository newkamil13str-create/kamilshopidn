"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react"

export default function HeroSection({ bannerImages = [] }: { bannerImages?: string[] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!bannerImages.length) return
    const id = setInterval(() => setCurrent((c) => (c + 1) % bannerImages.length), 4000)
    return () => clearInterval(id)
  }, [bannerImages.length])

  if (bannerImages.length > 0) {
    return (
      <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "21/6" }}>
        {bannerImages.map((img, i) => (
          <img key={i} src={img} alt={`Banner ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`} />
        ))}
        {bannerImages.length > 1 && (
          <>
            <button onClick={() => setCurrent((c) => (c - 1 + bannerImages.length) % bannerImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrent((c) => (c + 1) % bannerImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}>
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {bannerImages.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className="h-2 rounded-full transition-all"
                  style={{ width: i === current ? 24 : 8, background: i === current ? "#22c55e" : "rgba(255,255,255,0.5)" }} />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border p-8 md:p-14 text-center"
      style={{ background: "linear-gradient(135deg, #111 0%, #1a1a1a 50%, #111 100%)", borderColor: "#2a2a2a" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(34,197,94,0.07) 0%, transparent 70%)" }} />
      <div className="relative">
        <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-6"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
          Marketplace Digital Terpercaya
        </div>
        <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: "#f5f5f5" }}>
          Produk Digital<br />
          <span style={{ color: "#22c55e" }}>Berkualitas</span> untuk Bisnismu
        </h1>
        <p className="mb-8 max-w-lg mx-auto" style={{ color: "#a3a3a3" }}>
          Bot WhatsApp, Bot Telegram, Jasa Website, Script, Template — semua ada di sini.
        </p>
        <Link href="/search"
          className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-colors"
          style={{ background: "#22c55e", color: "#000" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#16a34a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}
        >
          <ShoppingBag className="w-5 h-5" />
          Lihat Semua Produk
        </Link>
      </div>
    </div>
  )
}
