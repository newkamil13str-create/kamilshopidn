import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Providers } from "./providers"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: {
    default: "KAMIL MARKET — Marketplace Produk Digital",
    template: "%s | KAMIL MARKET",
  },
  description:
    "Marketplace produk digital terpercaya. Bot WhatsApp, Bot Telegram, Jasa Website, Script, Template, dan lebih banyak lagi.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://market.kamilshop.my.id"
  ),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} bg-bg-primary text-text-primary min-h-screen flex flex-col`}
        style={{ backgroundColor: "#0a0a0a", color: "#f5f5f5" }}
      >
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
