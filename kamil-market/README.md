# 🛍️ KAMIL MARKET

Marketplace produk digital modern dengan Next.js 14, Firebase, dan Pakasir.

**Domain:** [market.kamilshop.my.id](https://market.kamilshop.my.id)

---

## ⚡ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 14 App Router + Turbopack |
| Auth | NextAuth.js v5 (Google, GitHub, Email/OTP) |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| Payment | Pakasir (QRIS + URL Redirect) |
| Email | Nodemailer + Gmail SMTP |
| Styling | Tailwind CSS |
| Deploy | Vercel |

---

## 🚀 Setup & Instalasi

### 1. Clone & Install

```bash
git clone <repo-url>
cd kamil-market
npm install
```

### 2. Konfigurasi Environment

```bash
cp .env.local.example .env.local
# Edit .env.local dengan semua credentials Anda
```

### 3. Setup Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com)
2. Pilih project `kamil-shop-3443b`
3. Aktifkan **Authentication** → Email/Password + Google + GitHub
4. Aktifkan **Firestore Database** → Start in production mode
5. Aktifkan **Storage**
6. Buat **Firestore indexes** berikut:
   - `products`: `isActive ASC, createdAt DESC`
   - `products`: `isActive ASC, category ASC`
   - `orders`: `buyerUid ASC, createdAt DESC`

### 4. Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /orders/{id} {
      allow read: if request.auth != null && 
        (resource.data.buyerUid == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow create: if true;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /reviews/{id} {
      allow read: if true;
      allow create: if request.auth != null;
    }
    match /settings/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /otpCodes/{email} {
      allow read, write: if false; // Server-side only via Admin SDK
    }
    match /categories/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 5. Setup Google OAuth

1. [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth Client ID
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://market.kamilshop.my.id/api/auth/callback/google`

### 6. Setup GitHub OAuth

1. github.com → Settings → Developer settings → OAuth Apps → New
2. Homepage URL: `https://market.kamilshop.my.id`
3. Callback URL: `https://market.kamilshop.my.id/api/auth/callback/github`

### 7. Setup Gmail App Password

1. myaccount.google.com → Security → 2-Step Verification (aktifkan dulu)
2. App passwords → Select app: Mail → Generate
3. Salin 16-karakter app password ke `GMAIL_APP_PASS`

### 8. Setup Pakasir

1. Daftar/login di [app.pakasir.com](https://app.pakasir.com)
2. Buat project dengan slug `kamil13str`
3. Settings → API Key → Salin ke `PAKASIR_API_KEY`
4. Webhook URL: `https://market.kamilshop.my.id/api/webhook/pakasir`

---

## 🖥️ Development

```bash
npm run dev       # Jalankan dengan Turbopack
npm run build     # Build production
npm run start     # Jalankan production build
```

---

## 📁 Struktur Folder

```
kamil-market/
├── app/
│   ├── (auth)/          # Login & Register pages
│   ├── (dashboard)/     # Admin dashboard (protected)
│   ├── (shop)/          # Halaman publik marketplace
│   ├── (account)/       # Halaman user (protected)
│   └── api/             # API routes
├── components/
│   ├── shop/            # ProductCard, HeroSection, dll
│   ├── checkout/        # CheckoutModal, QRISDisplay, dll
│   └── layout/          # Navbar, Footer
├── lib/                 # Firebase, Pakasir, Email, Utils
└── types/               # TypeScript type definitions
```

---

## 🔑 Role System

- **User pertama** yang register → otomatis jadi **admin**
- **Admin** bisa akses `/dashboard`
- **User biasa** hanya bisa akses `/account`

---

## 💳 Payment Flow

```
Checkout → POST /api/orders/create
  → QRIS: tampil QRISDisplay + polling 3 detik
  → URL: redirect ke Pakasir payment page
    → User bayar
    → Pakasir POST /api/webhook/pakasir
      → Update order status = "paid"
      → Update stok produk
      → Kirim email produk via Gmail
```

---

## 📦 Deploy ke Vercel

```bash
npm i -g vercel
vercel --prod
```

Pastikan semua environment variables sudah diset di Vercel Dashboard.

---

## 📝 Lisensi

© 2025 KAMIL MARKET · Dibuat dengan ❤️ menggunakan Next.js + Firebase
