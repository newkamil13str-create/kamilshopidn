"use client"
import { useEffect, useState } from "react"
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import type { SiteSettings } from "@/types"
import { Save, Upload, Loader2, X } from "lucide-react"

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<SiteSettings>>({
    siteName: "KAMIL MARKET",
    siteDescription: "",
    bannerImages: [],
    flashSaleActive: false,
    whatsappNumber: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [flashEndDate, setFlashEndDate] = useState("")

  useEffect(() => {
    getDoc(doc(db, "settings", "main")).then((d) => {
      if (d.exists()) {
        const data = d.data() as SiteSettings
        setSettings(data)
        if (data.flashSaleEndAt) {
          const date = (data.flashSaleEndAt as any).toDate()
          setFlashEndDate(date.toISOString().slice(0, 16))
        }
      }
      setLoading(false)
    })
  }, [])

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const r = ref(storage, `banners/${Date.now()}_${file.name}`)
    await uploadBytes(r, file)
    const url = await getDownloadURL(r)
    setSettings((prev) => ({ ...prev, bannerImages: [...(prev.bannerImages ?? []), url] }))
    setUploading(false)
  }

  const handleRemoveBanner = (url: string) => {
    setSettings((prev) => ({ ...prev, bannerImages: prev.bannerImages?.filter((b) => b !== url) }))
  }

  const handleSave = async () => {
    setSaving(true)
    const data: Record<string, unknown> = { ...settings }
    if (flashEndDate) data.flashSaleEndAt = Timestamp.fromDate(new Date(flashEndDate))
    await setDoc(doc(db, "settings", "main"), data, { merge: true })
    setSaving(false)
    alert("Pengaturan disimpan!")
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: "#111", border: "1px solid #2a2a2a",
    borderRadius: 6, color: "#f5f5f5", fontSize: 13, outline: "none",
  }

  if (loading) return (
    <div className="flex justify-center py-20" style={{ color: "#22c55e" }}>
      <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#f5f5f5" }}>Pengaturan Toko</h1>

      <div className="space-y-6">
        {/* General */}
        <div className="p-5 rounded-xl" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#f5f5f5" }}>Info Toko</h2>
          <div className="space-y-3">
            {[
              { key: "siteName", label: "Nama Toko" },
              { key: "siteDescription", label: "Deskripsi Toko" },
              { key: "whatsappNumber", label: "Nomor WhatsApp (62xxx)" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs mb-1" style={{ color: "#a3a3a3" }}>{f.label}</label>
                <input value={(settings as Record<string, unknown>)[f.key] as string ?? ""}
                  onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
              </div>
            ))}
          </div>
        </div>

        {/* Banner */}
        <div className="p-5 rounded-xl" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#f5f5f5" }}>Banner Homepage</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {settings.bannerImages?.map((url) => (
              <div key={url} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "16/6" }}>
                <img src={url} className="w-full h-full object-cover" alt="" />
                <button onClick={() => handleRemoveBanner(url)}
                  className="absolute top-1 right-1 p-1 rounded-full"
                  style={{ background: "rgba(0,0,0,0.7)", color: "#f87171" }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="flex items-center justify-center gap-2 py-2 rounded-lg border cursor-pointer text-sm"
            style={{ borderColor: "#2a2a2a", color: "#a3a3a3", borderStyle: "dashed" }}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Banner
            <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
          </label>
        </div>

        {/* Flash Sale */}
        <div className="p-5 rounded-xl" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          <h2 className="font-semibold mb-4" style={{ color: "#f5f5f5" }}>Flash Sale</h2>
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <div
              onClick={() => setSettings({ ...settings, flashSaleActive: !settings.flashSaleActive })}
              className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
              style={{ background: settings.flashSaleActive ? "#22c55e" : "#2a2a2a" }}>
              <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: settings.flashSaleActive ? "translateX(22px)" : "translateX(4px)" }} />
            </div>
            <span className="text-sm" style={{ color: "#f5f5f5" }}>
              Flash Sale {settings.flashSaleActive ? "Aktif 🔥" : "Nonaktif"}
            </span>
          </label>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#a3a3a3" }}>Waktu Berakhir</label>
            <input type="datetime-local" value={flashEndDate} onChange={(e) => setFlashEndDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2"
          style={{ background: "#22c55e", color: "#000", opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>
    </div>
  )
}
