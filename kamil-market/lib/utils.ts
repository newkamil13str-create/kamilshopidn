import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string }> = {
  "bot-whatsapp": { label: "Bot WhatsApp", icon: "🤖", color: "bg-green-900/50 text-green-400 border-green-800" },
  "bot-telegram": { label: "Bot Telegram", icon: "📱", color: "bg-blue-900/50 text-blue-400 border-blue-800" },
  "jasa-website": { label: "Jasa Website", icon: "🌐", color: "bg-purple-900/50 text-purple-400 border-purple-800" },
  "script": { label: "Script Website", icon: "📜", color: "bg-yellow-900/50 text-yellow-400 border-yellow-800" },
  "template": { label: "Template", icon: "🎨", color: "bg-pink-900/50 text-pink-400 border-pink-800" },
  "tools": { label: "Tools", icon: "🔧", color: "bg-orange-900/50 text-orange-400 border-orange-800" },
  "other": { label: "Lainnya", icon: "📦", color: "bg-gray-800 text-gray-400 border-gray-700" },
}

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Menunggu Pembayaran", color: "bg-yellow-900/50 text-yellow-400 border-yellow-800" },
  paid: { label: "Lunas", color: "bg-green-900/50 text-green-400 border-green-800" },
  failed: { label: "Gagal", color: "bg-red-900/50 text-red-400 border-red-800" },
  refunded: { label: "Refund", color: "bg-gray-800 text-gray-400 border-gray-700" },
}
