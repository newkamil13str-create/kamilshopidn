import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/telegram-setup?secret=YOUR_ADMIN_SECRET
 * Daftarkan webhook Telegram ke bot kamu.
 * Jalankan sekali setelah deploy.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN belum diset di .env' }, { status: 500 });
  }

  const webhookUrl = `${SITE_URL}/api/telegram`;

  // Set webhook
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
    }),
  });

  const data = await res.json();

  // Set bot commands untuk user
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Mulai / Menu utama' },
        { command: 'produk', description: 'Lihat semua produk' },
        { command: 'pesanan', description: 'Lihat pesanan saya' },
        { command: 'batal', description: 'Batalkan proses checkout' },
        { command: 'bantuan', description: 'Bantuan & cara order' },
      ],
      scope: { type: 'all_private_chats' },
    }),
  });

  // Set admin commands
  if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'admin', description: 'Panel admin' },
          { command: 'orders', description: 'Semua pesanan' },
          { command: 'products', description: 'Semua produk & stok' },
          { command: 'stats', description: 'Statistik toko' },
          { command: 'addstock', description: 'Tambah stok: /addstock PRODUCT_ID|KODE' },
          { command: 'delstock', description: 'Hapus stok terakhir: /delstock PRODUCT_ID' },
          { command: 'orderstatus', description: 'Update status: /orderstatus ORDER_ID STATUS' },
        ],
        scope: {
          type: 'chat',
          chat_id: Number(process.env.TELEGRAM_ADMIN_CHAT_ID),
        },
      }),
    });
  }

  return NextResponse.json({
    success: true,
    webhook_url: webhookUrl,
    telegram_response: data,
    message: 'Webhook berhasil didaftarkan! Bot siap digunakan.',
  });
}
