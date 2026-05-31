import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

// ─── Telegram API Helper ───────────────────────────────────────────────────────
async function tg(method: string, body: Record<string, unknown>) {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMessage(chatId: string | number, text: string, extra?: Record<string, unknown>) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

async function editMessage(chatId: string | number, messageId: number, text: string, extra?: Record<string, unknown>) {
  return tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  return tg('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── User session state (in-memory, per restart) ──────────────────────────────
// For production scale, use Redis. This works fine for small shops.
type SessionState =
  | { step: 'idle' }
  | { step: 'await_product_select'; products: string[] }
  | { step: 'await_checkout_name'; productId: string; productName: string; price: number }
  | { step: 'await_checkout_email'; productId: string; productName: string; price: number; name: string }
  | { step: 'await_checkout_wa'; productId: string; productName: string; price: number; name: string; email: string }
  | { step: 'await_payment_method'; productId: string; productName: string; price: number; name: string; email: string; wa: string };

const sessions = new Map<number, SessionState>();

function getSession(userId: number): SessionState {
  return sessions.get(userId) || { step: 'idle' };
}
function setSession(userId: number, state: SessionState) {
  sessions.set(userId, state);
}
function clearSession(userId: number) {
  sessions.set(userId, { step: 'idle' });
}

// ─── Admin check ──────────────────────────────────────────────────────────────
function isAdmin(chatId: number | string) {
  return ADMIN_CHAT_ID && String(chatId) === String(ADMIN_CHAT_ID);
}

// ─── MAIN WEBHOOK ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    const callbackQuery = body.callback_query;

    if (callbackQuery) {
      await handleCallback(callbackQuery);
      return NextResponse.json({ ok: true });
    }

    if (message) {
      await handleMessage(message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Telegram Webhook]', err);
    return NextResponse.json({ ok: true }); // always return 200 to Telegram
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telegram bot active' });
}

// ─── Message handler ──────────────────────────────────────────────────────────
async function handleMessage(message: Record<string, unknown>) {
  const chatId = (message.chat as Record<string, unknown>)?.id as number;
  const userId = (message.from as Record<string, unknown>)?.id as number;
  const text = (message.text as string) || '';
  const firstName = ((message.from as Record<string, unknown>)?.first_name as string) || 'Kamu';

  if (!chatId) return;

  const session = getSession(userId);

  // ── Admin commands ──────────────────────────────────────────────────────────
  if (isAdmin(chatId)) {
    if (text === '/admin' || text === '/start') {
      return sendAdminMenu(chatId);
    }
    if (text === '/orders') return sendAdminOrders(chatId);
    if (text === '/products') return sendAdminProducts(chatId);
    if (text === '/stats') return sendAdminStats(chatId);
    if (text.startsWith('/addstock ')) {
      const parts = text.replace('/addstock ', '').split('|');
      if (parts.length >= 2) {
        return adminAddStock(chatId, parts[0].trim(), parts[1].trim());
      }
      return sendMessage(chatId, '❌ Format: <code>/addstock PRODUCT_ID|KODE_STOK</code>');
    }
    if (text.startsWith('/delstock ')) {
      const productId = text.replace('/delstock ', '').trim();
      return adminDeleteLastStock(chatId, productId);
    }
    if (text.startsWith('/orderstatus ')) {
      const [orderId, newStatus] = text.replace('/orderstatus ', '').split(' ');
      return adminUpdateOrderStatus(chatId, orderId, newStatus);
    }
  }

  // ── Public commands ─────────────────────────────────────────────────────────
  if (text === '/start' || text === '/menu') {
    clearSession(userId);
    return sendMainMenu(chatId, firstName);
  }

  if (text === '/produk' || text === '/products') {
    clearSession(userId);
    return sendProductList(chatId);
  }

  if (text === '/pesanan' || text === '/orders') {
    clearSession(userId);
    return sendUserOrders(chatId, userId);
  }

  if (text === '/bantuan' || text === '/help') {
    clearSession(userId);
    return sendHelp(chatId);
  }

  if (text === '/batal' || text === '/cancel') {
    clearSession(userId);
    return sendMessage(chatId, '✅ Pesanan dibatalkan. Ketik /menu untuk kembali ke menu utama.');
  }

  // ── Session-based flow ──────────────────────────────────────────────────────
  if (session.step === 'await_checkout_name') {
    if (text.length < 2) return sendMessage(chatId, '❌ Nama terlalu pendek. Masukkan nama lengkap kamu:');
    setSession(userId, { ...session, step: 'await_checkout_email', name: text });
    return sendMessage(chatId, `✅ Nama: <b>${escapeHtml(text)}</b>\n\n📧 Masukkan email kamu:\n<i>(untuk pengiriman produk)</i>`);
  }

  if (session.step === 'await_checkout_email') {
    if (!text.includes('@') || !text.includes('.')) {
      return sendMessage(chatId, '❌ Email tidak valid. Coba lagi:');
    }
    setSession(userId, { ...session, step: 'await_checkout_wa', email: text.toLowerCase().trim() });
    return sendMessage(chatId, `✅ Email: <b>${escapeHtml(text)}</b>\n\n📱 Masukkan nomor WhatsApp kamu:\n<i>Contoh: 08123456789</i>`);
  }

  if (session.step === 'await_checkout_wa') {
    const wa = text.replace(/\D/g, '');
    if (wa.length < 10) return sendMessage(chatId, '❌ Nomor WA tidak valid. Coba lagi:');
    setSession(userId, { ...session, step: 'await_payment_method', wa });
    return sendPaymentMethodMenu(chatId, session.productName, session.price);
  }

  // Default
  return sendMessage(
    chatId,
    '❓ Perintah tidak dikenali.\n\nKetik /menu untuk melihat menu utama.',
  );
}

// ─── Callback handler ─────────────────────────────────────────────────────────
async function handleCallback(query: Record<string, unknown>) {
  const chatId = ((query.message as Record<string, unknown>)?.chat as Record<string, unknown>)?.id as number;
  const messageId = ((query.message as Record<string, unknown>)?.message_id) as number;
  const userId = (query.from as Record<string, unknown>)?.id as number;
  const data = query.data as string;
  const cbId = query.id as string;

  await answerCallback(cbId);

  // ── Admin callbacks ──
  if (isAdmin(chatId)) {
    if (data === 'admin_orders') return sendAdminOrders(chatId);
    if (data === 'admin_products') return sendAdminProducts(chatId);
    if (data === 'admin_stats') return sendAdminStats(chatId);
    if (data === 'admin_menu') return sendAdminMenu(chatId);
    if (data.startsWith('admin_order_')) {
      const orderId = data.replace('admin_order_', '');
      return sendAdminOrderDetail(chatId, orderId);
    }
    if (data.startsWith('admin_mark_delivered_')) {
      const orderId = data.replace('admin_mark_delivered_', '');
      return adminMarkDelivered(chatId, orderId);
    }
    if (data.startsWith('admin_stock_')) {
      const productId = data.replace('admin_stock_', '');
      return sendAdminStockInfo(chatId, productId);
    }
  }

  // ── Public callbacks ──
  if (data === 'menu') {
    clearSession(userId);
    const firstName = ((query.from as Record<string, unknown>)?.first_name as string) || 'Kamu';
    return sendMainMenu(chatId, firstName);
  }

  if (data === 'products') {
    clearSession(userId);
    return sendProductList(chatId);
  }

  if (data === 'help') {
    return sendHelp(chatId);
  }

  if (data.startsWith('product_')) {
    const productId = data.replace('product_', '');
    return sendProductDetail(chatId, productId, userId);
  }

  if (data.startsWith('buy_')) {
    const productId = data.replace('buy_', '');
    return startCheckout(chatId, userId, productId);
  }

  if (data.startsWith('pay_')) {
    // pay_QRIS, pay_DANA, dst
    const method = data.replace('pay_', '');
    const session = getSession(userId);
    if (session.step !== 'await_payment_method') {
      return sendMessage(chatId, '❌ Sesi kadaluarsa. Ketik /menu untuk mulai lagi.');
    }
    return processPayment(chatId, userId, method, session);
  }

  if (data.startsWith('cek_order_')) {
    const orderId = data.replace('cek_order_', '');
    return sendOrderStatus(chatId, orderId);
  }

  if (data === 'my_orders') {
    return sendUserOrders(chatId, userId);
  }
}

// ─── PUBLIC: Main Menu ────────────────────────────────────────────────────────
async function sendMainMenu(chatId: number, name: string) {
  const text =
    `🛍️ <b>Selamat datang di KAMIL-SHOP, ${escapeHtml(name)}!</b>\n\n` +
    `Toko digital terpercaya untuk kebutuhan bot, akun premium, dan tools.\n\n` +
    `Pilih menu di bawah ini:`;

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 Lihat Produk', callback_data: 'products' },
          { text: '📦 Pesanan Saya', callback_data: 'my_orders' },
        ],
        [{ text: '❓ Bantuan', callback_data: 'help' }],
      ],
    },
  });
}

// ─── PUBLIC: Product List ─────────────────────────────────────────────────────
async function sendProductList(chatId: number) {
  const db = getAdminDb();
  const snap = await db
    .collection('products')
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .get();

  if (snap.empty) {
    return sendMessage(chatId, '😔 Belum ada produk tersedia saat ini.');
  }

  const products = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

  let text = '🛍️ <b>Daftar Produk Tersedia</b>\n\n';
  const keyboard: { text: string; callback_data: string }[][] = [];

  products.forEach((p, i) => {
    const stok = (p.stock as string[])?.length || 0;
    const badge = p.badge ? ` [${String(p.badge).toUpperCase()}]` : '';
    text += `${i + 1}. <b>${escapeHtml(p.name as string)}</b>${badge}\n`;
    text += `   💰 ${formatRupiah(p.price as number)}`;
    if (p.originalPrice && (p.originalPrice as number) > (p.price as number)) {
      text += ` <s>${formatRupiah(p.originalPrice as number)}</s>`;
    }
    text += `\n   📦 Stok: ${stok > 0 ? stok : '❌ Habis'}\n\n`;
    keyboard.push([{ text: `👁️ ${p.name as string}`, callback_data: `product_${p.id}` }]);
  });

  keyboard.push([{ text: '🏠 Menu Utama', callback_data: 'menu' }]);

  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ─── PUBLIC: Product Detail ───────────────────────────────────────────────────
async function sendProductDetail(chatId: number, productId: string, userId: number) {
  const db = getAdminDb();
  const doc = await db.collection('products').doc(productId).get();

  if (!doc.exists) {
    return sendMessage(chatId, '❌ Produk tidak ditemukan.');
  }

  const p = { id: doc.id, ...doc.data() } as Record<string, unknown>;
  const stok = (p.stock as string[])?.length || 0;
  const features = (p.features as string[]) || [];

  let text = `🏷️ <b>${escapeHtml(p.name as string)}</b>\n\n`;
  text += `📝 ${escapeHtml(p.description as string)}\n\n`;
  text += `💰 <b>Harga: ${formatRupiah(p.price as number)}</b>`;
  if (p.originalPrice && (p.originalPrice as number) > (p.price as number)) {
    const disc = Math.round((1 - (p.price as number) / (p.originalPrice as number)) * 100);
    text += ` <s>${formatRupiah(p.originalPrice as number)}</s> <b>(-${disc}%)</b>`;
  }
  text += `\n⭐ Rating: ${p.rating || 5}/5\n`;
  text += `📦 Stok: ${stok > 0 ? stok + ' tersisa' : '❌ Habis'}\n\n`;

  if (features.length > 0) {
    text += `✨ <b>Fitur:</b>\n`;
    features.forEach((f: string) => { text += `  ✅ ${escapeHtml(f)}\n`; });
  }

  const keyboard: { text: string; callback_data: string }[][] = [];
  if (stok > 0) {
    keyboard.push([{ text: '🛒 Beli Sekarang', callback_data: `buy_${productId}` }]);
  } else {
    keyboard.push([{ text: '❌ Stok Habis', callback_data: 'products' }]);
  }
  keyboard.push([
    { text: '◀️ Kembali', callback_data: 'products' },
    { text: '🏠 Menu', callback_data: 'menu' },
  ]);

  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ─── PUBLIC: Start Checkout ───────────────────────────────────────────────────
async function startCheckout(chatId: number, userId: number, productId: string) {
  const db = getAdminDb();
  const doc = await db.collection('products').doc(productId).get();

  if (!doc.exists || !(doc.data() as Record<string, unknown>).isActive) {
    return sendMessage(chatId, '❌ Produk tidak ditemukan.');
  }

  const p = { id: doc.id, ...doc.data() } as Record<string, unknown>;
  const stok = (p.stock as string[])?.length || 0;

  if (stok === 0) {
    return sendMessage(chatId, '❌ Maaf, stok produk ini sudah habis.');
  }

  setSession(userId, {
    step: 'await_checkout_name',
    productId,
    productName: p.name as string,
    price: p.price as number,
  });

  return sendMessage(
    chatId,
    `🛒 <b>Checkout: ${escapeHtml(p.name as string)}</b>\n` +
    `💰 Harga: <b>${formatRupiah(p.price as number)}</b>\n\n` +
    `Masukkan <b>nama lengkap</b> kamu:\n` +
    `<i>(Ketik /batal untuk membatalkan)</i>`,
  );
}

// ─── PUBLIC: Payment Method Menu ─────────────────────────────────────────────
async function sendPaymentMethodMenu(chatId: number, productName: string, price: number) {
  const text =
    `💳 <b>Pilih Metode Pembayaran</b>\n\n` +
    `Produk: <b>${escapeHtml(productName)}</b>\n` +
    `Total: <b>${formatRupiah(price)}</b>`;

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📱 QRIS', callback_data: 'pay_QRIS' },
          { text: '💙 DANA', callback_data: 'pay_DANA' },
        ],
        [
          { text: '🟢 OVO', callback_data: 'pay_OVO' },
          { text: '🏦 Transfer Bank', callback_data: 'pay_VA_BCA' },
        ],
        [{ text: '❌ Batal', callback_data: 'menu' }],
      ],
    },
  });
}

// ─── PUBLIC: Process Payment ──────────────────────────────────────────────────
async function processPayment(
  chatId: number,
  userId: number,
  method: string,
  session: Extract<SessionState, { step: 'await_payment_method' }>
) {
  clearSession(userId);

  const orderId = `TG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  try {
    // Hit our own /api/create-payment — same flow as website
    const res = await fetch(`${SITE_URL}/api/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        amount: session.price,
        orderId,
        productId: session.productId,
        productName: session.productName,
        customerData: {
          name: session.name,
          email: session.email,
          whatsApp: session.wa,
        },
        userId: `tg_${userId}`,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.payment) {
      return sendMessage(
        chatId,
        `❌ Gagal membuat pembayaran: ${data.error || 'Coba lagi nanti'}\n\nKetik /menu untuk kembali.`,
      );
    }

    const pay = data.payment;
    const expired = pay.expired_at
      ? new Date(pay.expired_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : '24 jam';

    let text = `✅ <b>Pesanan Berhasil Dibuat!</b>\n\n`;
    text += `📋 <b>Order ID:</b> <code>${orderId}</code>\n`;
    text += `🏷️ Produk: <b>${escapeHtml(session.productName)}</b>\n`;
    text += `💰 Total: <b>${formatRupiah(pay.total_payment || session.price)}</b>\n`;
    text += `💳 Metode: <b>${method}</b>\n`;
    text += `⏰ Bayar sebelum: <b>${expired}</b>\n\n`;

    if (pay.payment_number) {
      text += `📌 <b>Nomor Tujuan Bayar:</b>\n`;
      text += `<code>${pay.payment_number}</code>\n\n`;
    }

    text += `🔔 Produk akan otomatis dikirim ke email <b>${escapeHtml(session.email)}</b> setelah pembayaran terkonfirmasi.\n\n`;
    text += `<i>Simpan Order ID di atas untuk cek status pesanan.</i>`;

    return sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Cek Status Pesanan', callback_data: `cek_order_${orderId}` }],
          [{ text: '🛒 Beli Lagi', callback_data: 'products' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu' }],
        ],
      },
    });
  } catch (err) {
    console.error('[Telegram processPayment]', err);
    return sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.\n\nKetik /menu untuk kembali.');
  }
}

// ─── PUBLIC: Order Status ─────────────────────────────────────────────────────
async function sendOrderStatus(chatId: number, orderId: string) {
  const db = getAdminDb();
  const doc = await db.collection('orders').doc(orderId).get();

  if (!doc.exists) {
    return sendMessage(chatId, '❌ Order tidak ditemukan. Periksa kembali Order ID kamu.');
  }

  const order = doc.data() as Record<string, unknown>;
  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    paid: '✅',
    delivered: '📦',
    failed: '❌',
    cancelled: '🚫',
  };

  let text = `📋 <b>Status Pesanan</b>\n\n`;
  text += `🆔 <b>Order ID:</b> <code>${orderId}</code>\n`;
  text += `🏷️ Produk: <b>${escapeHtml(order.productName as string)}</b>\n`;
  text += `💰 Total: <b>${formatRupiah(order.totalPayment as number || order.amount as number)}</b>\n`;
  text += `${statusEmoji[order.status as string] || '❓'} Status: <b>${String(order.status).toUpperCase()}</b>\n`;

  if (order.status === 'delivered' && order.deliveryContent) {
    const content = order.deliveryContent as string;
    if (content === 'STOK_HABIS') {
      text += `\n⚠️ Stok habis — Admin akan segera mengirimkan produk ke email kamu.`;
    } else {
      text += `\n\n✅ <b>Produk Kamu:</b>\n`;
      if (content.startsWith('http')) {
        text += `🔗 <a href="${content}">Klik untuk akses/download</a>`;
      } else {
        text += `<code>${escapeHtml(content)}</code>`;
      }
    }
  } else if (order.status === 'pending') {
    text += `\n⏰ Segera lakukan pembayaran sebelum kadaluarsa.`;
  }

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Refresh', callback_data: `cek_order_${orderId}` }],
        [{ text: '🏠 Menu Utama', callback_data: 'menu' }],
      ],
    },
  });
}

// ─── PUBLIC: User Orders ──────────────────────────────────────────────────────
async function sendUserOrders(chatId: number, userId: number) {
  const db = getAdminDb();
  const snap = await db
    .collection('orders')
    .where('userId', '==', `tg_${userId}`)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (snap.empty) {
    return sendMessage(
      chatId,
      '📦 Kamu belum punya pesanan.\n\nKetik /produk untuk melihat produk tersedia.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🛒 Lihat Produk', callback_data: 'products' }]],
        },
      }
    );
  }

  let text = '📦 <b>Pesanan Terakhir Kamu</b>\n\n';
  const keyboard: { text: string; callback_data: string }[][] = [];

  snap.docs.forEach((d, i) => {
    const o = d.data() as Record<string, unknown>;
    const statusEmoji: Record<string, string> = {
      pending: '⏳', paid: '✅', delivered: '📦', failed: '❌', cancelled: '🚫',
    };
    text += `${i + 1}. <b>${escapeHtml(o.productName as string)}</b>\n`;
    text += `   ${statusEmoji[o.status as string] || '❓'} ${String(o.status).toUpperCase()} — ${formatRupiah(o.totalPayment as number || o.amount as number)}\n`;
    text += `   <code>${d.id}</code>\n\n`;
    keyboard.push([{ text: `📋 Cek #${i + 1}`, callback_data: `cek_order_${d.id}` }]);
  });

  keyboard.push([{ text: '🏠 Menu Utama', callback_data: 'menu' }]);
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ─── PUBLIC: Help ─────────────────────────────────────────────────────────────
async function sendHelp(chatId: number) {
  const text =
    `❓ <b>Bantuan KAMIL-SHOP</b>\n\n` +
    `<b>Perintah Tersedia:</b>\n` +
    `/menu — Menu utama\n` +
    `/produk — Lihat semua produk\n` +
    `/pesanan — Lihat pesanan kamu\n` +
    `/batal — Batalkan proses checkout\n\n` +
    `<b>Cara Order:</b>\n` +
    `1. Ketik /produk\n` +
    `2. Pilih produk yang diinginkan\n` +
    `3. Klik <b>Beli Sekarang</b>\n` +
    `4. Isi nama, email, dan nomor WA\n` +
    `5. Pilih metode pembayaran\n` +
    `6. Bayar sesuai instruksi\n` +
    `7. Produk otomatis dikirim ke email\n\n` +
    `Butuh bantuan lebih? Hubungi admin.`;

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]],
    },
  });
}

// ─── ADMIN: Menu ──────────────────────────────────────────────────────────────
async function sendAdminMenu(chatId: number) {
  const db = getAdminDb();
  const [ordersSnap, productsSnap] = await Promise.all([
    db.collection('orders').where('status', '==', 'pending').get(),
    db.collection('products').where('isActive', '==', true).get(),
  ]);

  const pendingCount = ordersSnap.size;
  const productCount = productsSnap.size;

  const text =
    `👑 <b>Admin Panel — KAMIL-SHOP</b>\n\n` +
    `⏳ Pesanan Pending: <b>${pendingCount}</b>\n` +
    `📦 Produk Aktif: <b>${productCount}</b>\n\n` +
    `Pilih menu:`;

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Orders', callback_data: 'admin_orders' },
          { text: '📦 Produk', callback_data: 'admin_products' },
        ],
        [{ text: '📊 Statistik', callback_data: 'admin_stats' }],
        [{ text: '📚 Perintah Admin', callback_data: 'admin_help' }],
      ],
    },
  });
}

// ─── ADMIN: Orders ────────────────────────────────────────────────────────────
async function sendAdminOrders(chatId: number) {
  const db = getAdminDb();
  const snap = await db
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(15)
    .get();

  if (snap.empty) {
    return sendMessage(chatId, '📋 Belum ada pesanan.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Admin Menu', callback_data: 'admin_menu' }]] },
    });
  }

  let text = '📋 <b>Pesanan Terbaru (15)</b>\n\n';
  const keyboard: { text: string; callback_data: string }[][] = [];

  snap.docs.forEach((d, i) => {
    const o = d.data() as Record<string, unknown>;
    const statusEmoji: Record<string, string> = {
      pending: '⏳', paid: '✅', delivered: '📦', failed: '❌', cancelled: '🚫',
    };
    text += `${i + 1}. ${statusEmoji[o.status as string] || '❓'} <b>${escapeHtml(o.productName as string)}</b>\n`;
    text += `   👤 ${escapeHtml(o.customerName as string)} — ${formatRupiah(o.totalPayment as number || o.amount as number)}\n`;
    text += `   <code>${d.id}</code>\n\n`;
    keyboard.push([{ text: `📋 Order #${i + 1}`, callback_data: `admin_order_${d.id}` }]);
  });

  keyboard.push([{ text: '◀️ Admin Menu', callback_data: 'admin_menu' }]);
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ─── ADMIN: Order Detail ──────────────────────────────────────────────────────
async function sendAdminOrderDetail(chatId: number, orderId: string) {
  const db = getAdminDb();
  const doc = await db.collection('orders').doc(orderId).get();

  if (!doc.exists) {
    return sendMessage(chatId, '❌ Order tidak ditemukan.');
  }

  const o = doc.data() as Record<string, unknown>;
  let text = `📋 <b>Detail Order</b>\n\n`;
  text += `🆔 ID: <code>${orderId}</code>\n`;
  text += `🏷️ Produk: <b>${escapeHtml(o.productName as string)}</b>\n`;
  text += `👤 Customer: <b>${escapeHtml(o.customerName as string)}</b>\n`;
  text += `📧 Email: ${escapeHtml(o.customerEmail as string)}\n`;
  text += `📱 WA: ${escapeHtml(o.customerWhatsApp as string || '-')}\n`;
  text += `💰 Total: <b>${formatRupiah(o.totalPayment as number || o.amount as number)}</b>\n`;
  text += `💳 Metode: ${o.paymentMethod}\n`;
  text += `📊 Status: <b>${String(o.status).toUpperCase()}</b>\n`;

  if (o.deliveryContent) {
    const c = o.deliveryContent as string;
    text += `\n📦 Konten Dikirim:\n<code>${c === 'STOK_HABIS' ? '⚠️ STOK HABIS' : escapeHtml(c)}</code>`;
  }

  const keyboard: { text: string; callback_data: string }[][] = [];
  if (o.status === 'paid') {
    keyboard.push([{ text: '✅ Tandai Delivered', callback_data: `admin_mark_delivered_${orderId}` }]);
  }
  keyboard.push([{ text: '◀️ Kembali', callback_data: 'admin_orders' }]);

  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ─── ADMIN: Mark Delivered ────────────────────────────────────────────────────
async function adminMarkDelivered(chatId: number, orderId: string) {
  const db = getAdminDb();
  await db.collection('orders').doc(orderId).update({
    status: 'delivered',
    paidAt: FieldValue.serverTimestamp(),
  });
  return sendMessage(chatId, `✅ Order <code>${orderId}</code> berhasil ditandai sebagai <b>DELIVERED</b>.`, {
    reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'admin_orders' }]] },
  });
}

// ─── ADMIN: Products ──────────────────────────────────────────────────────────
async function sendAdminProducts(chatId: number) {
  const db = getAdminDb();
  const snap = await db.collection('products').orderBy('createdAt', 'desc').get();

  if (snap.empty) {
    return sendMessage(chatId, '📦 Belum ada produk.');
  }

  let text = '📦 <b>Semua Produk</b>\n\n';
  const keyboard: { text: string; callback_data: string }[][] = [];

  snap.docs.forEach((d, i) => {
    const p = d.data() as Record<string, unknown>;
    const stok = (p.stock as string[])?.length || 0;
    const status = p.isActive ? '🟢' : '🔴';
    text += `${i + 1}. ${status} <b>${escapeHtml(p.name as string)}</b>\n`;
    text += `   💰 ${formatRupiah(p.price as number)} | 📦 Stok: ${stok}\n`;
    text += `   ID: <code>${d.id}</code>\n\n`;
    keyboard.push([{ text: `📦 ${p.name as string} (${stok})`, callback_data: `admin_stock_${d.id}` }]);
  });

  keyboard.push([{ text: '◀️ Admin Menu', callback_data: 'admin_menu' }]);
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

// ─── ADMIN: Stock Info ────────────────────────────────────────────────────────
async function sendAdminStockInfo(chatId: number, productId: string) {
  const db = getAdminDb();
  const doc = await db.collection('products').doc(productId).get();

  if (!doc.exists) return sendMessage(chatId, '❌ Produk tidak ditemukan.');

  const p = doc.data() as Record<string, unknown>;
  const stock = (p.stock as string[]) || [];

  let text = `📦 <b>${escapeHtml(p.name as string)}</b>\n`;
  text += `🆔 ID: <code>${productId}</code>\n`;
  text += `📊 Total Stok: <b>${stock.length}</b>\n\n`;

  if (stock.length > 0) {
    text += `<b>Preview Stok (3 pertama):</b>\n`;
    stock.slice(0, 3).forEach((s, i) => {
      text += `${i + 1}. <code>${escapeHtml(s)}</code>\n`;
    });
    if (stock.length > 3) text += `... dan ${stock.length - 3} lagi\n`;
  } else {
    text += `⚠️ <b>STOK HABIS!</b>`;
  }

  text += `\n\n<b>Tambah stok:</b>\n<code>/addstock ${productId}|KODE_STOK_BARU</code>`;

  return sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'admin_products' }]] },
  });
}

// ─── ADMIN: Add Stock ─────────────────────────────────────────────────────────
async function adminAddStock(chatId: number, productId: string, newStock: string) {
  const db = getAdminDb();
  const ref = db.collection('products').doc(productId);
  const doc = await ref.get();

  if (!doc.exists) return sendMessage(chatId, '❌ Produk tidak ditemukan. Cek Product ID.');

  const p = doc.data() as Record<string, unknown>;
  const currentStock = (p.stock as string[]) || [];

  await ref.update({ stock: [...currentStock, newStock] });

  return sendMessage(
    chatId,
    `✅ Stok berhasil ditambah!\n\n` +
    `📦 Produk: <b>${escapeHtml(p.name as string)}</b>\n` +
    `📊 Total Stok: <b>${currentStock.length + 1}</b>\n` +
    `➕ Ditambahkan: <code>${escapeHtml(newStock)}</code>`,
  );
}

// ─── ADMIN: Delete Last Stock ─────────────────────────────────────────────────
async function adminDeleteLastStock(chatId: number, productId: string) {
  const db = getAdminDb();
  const ref = db.collection('products').doc(productId);
  const doc = await ref.get();

  if (!doc.exists) return sendMessage(chatId, '❌ Produk tidak ditemukan.');

  const p = doc.data() as Record<string, unknown>;
  const currentStock = (p.stock as string[]) || [];

  if (currentStock.length === 0) {
    return sendMessage(chatId, '⚠️ Stok sudah kosong, tidak ada yang bisa dihapus.');
  }

  const removed = currentStock[currentStock.length - 1];
  await ref.update({ stock: currentStock.slice(0, -1) });

  return sendMessage(
    chatId,
    `✅ Stok terakhir dihapus!\n\n` +
    `📦 Produk: <b>${escapeHtml(p.name as string)}</b>\n` +
    `📊 Sisa Stok: <b>${currentStock.length - 1}</b>\n` +
    `❌ Dihapus: <code>${escapeHtml(removed)}</code>`,
  );
}

// ─── ADMIN: Update Order Status ───────────────────────────────────────────────
async function adminUpdateOrderStatus(chatId: number, orderId: string, status: string) {
  const validStatuses = ['pending', 'paid', 'delivered', 'failed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return sendMessage(chatId, `❌ Status tidak valid. Pilih: ${validStatuses.join(', ')}`);
  }

  const db = getAdminDb();
  const ref = db.collection('orders').doc(orderId);
  const doc = await ref.get();

  if (!doc.exists) return sendMessage(chatId, '❌ Order tidak ditemukan.');

  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  return sendMessage(
    chatId,
    `✅ Status order <code>${orderId}</code> diubah ke <b>${status.toUpperCase()}</b>`,
  );
}

// ─── ADMIN: Stats ─────────────────────────────────────────────────────────────
async function sendAdminStats(chatId: number) {
  const db = getAdminDb();
  const [allOrders, products, users] = await Promise.all([
    db.collection('orders').get(),
    db.collection('products').get(),
    db.collection('users').get(),
  ]);

  let totalRevenue = 0;
  let pendingCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;

  allOrders.docs.forEach((d) => {
    const o = d.data() as Record<string, unknown>;
    if (o.status === 'delivered' || o.status === 'paid') {
      totalRevenue += (o.totalPayment as number || o.amount as number || 0);
    }
    if (o.status === 'pending') pendingCount++;
    if (o.status === 'delivered') deliveredCount++;
    if (o.status === 'failed') failedCount++;
  });

  const text =
    `📊 <b>Statistik KAMIL-SHOP</b>\n\n` +
    `💰 Total Revenue: <b>${formatRupiah(totalRevenue)}</b>\n` +
    `📋 Total Orders: <b>${allOrders.size}</b>\n` +
    `⏳ Pending: <b>${pendingCount}</b>\n` +
    `✅ Delivered: <b>${deliveredCount}</b>\n` +
    `❌ Gagal: <b>${failedCount}</b>\n\n` +
    `📦 Total Produk: <b>${products.size}</b>\n` +
    `👤 Total Users: <b>${users.size}</b>`;

  return sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: '◀️ Admin Menu', callback_data: 'admin_menu' }]] },
  });
}

// ─── EXPORTED: Send order notification to admin ───────────────────────────────
// Called from webhook route when new payment confirmed
export async function notifyAdminNewOrder(order: {
  orderId: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  totalPayment: number;
  paymentMethod: string;
  deliveryContent?: string;
}) {
  if (!ADMIN_CHAT_ID || !BOT_TOKEN) return;

  const status = order.deliveryContent === 'STOK_HABIS'
    ? '⚠️ STOK HABIS - Perlu tindakan manual!'
    : '✅ Produk berhasil dikirim otomatis';

  const text =
    `🔔 <b>Pembayaran Berhasil!</b>\n\n` +
    `🆔 Order: <code>${order.orderId}</code>\n` +
    `🏷️ Produk: <b>${escapeHtml(order.productName)}</b>\n` +
    `👤 Customer: <b>${escapeHtml(order.customerName)}</b>\n` +
    `📧 Email: ${escapeHtml(order.customerEmail)}\n` +
    `💰 Total: <b>${formatRupiah(order.totalPayment)}</b>\n` +
    `💳 Metode: ${order.paymentMethod}\n` +
    `📦 ${status}`;

  await sendMessage(ADMIN_CHAT_ID, text);
}
