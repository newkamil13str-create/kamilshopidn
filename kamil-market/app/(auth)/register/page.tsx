"use client"
import { useState } from "react"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, setDoc, collection, getCountFromServer } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Timestamp } from "firebase/firestore"

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2a2a2a",
    borderRadius: 8, color: "#f5f5f5", fontSize: 14, outline: "none",
  }

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) { setError("Semua field wajib diisi"); return }
    if (form.password !== form.confirm) { setError("Password tidak cocok"); return }
    if (form.password.length < 6) { setError("Password minimal 6 karakter"); return }

    setLoading(true); setError("")
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(cred.user, { displayName: form.name })

      const usersRef = collection(db, "users")
      const countSnap = await getCountFromServer(usersRef)
      const isFirst = countSnap.data().count === 0

      await setDoc(doc(db, "users", cred.user.uid), {
        email: form.email,
        displayName: form.name,
        photoURL: null,
        role: isFirst ? "admin" : "user",
        createdAt: Timestamp.now(),
      })

      router.push("/login?msg=registered")
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === "auth/email-already-in-use") setError("Email sudah terdaftar")
      else if (code === "auth/weak-password") setError("Password terlalu lemah")
      else setError("Gagal mendaftar, coba lagi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🛍️</div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>
            KAMIL <span style={{ color: "#22c55e" }}>MARKET</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "#a3a3a3" }}>Buat akun baru</p>
        </div>

        <div className="rounded-2xl p-6 space-y-4" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          {[
            { key: "name", label: "Nama Lengkap", type: "text", placeholder: "Nama lengkap Anda" },
            { key: "email", label: "Email", type: "email", placeholder: "email@contoh.com" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm mb-1.5" style={{ color: "#a3a3a3" }}>{field.label}</label>
              <input type={field.type} value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                placeholder={field.placeholder} style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
            </div>
          ))}

          {[
            { key: "password", label: "Password" },
            { key: "confirm", label: "Konfirmasi Password" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm mb-1.5" style={{ color: "#a3a3a3" }}>{field.label}</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={form[field.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                {field.key === "password" && (
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#a3a3a3" }}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ background: "rgba(153,27,27,0.3)", border: "1px solid #991b1b", color: "#f87171" }}>
              {error}
            </div>
          )}

          <button onClick={handleRegister} disabled={loading}
            className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            style={{ background: "#22c55e", color: "#000", opacity: loading ? 0.7 : 1 }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#16a34a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}>
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? "Mendaftar..." : "Daftar"}
          </button>

          <p className="text-center text-sm" style={{ color: "#a3a3a3" }}>
            Sudah punya akun?{" "}
            <Link href="/login" style={{ color: "#22c55e" }}>Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
