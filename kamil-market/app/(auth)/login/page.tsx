"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

type Tab = "google" | "github" | "form"
type LoginType = "password" | "otp"

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("google")
  const [loginType, setLoginType] = useState<LoginType>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirect = searchParams.get("redirect") ?? "/"

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2a2a2a",
    borderRadius: 8, color: "#f5f5f5", fontSize: 14, outline: "none",
  }

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setLoading(true)
    await signIn(provider, { callbackUrl: redirect })
  }

  const handleSendOTP = async () => {
    if (!email) { setError("Email wajib diisi"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOtpSent(true)
      setMsg("OTP terkirim! Cek email Anda.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim OTP")
    } finally {
      setLoading(false)
    }
  }

  const handleFormLogin = async () => {
    if (!email) { setError("Email wajib diisi"); return }
    if (loginType === "password" && !password) { setError("Password wajib diisi"); return }
    if (loginType === "otp" && !otp) { setError("OTP wajib diisi"); return }
    setLoading(true); setError("")
    try {
      const res = await signIn("credentials", {
        email, password, otp, loginType, redirect: false,
      })
      if (res?.error) throw new Error("Email atau password/OTP salah")
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal")
    } finally {
      setLoading(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "google", label: "Google" },
    { key: "github", label: "GitHub" },
    { key: "form", label: "Email" },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🛍️</div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>
            KAMIL <span style={{ color: "#22c55e" }}>MARKET</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "#a3a3a3" }}>Masuk ke akun Anda</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          {/* Tabs */}
          <div className="flex mb-6 p-1 rounded-xl" style={{ background: "#111" }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => { setTab(t.key); setError(""); setMsg("") }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: tab === t.key ? "#1a1a1a" : "transparent",
                  color: tab === t.key ? "#22c55e" : "#a3a3a3",
                  border: tab === t.key ? "1px solid #2a2a2a" : "1px solid transparent",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Google */}
          {tab === "google" && (
            <button onClick={() => handleOAuthLogin("google")} disabled={loading}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-3 transition-colors border"
              style={{ border: "1px solid #2a2a2a", color: "#f5f5f5", background: "#111" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Login dengan Google
            </button>
          )}

          {/* GitHub */}
          {tab === "github" && (
            <button onClick={() => handleOAuthLogin("github")} disabled={loading}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-3 transition-colors border"
              style={{ border: "1px solid #2a2a2a", color: "#f5f5f5", background: "#111" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              Login dengan GitHub
            </button>
          )}

          {/* Form */}
          {tab === "form" && (
            <div className="space-y-4">
              {/* Toggle Password/OTP */}
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#a3a3a3" }}>Metode login:</span>
                <div className="flex p-0.5 rounded-lg" style={{ background: "#111", border: "1px solid #2a2a2a" }}>
                  {(["password", "otp"] as LoginType[]).map((type) => (
                    <button key={type} onClick={() => { setLoginType(type); setError(""); setMsg(""); setOtpSent(false) }}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={{
                        background: loginType === type ? "#22c55e" : "transparent",
                        color: loginType === type ? "#000" : "#a3a3a3",
                      }}>
                      {type === "password" ? "Password" : "OTP Email"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: "#a3a3a3" }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@contoh.com" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
              </div>

              {loginType === "password" && (
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: "#a3a3a3" }}>Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password" style={{ ...inputStyle, paddingRight: 40 }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#a3a3a3" }}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {loginType === "otp" && (
                <>
                  <button onClick={handleSendOTP} disabled={loading || otpSent}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors border"
                    style={{
                      borderColor: otpSent ? "#2a2a2a" : "#22c55e",
                      color: otpSent ? "#a3a3a3" : "#22c55e",
                      background: "transparent",
                      opacity: loading ? 0.7 : 1,
                    }}>
                    {loading ? "Mengirim..." : otpSent ? "✓ OTP Terkirim" : "Kirim OTP ke Email"}
                  </button>
                  {otpSent && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: "#a3a3a3" }}>Kode OTP (6 digit)</label>
                      <input value={otp} onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456" maxLength={6} style={{ ...inputStyle, letterSpacing: 8, textAlign: "center", fontSize: 20 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="text-sm p-3 rounded-lg" style={{ background: "rgba(153,27,27,0.3)", border: "1px solid #991b1b", color: "#f87171" }}>
                  {error}
                </div>
              )}
              {msg && (
                <div className="text-sm p-3 rounded-lg" style={{ background: "rgba(20,83,45,0.3)", border: "1px solid #166534", color: "#86efac" }}>
                  {msg}
                </div>
              )}

              <button onClick={handleFormLogin} disabled={loading}
                className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                style={{ background: "#22c55e", color: "#000", opacity: loading ? 0.7 : 1 }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#16a34a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#22c55e")}>
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </div>
          )}

          <p className="text-center text-sm mt-5" style={{ color: "#a3a3a3" }}>
            Belum punya akun?{" "}
            <Link href="/register" style={{ color: "#22c55e" }}>Daftar sekarang</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
