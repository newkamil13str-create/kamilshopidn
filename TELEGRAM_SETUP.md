# 🤖 Panduan Setup Bot Telegram — KAMIL-SHOP

Bot Telegram ini **satu sistem** dengan website. Firestore yang sama, stok yang sama.
Update produk/stok di website → langsung keliatan di bot, dan sebaliknya.

---

## 1. Buat Bot di Telegram

1. Buka Telegram, cari **@BotFather**
2. Ketik `/newbot`
3. Isi nama bot (misal: `KAMIL SHOP`)
4. Isi username bot (misal: `kamilshop_bot`) — harus diakhiri `bot`
5. Copy **token** yang diberikan (format: `1234567890:ABCdef...`)

---

## 2. Dapat Chat ID Kamu (Admin)

1. Buka Telegram, cari **@userinfobot**
2. Ketik `/start`
3. Copy **Id** yang muncul (angka, misal: `123456789`)

---

## 3. Set Environment Variables

Tambahkan ke `.env.local` (atau di Vercel → Settings → Environment Variables):

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxyz
TELEGRAM_ADMIN_CHAT_ID=123456789
ADMIN_SECRET=rahasia_random_kamu_bebas_isi_apa
```

---

## 4. Deploy & Daftarkan Webhook

Setelah deploy ke Vercel/server, buka URL ini sekali:

```
https://your-app.vercel.app/api/telegram-setup?secret=rahasia_random_kamu_bebas_isi_apa
```

Kalau berhasil, response JSON akan menunjukkan `"success": true`.

**Selesai!** Bot langsung aktif.

---

## 5. Test Bot

- Cari username bot kamu di Telegram
- Ketik `/start`
- Harusnya muncul menu utama

Untuk admin: ketik `/admin` — akan muncul panel admin lengkap.

---

## Fitur Bot (User)

| Perintah | Fungsi |
|----------|--------|
| `/start` atau `/menu` | Menu utama |
| `/produk` | Lihat semua produk aktif + stok realtime |
| `/pesanan` | Lihat riwayat pesanan kamu |
| `/batal` | Batalkan proses checkout |
| `/bantuan` | Cara order & bantuan |

**Alur Order di Bot:**
1. `/produk` → pilih produk
2. Klik **Beli Sekarang**
3. Isi nama → email → nomor WA
4. Pilih metode pembayaran
5. Bot buat order via API yang sama dengan website
6. Bayar sesuai instruksi
7. Produk otomatis dikirim ke email setelah konfirmasi

---

## Fitur Admin (`/admin`)

| Perintah | Fungsi |
|----------|--------|
| `/admin` | Dashboard admin |
| `/orders` | Lihat 15 pesanan terbaru |
| `/products` | Semua produk + jumlah stok |
| `/stats` | Total revenue, orders, users |
| `/addstock PRODUCT_ID\|KODE_STOK` | Tambah 1 stok ke produk |
| `/delstock PRODUCT_ID` | Hapus stok terakhir produk |
| `/orderstatus ORDER_ID STATUS` | Update status order |

**Contoh:**
```
/addstock abc123|KEY-BARU-001
/orderstatus TG-1234-ABCDE delivered
```

**Status valid:** `pending`, `paid`, `delivered`, `failed`, `cancelled`

---

## Notifikasi Otomatis ke Admin

Setiap kali ada pembayaran berhasil dari **website maupun bot**, kamu akan dapat notifikasi Telegram berisi:
- Order ID
- Nama produk
- Nama & email customer
- Total bayar
- Status pengiriman (berhasil/stok habis)

---

## Satu Sistem, Dua Channel

```
Website ──┐
          ├── Firestore (satu database) ←→ Stok, Order, Produk, Settings
Bot TG  ──┘
```

- Update stok di website admin → langsung berkurang di bot
- Order dari bot → muncul di admin website di `/admin/orders`
- Tambah produk baru di website → langsung bisa dibeli di bot

---

## File yang Ditambahkan

```
web/app/api/telegram/route.ts        ← Handler bot Telegram (semua logic)
web/app/api/telegram-setup/route.ts  ← Daftarkan webhook ke Telegram (sekali run)
web/app/api/webhook/route.ts         ← Updated: + notif Telegram saat order paid
web/.env.local                       ← Updated: + TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, ADMIN_SECRET
```
