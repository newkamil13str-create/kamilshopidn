"use client"
import { useEffect, useState } from "react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, Timestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import type { Product, ProductCategory } from "@/types"
import { formatRupiah, CATEGORY_MAP, slugify } from "@/lib/utils"
import { Plus, Edit2, Trash2, X, Upload, Loader2 } from "lucide-react"

const EMPTY_FORM = {
  name: "", slug: "", shortDesc: "", description: "", price: 0, originalPrice: 0,
  category: "other" as ProductCategory, downloadUrl: "", deliveryType: "email" as "download" | "email" | "manual",
  deliveryContent: "", stock: -1, tags: "", isActive: true, isFeatured: false, isFlashSale: false,
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [thumbnail, setThumbnail] = useState("")

  const load = async () => {
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")))
    setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setThumbnail("")
    setShowModal(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name, slug: p.slug, shortDesc: p.shortDesc, description: p.description,
      price: p.price, originalPrice: p.originalPrice ?? 0, category: p.category,
      downloadUrl: p.downloadUrl ?? "", deliveryType: p.deliveryType,
      deliveryContent: p.deliveryContent ?? "",
      stock: p.stock === "unlimited" ? -1 : (p.stock as number),
      tags: p.tags?.join(", ") ?? "", isActive: p.isActive,
      isFeatured: p.isFeatured, isFlashSale: p.isFlashSale,
    })
    setThumbnail(p.thumbnail)
    setShowModal(true)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const r = ref(storage, `products/${Date.now()}_${file.name}`)
    await uploadBytes(r, file)
    const url = await getDownloadURL(r)
    setThumbnail(url)
    setUploading(false)
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const slug = form.slug || slugify(form.name)
    const data = {
      ...form,
      slug,
      thumbnail: thumbnail || "",
      images: thumbnail ? [thumbnail] : [],
      price: Number(form.price),
      originalPrice: Number(form.originalPrice) || null,
      stock: form.stock === -1 ? "unlimited" : Number(form.stock),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      sold: editing?.sold ?? 0,
      rating: editing?.rating ?? 0,
      reviewCount: editing?.reviewCount ?? 0,
      updatedAt: Timestamp.now(),
      ...(editing ? {} : { createdAt: Timestamp.now() }),
    }

    if (editing) {
      await updateDoc(doc(db, "products", editing.id), data)
    } else {
      await addDoc(collection(db, "products"), data)
    }

    setSaving(false)
    setShowModal(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus produk ini?")) return
    await deleteDoc(doc(db, "products", id))
    load()
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: "#0a0a0a", border: "1px solid #2a2a2a",
    borderRadius: 6, color: "#f5f5f5", fontSize: 13, outline: "none",
  }

  if (loading) return (
    <div className="flex justify-center py-20" style={{ color: "#22c55e" }}>
      <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Kelola Produk</h1>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          style={{ background: "#22c55e", color: "#000" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#16a34a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}>
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const cat = CATEGORY_MAP[p.category] ?? CATEGORY_MAP.other
          return (
            <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <img src={p.thumbnail || "/placeholder.png"} alt={p.name} className="w-full object-cover" style={{ height: 140 }} />
              <div className="p-4">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${cat.color}`}>{cat.icon} {cat.label}</span>
                <h3 className="font-semibold text-sm mt-2 mb-1 line-clamp-1" style={{ color: "#f5f5f5" }}>{p.name}</h3>
                <div className="font-bold text-sm mb-2" style={{ color: "#22c55e" }}>{formatRupiah(p.price)}</div>
                <div className="flex items-center gap-2 text-xs mb-3" style={{ color: "#a3a3a3" }}>
                  <span style={{ color: p.isActive ? "#22c55e" : "#f87171" }}>{p.isActive ? "✓ Aktif" : "✗ Nonaktif"}</span>
                  {p.isFeatured && <span style={{ color: "#facc15" }}>⭐ Featured</span>}
                  {p.isFlashSale && <span style={{ color: "#f87171" }}>🔥 Flash</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg border transition-colors"
                    style={{ borderColor: "#2a2a2a", color: "#a3a3a3" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors"
                    style={{ borderColor: "#991b1b", color: "#f87171" }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="w-full max-w-2xl rounded-2xl overflow-y-auto" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", maxHeight: "90vh" }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid #2a2a2a" }}>
              <h2 className="font-bold" style={{ color: "#f5f5f5" }}>{editing ? "Edit Produk" : "Tambah Produk"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#a3a3a3" }}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Thumbnail upload */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#a3a3a3" }}>Thumbnail</label>
                {thumbnail && <img src={thumbnail} className="w-full h-32 object-cover rounded-lg mb-2" alt="" />}
                <label className="flex items-center justify-center gap-2 py-2 rounded-lg border cursor-pointer text-sm transition-colors"
                  style={{ borderColor: "#2a2a2a", color: "#a3a3a3", borderStyle: "dashed" }}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : "Upload Gambar"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "name", label: "Nama Produk", col: 2 },
                  { key: "slug", label: "Slug (opsional)" },
                  { key: "shortDesc", label: "Deskripsi Singkat", col: 2 },
                  { key: "price", label: "Harga (Rp)", type: "number" },
                  { key: "originalPrice", label: "Harga Coret (Rp)", type: "number" },
                  { key: "downloadUrl", label: "URL Download", col: 2 },
                  { key: "deliveryContent", label: "Konten/Script (opsional)", col: 2 },
                  { key: "stock", label: "Stok (-1 = unlimited)", type: "number" },
                  { key: "tags", label: "Tags (pisah koma)" },
                ].map((f) => (
                  <div key={f.key} className={f.col === 2 ? "col-span-2" : ""}>
                    <label className="block text-xs mb-1" style={{ color: "#a3a3a3" }}>{f.label}</label>
                    <input type={f.type ?? "text"}
                      value={(form as Record<string, unknown>)[f.key] as string}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                  </div>
                ))}

                <div>
                  <label className="block text-xs mb-1" style={{ color: "#a3a3a3" }}>Kategori</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
                    style={inputStyle}>
                    {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "#a3a3a3" }}>Tipe Pengiriman</label>
                  <select value={form.deliveryType} onChange={(e) => setForm({ ...form, deliveryType: e.target.value as "download" | "email" | "manual" })}
                    style={inputStyle}>
                    <option value="download">Download Otomatis</option>
                    <option value="email">Via Email</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: "#a3a3a3" }}>Deskripsi (Markdown)</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4} style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
              </div>

              <div className="flex flex-wrap gap-4">
                {[
                  { key: "isActive", label: "Aktif" },
                  { key: "isFeatured", label: "Featured/Terlaris" },
                  { key: "isFlashSale", label: "Flash Sale" },
                ].map((toggle) => (
                  <label key={toggle.key} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#a3a3a3" }}>
                    <input type="checkbox" checked={(form as Record<string, unknown>)[toggle.key] as boolean}
                      onChange={(e) => setForm({ ...form, [toggle.key]: e.target.checked })}
                      className="w-4 h-4 accent-green-500" />
                    {toggle.label}
                  </label>
                ))}
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2"
                style={{ background: "#22c55e", color: "#000", opacity: saving ? 0.7 : 1 }}>
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                {saving ? "Menyimpan..." : "Simpan Produk"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
