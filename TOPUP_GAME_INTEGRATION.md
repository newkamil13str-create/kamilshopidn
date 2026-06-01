# 🎮 Top Up Game Integration — Dokumentasi Merge

Proyek ini adalah gabungan dari:
1. **kamilshopidn-main** — OTP reseller site (base)
2. **topup-game-integration** — Modul top up game via Qiospay H2H
3. **daftar_harga.xlsx** — Referensi daftar harga produk Qiospay

---

## File yang ditambahkan / diubah

### Baru
| File | Keterangan |
|------|-----------|
| `lib/qiospay.ts` | Client Qiospay H2H (signature, transaksi, parse response) |
| `app/api/topup-game/route.ts` | Endpoint kirim transaksi ke Qiospay |
| `app/api/topup-game/callback/route.ts` | Endpoint callback dari Qiospay |
| `app/topup/page.tsx` | Halaman daftar semua game |
| `app/topup/[gameSlug]/page.tsx` | Halaman detail top up per game |
| `data/games.json` | Data statis game dan produk Qiospay |
| `.env.qiospay.example` | Contoh env vars Qiospay |

### Diupdate (superset dari versi asli)
| File | Perubahan |
|------|-----------|
| `types/index.ts` | Tambah field `productType`, `qiospayProduct`, `gameName`, `needsZoneId`, dll pada `Product` & `Order`; tambah interface `GameProduct`, `GameData` |
| `app/api/create-payment/route.ts` | Terima dan simpan field topup-game ke Firestore |
| `app/api/check-payment/route.ts` | `processDelivery()` cek `productType` — jika `topup-game` dispatch ke `/api/topup-game` |
| `store/index.ts` | `useCheckoutStore` + `topupGameData` state untuk menyimpan `gameDestination` & `gameZoneId` |
| `app/checkout/page.tsx` | Kirim field topup-game ke `create-payment` API |

---

## Setup Qiospay

1. Daftar akun di https://qiospay.id/mitra
2. Salin `.env.qiospay.example` ke `.env.local` lalu isi:
   ```
   QIOSPAY_MEMBER_ID=username_kamu
   QIOSPAY_PIN=1234
   QIOSPAY_PASSWORD=passwordkamu
   NEXT_PUBLIC_TOPUP_MARKUP=10
   ```
3. Daftarkan IP server di dashboard Qiospay → Integrasi transaksi → Transaksi IP
4. Daftarkan URL callback: `{NEXT_PUBLIC_SITE_URL}/api/topup-game/callback`

---

## Flow Topup Game

```
User pilih game & nominal
  → /topup/[gameSlug]
  → setSelectedProduct(..., { gameDestination, gameZoneId })
  → /checkout → create-payment (simpan order + topup fields ke Firestore)
  → /payment/[orderId] → tunggu pembayaran
  → Pakasir webhook → check-payment
  → processDelivery() → productType === 'topup-game'
  → POST /api/topup-game (kirim ke Qiospay H2H)
  → Qiospay callback → /api/topup-game/callback
  → Update order status → 'delivered' atau 'topup_failed'
```

---

## Markup Harga

Harga di `data/games.json` adalah harga supplier Qiospay. Markup diatur via env:
```
NEXT_PUBLIC_TOPUP_MARKUP=10   # 10% di atas harga supplier
```
