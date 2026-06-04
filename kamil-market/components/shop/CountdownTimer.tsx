"use client"
import { useEffect, useState } from "react"

interface Props {
  endAt: Date
  size?: "sm" | "md" | "lg"
  onExpire?: () => void
}

export default function CountdownTimer({ endAt, size = "md", onExpire }: Props) {
  const [t, setT] = useState({ h: 0, m: 0, s: 0, expired: false })

  useEffect(() => {
    const calc = () => {
      const diff = endAt.getTime() - Date.now()
      if (diff <= 0) { setT({ h: 0, m: 0, s: 0, expired: true }); onExpire?.(); return }
      setT({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false,
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [endAt, onExpire])

  if (t.expired) return null

  const pad = (n: number) => String(n).padStart(2, "0")

  const boxStyle: React.CSSProperties = {
    background: "rgba(153,27,27,0.4)",
    border: "1px solid #991b1b",
    borderRadius: size === "lg" ? 8 : 4,
    color: "#f87171",
    fontFamily: "monospace",
    fontWeight: "bold",
    fontSize: size === "lg" ? 24 : size === "sm" ? 11 : 13,
    padding: size === "lg" ? "8px 12px" : size === "sm" ? "2px 6px" : "3px 8px",
    minWidth: size === "lg" ? 52 : undefined,
    textAlign: "center" as const,
  }

  return (
    <div className="flex items-center gap-1">
      <span style={boxStyle}>{pad(t.h)}</span>
      <span style={{ color: "#f87171", fontWeight: "bold" }}>:</span>
      <span style={boxStyle}>{pad(t.m)}</span>
      <span style={{ color: "#f87171", fontWeight: "bold" }}>:</span>
      <span style={boxStyle}>{pad(t.s)}</span>
    </div>
  )
}
