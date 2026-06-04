"use client"
import { useEffect, useState } from "react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Category } from "@/types"
import { Plus, Trash2, Save } from "lucide-react"

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: "", slug: "", icon: "📦", order: 0, isActive: true })

  const load = async () => {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("order")))
    setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.name || !form.slug) return
    await addDoc(collection(db, "categories"), { ...form, createdAt: Timestamp.now() })
    setForm({ name: "", slug: "", icon: "📦", order: 0, isActive: true })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kategori?")) return
    await deleteDoc(doc(db, "categories", id))
    load()
  }

  const handleToggle = async (cat: Category) => {
    await updateDoc(doc(db, "categories", cat.id), { isActive: !cat.isActive })
    load()
  }

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px", background: "#111", border: "1px solid #2a2a2a",
    borderRadius: 6, color: "#f5f5f5", fontSize: 13, outline: "none",
  }

  if (loading) return (
    <div className="flex justify-center py-20" style={{ color: "#22c55e" }}>
      <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#f5f5f5" }}>Kelola Kategori</h1>

      {/* Add form */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
        <h2 className="font-semibold mb-4 text-sm" style={{ color: "#f5f5f5" }}>Tambah Kategori Baru</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { key: "name", label: "Nama", placeholder: "Bot WhatsApp" },
            { key: "slug", label: "Slug", placeholder: "bot-whatsapp" },
            { key: "icon", label: "Icon (emoji)", placeholder: "🤖" },
            { key: "order", label: "Urutan", placeholder: "0", type: "number" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs mb-1" style={{ color: "#a3a3a3" }}>{f.label}</label>
              <input type={f.type ?? "text"} placeholder={f.placeholder}
                value={(form as Record<string, unknown>)[f.key] as string}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                style={{ ...inputStyle, width: "100%" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
            </div>
          ))}
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "#22c55e", color: "#000" }}>
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">{cat.icon}</span>
              <div>
                <div className="font-medium text-sm" style={{ color: "#f5f5f5" }}>{cat.name}</div>
                <div className="text-xs" style={{ color: "#a3a3a3" }}>/{cat.slug} · Urutan {cat.order}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleToggle(cat)}
                className="text-xs px-2 py-1 rounded-full border"
                style={{ borderColor: cat.isActive ? "#22c55e" : "#2a2a2a", color: cat.isActive ? "#22c55e" : "#a3a3a3" }}>
                {cat.isActive ? "Aktif" : "Nonaktif"}
              </button>
              <button onClick={() => handleDelete(cat.id)} style={{ color: "#f87171" }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
