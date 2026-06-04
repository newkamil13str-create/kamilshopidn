"use client"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function SearchBar() {
  const [q, setQ] = useState("")
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <form onSubmit={handleSearch} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#a3a3a3" }} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari produk digital..."
        className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-colors"
        style={{
          background: "#0a0a0a",
          border: "1px solid #2a2a2a",
          color: "#f5f5f5",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
      />
    </form>
  )
}
