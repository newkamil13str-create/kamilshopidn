import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/components/shared/AuthProvider';
import TurnstileGate from '@/components/shared/TurnstileGate';

export const metadata: Metadata = {
  title: {
    default: 'KAMIL-SHOP — Toko Produk Digital Terpercaya',
    template: '%s | KAMIL-SHOP',
  },
  description: 'Beli produk digital terpercaya di KAMIL-SHOP. Akun premium, script, tools, bot WA & Telegram. Pengiriman otomatis, harga terjangkau, transaksi aman.',
  keywords: ['kamil shop', 'toko digital', 'akun premium', 'jual akun', 'script', 'tools digital', 'bot whatsapp', 'bot telegram', 'kamilshop'],
  authors: [{ name: 'KAMIL-SHOP', url: 'https://kamilshop.my.id' }],
  creator: 'KAMIL-SHOP',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://kamilshop.my.id'),
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: 'https://kamilshop.my.id',
    siteName: 'KAMIL-SHOP',
    title: 'KAMIL-SHOP — Solusi Digital Terpercaya #1',
    description: 'Platform jual beli produk digital terbaik dan terpercaya di Indonesia.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'KAMIL-SHOP' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KAMIL-SHOP — Solusi Digital Terpercaya #1',
    description: 'Platform jual beli produk digital terbaik dan terpercaya di Indonesia.',
    images: ['/og-image.png'],
  },
  verification: {
    google: 'I6EsQEa4y0WJaHqhM2eHzUMaMTb84GM_ukNwiPMxhPE',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <TurnstileGate />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#141929',
                color: '#fff',
                border: '1px solid rgba(37,99,235,0.3)',
                borderRadius: '12px',
                fontFamily: 'DM Sans, sans-serif',
              },
              success: {
                iconTheme: { primary: '#F59E0B', secondary: '#141929' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: '#141929' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
