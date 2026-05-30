# Daftar Perbaikan (Bug Fixes)

## 1. `next.config.mjs` — Config Deprecated ✅
**Masalah:** `experimental.serverComponentsExternalPackages` sudah tidak valid di Next.js 14.1+
**Fix:** Dipindahkan ke top-level sebagai `serverExternalPackages`

## 2. `lib/firebase.ts` — Lazy Initialization ✅
**Masalah:** Firebase diinisialisasi langsung saat import, bisa crash di SSR jika `window` tidak ada
**Fix:** Semua instansi Firebase diinisialisasi secara lazy (hanya saat dipanggil) menggunakan fungsi getter

## 3. `lib/firebase-admin.ts` — Shared Admin Helper (NEW FILE) ✅
**Masalah:** Setiap API route melakukan `initializeApp` sendiri-sendiri → risiko multiple initialization
**Fix:** Dibuat file helper terpusat `lib/firebase-admin.ts` dengan fungsi `getAdminDb()`

## 4. `lib/auth.ts` — Guard `document.cookie` ✅
**Masalah:** `document.cookie` diakses tanpa pengecekan, crash jika dipanggil di context server
**Fix:** Ditambahkan `if (typeof document !== 'undefined')` sebelum akses cookie

## 5. `app/sitemap.ts` — Pakai Firebase Admin SDK ✅
**Masalah:** Sitemap adalah Server Component tapi menggunakan Firebase **Client** SDK
**Fix:** Diganti pakai Firebase Admin SDK via `getAdminDb()` yang aman di server

## 6. `app/api/create-payment/route.ts` — Shared Admin Helper ✅
**Fix:** Menggunakan `getAdminDb()` dari `lib/firebase-admin.ts`, bukan init ulang

## 7. `app/api/check-payment/route.ts` — Race Condition Fix ✅
**Masalah:** Stock produk diambil dengan `update` biasa → dua pembayaran bersamaan bisa dapat item sama
**Fix:** Menggunakan Firestore **Transaction** (`runTransaction`) untuk claim stock secara atomic

## 8. `app/admin/products/page.tsx` — Lazy Storage Getter ✅
**Masalah:** `storage` diimpor langsung dan bisa `undefined` sebelum Firebase init
**Fix:** Menggunakan `getStorage()` (lazy getter) langsung saat upload, bukan impor langsung

## 9. `.env.local` — Template Diperjelas ✅
**Fix:** Ditambahkan komentar lengkap di setiap variabel agar lebih mudah dikonfigurasi

---

## Yang Perlu Dilakukan Sebelum Deploy

1. **Isi semua value di `.env.local`** — tanpa ini app tidak bisa jalan
2. **Aktifkan Firebase Phone Authentication** di Firebase Console → Authentication → Sign-in method
3. **Daftarkan domain production** di Firebase Console → Authentication → Settings → Authorized domains
4. **Aktifkan Firebase Storage** di Firebase Console → Storage
5. **Setup Firebase Admin SDK** — download Service Account JSON dari Firebase Console → Project Settings → Service accounts
