"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CATEGORY_MAP } from "@/lib/utils"

export default function CategoryBar() {
  const pathname = usePathname()

  const categories = [
    { slug: "semua", label: "🔥 Semua", href: "/" },
    ...Object.entries(CATEGORY_MAP).map(([slug, data]) => ({
      slug,
      label: `${data.icon} ${data.label}`,
      href: `/category/${slug}`,
    })),
  ]

  return (
    <div className="overflow-x-auto scrollbar-none">
      <div className="flex gap-2 pb-1 min-w-max px-1">
        {categories.map((cat) => {
          const isActive = (cat.slug === "semua" && pathname === "/") || pathname === cat.href
          return (
            <Link
              key={cat.slug}
              href={cat.href}
              className="px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all"
              style={{
                background: isActive ? "rgba(34,197,94,0.1)" : "#1a1a1a",
                borderColor: isActive ? "#22c55e" : "#2a2a2a",
                color: isActive ? "#22c55e" : "#a3a3a3",
              }}
            >
              {cat.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
