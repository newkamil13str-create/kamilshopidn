import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/components/auth/AuthProvider'
import './globals.css'

const geist = Inter({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: { default: 'KAMIL OTP — Virtual Phone Number Indonesia', template: '%s | KAMIL OTP' },
  description: 'Beli nomor OTP virtual instan dari 200+ negara. Layanan Telegram, WhatsApp, Google, dll. Bayar QRIS mudah.',
  keywords: ['nomor otp', 'virtual phone number', 'sms otp', 'beli nomor telegram', 'nomor virtual indonesia'],
  authors: [{ name: 'KAMIL OTP' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://otp.kamilshop.my.id'),
  openGraph: {
    title: 'KAMIL OTP — Virtual Phone Number Indonesia',
    description: 'Beli nomor OTP virtual instan dari 200+ negara.',
    url: 'https://otp.kamilshop.my.id',
    siteName: 'KAMIL OTP',
    locale: 'id_ID',
    type: 'website',
  },
  manifest: '/manifest.json',
  themeColor: '#06B6D4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-[#0A0A0F] text-white min-h-screen`}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1A1A2E',
                color: '#fff',
                border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: '12px',
              },
              success: { iconTheme: { primary: '#06B6D4', secondary: '#0A0A0F' } },
              error: { iconTheme: { primary: '#f87171', secondary: '#0A0A0F' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
