import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN   || '';
const ADMIN_ID    = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL  || '';
const SITE_DOMAIN = 'kamilshop.my.id';

// ─── Telegram API ─────────────────────────────────────────────────────────────
async function tg(method: string, body: Record<string, unknown>) {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
}

async function sendPhoto(chatId: number, photoUrl: string, caption: string, extra?: Record<string, unknown>) {
  return tg('sendPhoto', { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', ...extra });
}

async function answerCallback(id: string, text?: string) {
  return tg('answerCallbackQuery', { callback_query_id: id, text });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}
function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function isAdmin(chatId: number | string) {
  return ADMIN_ID && String(chatId) === String(ADMIN_ID);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
type Step =
  | 'idle'
  | 'await_name'
  | 'await_email'
  | 'await_wa'
  | 'await_promo'
  | 'await_payment'
  | 'await_addstock_id'
  | 'await_addstock_val'
  | 'auth_await_email_pw'
  | 'auth_await_password'
  | 'auth_await_otp_email'
  | 'auth_await_otp_code'
  | 'auth_await_reg_name'
  | 'auth_await_reg_email'
  | 'auth_await_reg_password';

interface Session {
  step: Step;
  productId?: string;
  productName?: string;
  price?: number;
  basePrice?: number;
  name?: string;
  email?: string;
  wa?: string;
  promoCode?: string;
  promoId?: string;
  discount?: number;
  pendingStockProductId?: string;
  lastMsgId?: number;
  // auth flow
  authEmail?: string;
  authName?: string;
  loggedInUserId?: string;
}

const sessions = new Map<number, Session>();
const get  = (uid: number): Session => sessions.get(uid) || { step: 'idle' };
const set  = (uid: number, s: Session) => sessions.set(uid, s);
const clear = (uid: number) => sessions.set(uid, { step: 'idle' });

// ─── MAIN WEBHOOK ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.callback_query) await handleCallback(body.callback_query);
    else if (body.message)   await handleMessage(body.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[TG]', e);
    return NextResponse.json({ ok: true });
  }
}
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
async function handleMessage(msg: Record<string, unknown>) {
  const chat    = msg.chat as Record<string, unknown>;
  const from    = msg.from as Record<string, unknown>;
  const chatId  = chat.id as number;
  const userId  = from.id as number;
  const msgId   = msg.message_id as number;
  const text    = (msg.text as string) || '';
  const name    = (from.first_name as string) || 'Kamu';

  const s = get(userId);


  // ── Admin commands ──────────────────────────────────────────────────────────
  if (isAdmin(chatId)) {
    if (text === '/admin' || text === '/start') return adminMenu(chatId, s);
    if (text === '/orders')   return adminOrders(chatId, s);
    if (text === '/products') return adminProducts(chatId, s);
    if (text === '/stats')    return adminStats(chatId, s);

    // Tambah stok: flow 2 langkah via session
    if (text === '/addstock') {
          const r = await sendMessage(chatId, '📦 Kirim <b>Product ID</b> produk yang ingin ditambah stoknya:\n\n<i>Gunakan /products untuk lihat semua ID</i>');
      set(userId, { step: 'await_addstock_id', lastMsgId: (r as Record<string,unknown>)?.result ? ((r as Record<string,unknown>).result as Record<string,unknown>).message_id as number : undefined });
      return;
    }

    // Session-based admin flow
    if (s.step === 'await_addstock_id') {
          const r = await sendMessage(chatId, `✅ Product ID: <code>${esc(text)}</code>\n\nSekarang kirim <b>kode stok baru</b>:`);
      set(userId, { step: 'await_addstock_val', pendingStockProductId: text.trim(), lastMsgId: (r as Record<string,unknown>)?.result ? ((r as Record<string,unknown>).result as Record<string,unknown>).message_id as number : undefined });
      return;
    }
    if (s.step === 'await_addstock_val' && s.pendingStockProductId) {
      return adminAddStockDo(chatId, userId, s.pendingStockProductId, text.trim(), s);
    }
  }

  // ── Public commands ─────────────────────────────────────────────────────────
  if (text === '/start' || text === '/menu') {
    clear(userId);
    return mainMenu(chatId, name, s);
  }
  if (text === '/produk')   { clear(userId); return productList(chatId, s); }
  if (text === '/pesanan')  { clear(userId); return userOrders(chatId, userId, s); }
  if (text === '/bantuan')  { clear(userId); return helpMenu(chatId, s); }
  if (text === '/login')    { clear(userId); return authMenu(chatId, s); }
  if (text === '/daftar')   { clear(userId); return registerStart(chatId, s); }
  if (text === '/batal') {
    clear(userId);
    return sendMessage(chatId, '✅ Dibatalkan. Ketik /menu untuk kembali.');
  }

  // ── Checkout flow ───────────────────────────────────────────────────────────
  if (s.step === 'await_name') {
    if (text.length < 2) return sendMessage(chatId, '❌ Nama terlalu pendek, coba lagi:');
      const r = await sendMessage(chatId,
      `✅ Nama: <b>${esc(text)}</b>\n\n📧 Masukkan <b>email</b> kamu:\n<i>(produk dikirim ke email ini)</i>`
    );
    set(userId, { ...s, step: 'await_email', name: text, lastMsgId: msgIdFromResult(r) });
    return;
  }
  if (s.step === 'await_email') {
    if (!text.includes('@') || !text.includes('.')) return sendMessage(chatId, '❌ Email tidak valid, coba lagi:');
      const r = await sendMessage(chatId,
      `✅ Email: <b>${esc(text)}</b>\n\n📱 Masukkan nomor <b>WhatsApp</b>:\n<i>Contoh: 08123456789</i>`
    );
    set(userId, { ...s, step: 'await_wa', email: text.toLowerCase().trim(), lastMsgId: msgIdFromResult(r) });
    return;
  }
  if (s.step === 'await_wa') {
    const wa = text.replace(/\D/g, '');
    if (wa.length < 10) return sendMessage(chatId, '❌ Nomor WA tidak valid, coba lagi:');
      set(userId, { ...s, wa });
    return promoMenu(chatId, userId, s);
  }
  if (s.step === 'await_promo') {
    return applyPromo(chatId, userId, text.trim().toUpperCase(), s);
  }

  // ── Auth: Login Email+Password ────────────────────────────────────────────
  if (s.step === 'auth_await_email_pw') {
    if (!text.includes('@')) return sendMessage(chatId, '❌ Email tidak valid, coba lagi:');
    set(userId, { ...s, step: 'auth_await_password', authEmail: text.toLowerCase().trim() });
    return sendMessage(chatId, `📧 Email: <b>${esc(text)}</b>\n\n🔑 Masukkan <b>password</b> kamu:`);
  }
  if (s.step === 'auth_await_password') {
    return authDoLoginPassword(chatId, userId, s.authEmail!, text, s);
  }

  // ── Auth: Login OTP ─────────────────────────────────────────────────────────
  if (s.step === 'auth_await_otp_email') {
    if (!text.includes('@')) return sendMessage(chatId, '❌ Email tidak valid, coba lagi:');
    return authSendOtp(chatId, userId, text.toLowerCase().trim(), s);
  }
  if (s.step === 'auth_await_otp_code') {
    return authVerifyOtp(chatId, userId, s.authEmail!, text.trim(), s);
  }

  // ── Auth: Register ──────────────────────────────────────────────────────────
  if (s.step === 'auth_await_reg_name') {
    if (text.length < 2) return sendMessage(chatId, '❌ Nama terlalu pendek, coba lagi:');
    set(userId, { ...s, step: 'auth_await_reg_email', authName: text });
    return sendMessage(chatId, `✅ Nama: <b>${esc(text)}</b>\n\n📧 Masukkan <b>email</b> kamu:`);
  }
  if (s.step === 'auth_await_reg_email') {
    if (!text.includes('@')) return sendMessage(chatId, '❌ Email tidak valid, coba lagi:');
    set(userId, { ...s, step: 'auth_await_reg_password', authEmail: text.toLowerCase().trim() });
    return sendMessage(chatId, `✅ Email: <b>${esc(text)}</b>\n\n🔑 Buat <b>password</b> (min. 6 karakter):`);
  }
  if (s.step === 'auth_await_reg_password') {
    return authDoRegister(chatId, userId, s.authName!, s.authEmail!, text, s);
  }

  // Default
  return sendMessage(chatId, '❓ Tidak dikenali. Ketik /menu untuk menu utama.', {
    reply_markup: { inline_keyboard: [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]] },
  });
}

// ─── CALLBACKS ────────────────────────────────────────────────────────────────
async function handleCallback(query: Record<string, unknown>) {
  const msg    = query.message as Record<string, unknown>;
  const chatId = (msg.chat as Record<string, unknown>).id as number;
  const msgId  = msg.message_id as number;
  const from   = query.from as Record<string, unknown>;
  const userId = from.id as number;
  const data   = query.data as string;
  const cbId   = query.id as string;
  const name   = (from.first_name as string) || 'Kamu';

  await answerCallback(cbId);

  const s = get(userId);

  // ── Admin ──
  if (isAdmin(chatId)) {
    if (data === 'admin_menu')     return adminMenu(chatId, s);
    if (data === 'admin_orders')   return adminOrders(chatId, s);
    if (data === 'admin_products') return adminProducts(chatId, s);
    if (data === 'admin_stats')    return adminStats(chatId, s);
    if (data.startsWith('admin_order_'))        return adminOrderDetail(chatId, data.replace('admin_order_', ''));
    if (data.startsWith('admin_delivered_'))    return adminMarkDelivered(chatId, data.replace('admin_delivered_', ''));
    if (data.startsWith('admin_stock_'))        return adminStockInfo(chatId, data.replace('admin_stock_', ''));
    if (data.startsWith('admin_toggle_'))       return adminToggleProduct(chatId, data.replace('admin_toggle_', ''));
  }

  // ── Public ──
  if (data === 'menu')       return mainMenu(chatId, name, s);
  if (data === 'products')   return productList(chatId, s);
  if (data === 'my_orders')  return userOrders(chatId, userId, s);
  if (data === 'help')       return helpMenu(chatId, s);

  if (data.startsWith('cat_'))     return productListByCategory(chatId, data.replace('cat_', ''), s);
  if (data.startsWith('product_')) return productDetail(chatId, data.replace('product_', ''), userId, s);
  if (data.startsWith('buy_'))     return startCheckout(chatId, userId, data.replace('buy_', ''), s);

  if (data === 'skip_promo')       return paymentMenu(chatId, userId, s);
  if (data === 'enter_promo') {
    await sendMessage(chatId, '🏷️ Masukkan <b>kode promo</b> kamu:');
    set(userId, { ...s, step: 'await_promo' });
    return;
  }

  if (data.startsWith('pay_'))     return processPayment(chatId, userId, data.replace('pay_', ''), s);
  if (data.startsWith('cek_'))     return orderStatus(chatId, data.replace('cek_', ''));

  // ── Auth callbacks ──
  if (data === 'auth_menu')        return authMenu(chatId, s);
  if (data === 'auth_email_pw') {
    set(userId, { ...s, step: 'auth_await_email_pw' });
    return sendMessage(chatId, '📧 Masukkan <b>email</b> kamu:');
  }
  if (data === 'auth_otp') {
    set(userId, { ...s, step: 'auth_await_otp_email' });
    return sendMessage(chatId, '📧 Masukkan <b>email</b> untuk kirim OTP:');
  }
  if (data === 'auth_register')    return registerStart(chatId, s);
  if (data === 'auth_logout')      return authLogout(chatId, userId, s);
}

// ─── UI: Main Menu ────────────────────────────────────────────────────────────
async function mainMenu(chatId: number, name: string, s: Session) {
  const text =
    `🛍️ <b>KAMIL-SHOP</b> — Selamat datang, ${esc(name)}!\n\n` +
    `Toko digital terpercaya untuk bot, akun premium & tools.\n` +
    `⚡ Pengiriman instan otomatis setelah bayar.\n\n` +
    `Pilih menu:`;

  const r = await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 Produk', callback_data: 'products' },
          { text: '📦 Pesanan Saya', callback_data: 'my_orders' },
        ],
        [
          { text: '🔐 Login', callback_data: 'auth_menu' },
          { text: '📝 Daftar', callback_data: 'auth_register' },
        ],
        [{ text: '❓ Bantuan', callback_data: 'help' }],
        [{ text: '🌐 Buka Website', url: `https://${SITE_DOMAIN}` }],
      ],
    },
  });
  set(chatId, { step: 'idle', lastMsgId: msgIdFromResult(r) });
}

// ─── UI: Category List ────────────────────────────────────────────────────────
async function productList(chatId: number, s: Session) {
  const db   = getAdminDb();
  const snap = await db.collection('categories').orderBy('name').get();

  const keyboard: { text: string; callback_data?: string; url?: string }[][] = [];
  snap.docs.forEach((d) => {
    const c = d.data();
    keyboard.push([{ text: `${c.icon} ${c.name}`, callback_data: `cat_${c.slug}` }]);
  });
  keyboard.push([{ text: '🔥 Semua Produk', callback_data: 'cat_all' }]);
  keyboard.push([
    { text: '🏠 Menu', callback_data: 'menu' },
    { text: '🌐 Website', url: `https://${SITE_DOMAIN}/products` },
  ]);

  const r = await sendMessage(chatId, '📂 <b>Pilih Kategori:</b>', {
    reply_markup: { inline_keyboard: keyboard },
  });
  set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── UI: Products by Category ─────────────────────────────────────────────────
async function productListByCategory(chatId: number, category: string, s: Session) {
  const db = getAdminDb();
  let ref = db.collection('products').where('isActive', '==', true);
  if (category !== 'all') {
    ref = ref.where('category', '==', category) as typeof ref;
  }
  const snap = await ref.orderBy('createdAt', 'desc').get();

  if (snap.empty) {
    const r = await sendMessage(chatId, '😔 Belum ada produk di kategori ini.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Kategori', callback_data: 'products' }]] },
    });
    set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
    return;
  }

  const now = new Date();
  let text = '🛍️ <b>Daftar Produk:</b>\n\n';
  const keyboard: { text: string; callback_data: string }[][] = [];

  snap.docs.forEach((d, i) => {
    const p = d.data();
    const stok = (p.stock as string[])?.length || 0;
    const isFlash = p.flashSaleEnd && new Date(p.flashSaleEnd) > now && p.flashSalePrice;
    const price   = isFlash ? p.flashSalePrice : p.price;
    const badge   = isFlash ? '🔥 FLASH SALE' : p.badge === 'bestseller' ? '⭐ BESTSELLER' : p.badge === 'new' ? '🆕 BARU' : '';

    text += `${i + 1}. <b>${esc(p.name)}</b>${badge ? ` [${badge}]` : ''}\n`;
    text += `   💰 ${rp(price)}`;
    if (p.originalPrice > price) text += ` <s>${rp(p.originalPrice)}</s>`;
    text += `\n   📦 ${stok > 0 ? `${stok} stok` : '❌ Habis'}\n\n`;
    keyboard.push([{ text: `👁️ ${p.name}`, callback_data: `product_${d.id}` }]);
  });

  keyboard.push([
    { text: '◀️ Kategori', callback_data: 'products' },
    { text: '🏠 Menu', callback_data: 'menu' },
  ]);

  const r = await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── UI: Product Detail ───────────────────────────────────────────────────────
async function productDetail(chatId: number, productId: string, userId: number, s: Session) {
  const db  = getAdminDb();
  const doc = await db.collection('products').doc(productId).get();

  if (!doc.exists) {
    return sendMessage(chatId, '❌ Produk tidak ditemukan.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'products' }]] },
    });
  }

  const p    = doc.data()!;
  const stok = (p.stock as string[])?.length || 0;
  const now  = new Date();
  const isFlash = p.flashSaleEnd && new Date(p.flashSaleEnd) > now && p.flashSalePrice;
  const price   = isFlash ? p.flashSalePrice : p.price;
  const features: string[] = p.features || [];

  let text = '';
  if (isFlash) text += `🔥 <b>FLASH SALE!</b> Berakhir: ${new Date(p.flashSaleEnd).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n`;
  text += `🏷️ <b>${esc(p.name)}</b>\n\n`;
  text += `📝 ${esc(p.description)}\n\n`;
  text += `💰 <b>Harga: ${rp(price)}</b>`;
  if (p.originalPrice > price) {
    const disc = Math.round((1 - price / p.originalPrice) * 100);
    text += ` <s>${rp(p.originalPrice)}</s> <b>(-${disc}%)</b>`;
  }
  text += `\n⭐ Rating: ${p.rating || 5}/5`;
  text += `\n📦 Stok: ${stok > 0 ? `<b>${stok} tersisa</b>` : '<b>❌ HABIS</b>'}\n`;
  if (features.length) {
    text += `\n✨ <b>Fitur:</b>\n`;
    features.forEach((f: string) => { text += `  ✅ ${esc(f)}\n`; });
  }

  const keyboard: { text: string; callback_data?: string; url?: string }[][] = [];
  if (stok > 0) {
    keyboard.push([{ text: '🛒 Beli Sekarang', callback_data: `buy_${productId}` }]);
  } else {
    keyboard.push([{ text: '❌ Stok Habis', callback_data: 'products' }]);
  }
  keyboard.push([
    { text: '◀️ Kembali', callback_data: 'products' },
    { text: '🌐 Detail', url: `https://${SITE_DOMAIN}/products/${p.slug}` },
  ]);

  const r = await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  set(userId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── CHECKOUT: Start ──────────────────────────────────────────────────────────
async function startCheckout(chatId: number, userId: number, productId: string, s: Session) {
  const db  = getAdminDb();
  const doc = await db.collection('products').doc(productId).get();
  if (!doc.exists || !doc.data()!.isActive) {
    return sendMessage(chatId, '❌ Produk tidak ditemukan.');
  }
  const p    = doc.data()!;
  const stok = (p.stock as string[])?.length || 0;
  if (stok === 0) return sendMessage(chatId, '❌ Maaf, stok habis.');

  const now      = new Date();
  const isFlash  = p.flashSaleEnd && new Date(p.flashSaleEnd) > now && p.flashSalePrice;
  const price    = isFlash ? p.flashSalePrice : p.price;

  const r = await sendMessage(chatId,
    `🛒 <b>Checkout: ${esc(p.name)}</b>\n` +
    `💰 Harga: <b>${rp(price)}</b>\n\n` +
    `Masukkan <b>nama lengkap</b> kamu:\n<i>Ketik /batal untuk membatalkan</i>`
  );
  set(userId, {
    step: 'await_name',
    productId,
    productName: p.name,
    price,
    basePrice: price,
    lastMsgId: msgIdFromResult(r),
  });
}

// ─── CHECKOUT: Promo Menu ─────────────────────────────────────────────────────
async function promoMenu(chatId: number, userId: number, s: Session) {
  const r = await sendMessage(chatId,
    `🏷️ <b>Punya kode promo?</b>\n\n` +
    `Produk: <b>${esc(s.productName || '')}</b>\n` +
    `Harga: <b>${rp(s.price || 0)}</b>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏷️ Masukkan Kode Promo', callback_data: 'enter_promo' },
            { text: '⏭️ Lewati', callback_data: 'skip_promo' },
          ],
        ],
      },
    }
  );
  set(userId, { ...s, step: 'await_promo', lastMsgId: msgIdFromResult(r) });
}

// ─── CHECKOUT: Apply Promo ────────────────────────────────────────────────────
async function applyPromo(chatId: number, userId: number, code: string, s: Session) {
  try {
    const res  = await fetch(`${SITE_URL}/api/validate-promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, amount: s.basePrice }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      await sendMessage(chatId, `❌ ${data.error || 'Kode promo tidak valid'}`);
      return paymentMenu(chatId, userId, s);
    }
    const newPrice = data.finalAmount;
    set(userId, { ...s, promoCode: code, promoId: data.promoId, discount: data.discount, price: newPrice });
    await sendMessage(chatId,
      `✅ Promo <b>${code}</b> berhasil!\n` +
      `Diskon: <b>-${rp(data.discount)}</b>\n` +
      `Harga setelah diskon: <b>${rp(newPrice)}</b>`
    );
    return paymentMenu(chatId, userId, { ...s, promoCode: code, promoId: data.promoId, discount: data.discount, price: newPrice });
  } catch {
    return paymentMenu(chatId, userId, s);
  }
}

// ─── CHECKOUT: Payment Method Menu ───────────────────────────────────────────
async function paymentMenu(chatId: number, userId: number, s: Session) {
  let text = `💳 <b>Pilih Metode Pembayaran</b>\n\n`;
  text += `Produk: <b>${esc(s.productName || '')}</b>\n`;
  text += `Total: <b>${rp(s.price || 0)}</b>`;
  if (s.discount) text += `\n💸 Diskon: -${rp(s.discount)}`;

  const r = await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔲 QRIS', callback_data: 'pay_qris' },
          { text: '💙 DANA', callback_data: 'pay_dana' },
        ],
        [
          { text: '💜 OVO', callback_data: 'pay_ovo' },
          { text: '💚 GoPay', callback_data: 'pay_gopay' },
        ],
        [
          { text: '🏦 BCA', callback_data: 'pay_bca' },
          { text: '🏦 BNI', callback_data: 'pay_bni' },
        ],
        [
          { text: '🏦 BRI', callback_data: 'pay_bri' },
          { text: '🏦 Mandiri', callback_data: 'pay_mandiri' },
        ],
        [{ text: '❌ Batal', callback_data: 'menu' }],
      ],
    },
  });
  set(userId, { ...s, step: 'await_payment', lastMsgId: msgIdFromResult(r) });
}

// ─── CHECKOUT: Process Payment ────────────────────────────────────────────────
async function processPayment(chatId: number, userId: number, method: string, s: Session) {
  if (s.step !== 'await_payment') {
    return sendMessage(chatId, '❌ Sesi kadaluarsa. Ketik /menu untuk mulai lagi.');
  }
  clear(userId);

  const orderId = `TG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const loading = await sendMessage(chatId, '⏳ Membuat pembayaran...');

  try {
    const res = await fetch(`${SITE_URL}/api/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        amount: s.basePrice,
        orderId,
        productId: s.productId,
        productName: s.productName,
        customerData: { name: s.name, email: s.email, whatsApp: s.wa },
        userId: `tg_${userId}`,
        promoCode:  s.promoCode  || null,
        promoId:    s.promoId    || null,
        discount:   s.discount   || 0,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.payment) {
      return sendMessage(chatId, `❌ Gagal: ${data.error || 'Coba lagi'}\n\nKetik /menu`, {
        reply_markup: { inline_keyboard: [[{ text: '🏠 Menu', callback_data: 'menu' }]] },
      });
    }

    const pay     = data.payment;
    const expired = pay.expired_at
      ? new Date(pay.expired_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : '24 jam';
    const isQris  = method === 'qris';

    let caption = `✅ <b>Pesanan Berhasil Dibuat!</b>\n\n`;
    caption += `🆔 <code>${orderId}</code>\n`;
    caption += `🏷️ <b>${esc(s.productName || '')}</b>\n`;
    caption += `💰 Total: <b>${rp(pay.total_payment || s.price || 0)}</b>\n`;
    if (s.discount) caption += `💸 Diskon: -${rp(s.discount)}\n`;
    caption += `💳 Metode: <b>${method.toUpperCase()}</b>\n`;
    caption += `⏰ Bayar sebelum: <b>${expired}</b>\n\n`;

    if (isQris && pay.payment_number) {
      caption += `📌 Scan QR di bawah ini untuk bayar.\n`;
    } else if (pay.payment_number) {
      caption += `📌 <b>Nomor Tujuan:</b>\n<code>${esc(pay.payment_number)}</code>\n`;
    }
    caption += `\n🔔 Produk dikirim ke <b>${esc(s.email || '')}</b> otomatis setelah bayar.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔍 Cek Status', callback_data: `cek_${orderId}` },
          { text: '🌐 Cek di Web', url: `https://${SITE_DOMAIN}/order/${orderId}` },
        ],
        [{ text: '🛒 Beli Lagi', callback_data: 'products' }],
        [{ text: '🏠 Menu', callback_data: 'menu' }],
      ],
    };

    // Kalau QRIS — kirim QR code image + caption
    if (isQris && pay.payment_number) {
      // Pakasir payment_number untuk QRIS biasanya berupa string QRIS / URL QR
      // Gunakan goqr.me untuk generate QR image dari string
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(pay.payment_number)}`;
      try {
        await sendPhoto(chatId, qrUrl, caption, { reply_markup: keyboard });
      } catch {
        // Fallback jika photo gagal
        await sendMessage(chatId, caption + `\n\n🔲 <code>${esc(pay.payment_number)}</code>`, { reply_markup: keyboard });
      }
    } else {
      await sendMessage(chatId, caption, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error('[processPayment]', err);
    await sendMessage(chatId, '❌ Terjadi kesalahan. Coba lagi.\n\nKetik /menu', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 Menu', callback_data: 'menu' }]] },
    });
  }
}

// ─── PUBLIC: Order Status ─────────────────────────────────────────────────────
async function orderStatus(chatId: number, orderId: string) {
  const db  = getAdminDb();
  const doc = await db.collection('orders').doc(orderId).get();

  if (!doc.exists) {
    return sendMessage(chatId, '❌ Order tidak ditemukan.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 Menu', callback_data: 'menu' }]] },
    });
  }

  const o = doc.data()!;
  const statusEmoji: Record<string, string> = {
    pending: '⏳', paid: '✅', delivered: '📦', failed: '❌', cancelled: '🚫',
  };

  let text = `📋 <b>Status Pesanan</b>\n\n`;
  text += `🆔 <code>${orderId}</code>\n`;
  text += `🏷️ <b>${esc(o.productName)}</b>\n`;
  text += `💰 ${rp(o.totalPayment || o.amount)}\n`;
  text += `${statusEmoji[o.status] || '❓'} <b>${String(o.status).toUpperCase()}</b>\n`;

  if (o.status === 'delivered' && o.deliveryContent) {
    const c = o.deliveryContent as string;
    if (c === 'STOK_HABIS') {
      text += `\n⚠️ Stok habis — admin akan mengirim manual ke email kamu.`;
    } else {
      text += `\n\n📦 <b>Produk kamu:</b>\n`;
      text += c.startsWith('http')
        ? `🔗 <a href="${c}">Klik untuk akses</a>`
        : `<code>${esc(c)}</code>`;
    }
  } else if (o.status === 'pending') {
    text += `\n⏰ Segera bayar sebelum kadaluarsa.`;
  }

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: `cek_${orderId}` },
          { text: '🌐 Lihat di Web', url: `https://${SITE_DOMAIN}/order/${orderId}` },
        ],
        [{ text: '🏠 Menu', callback_data: 'menu' }],
      ],
    },
  });
}

// ─── PUBLIC: User Orders ──────────────────────────────────────────────────────
async function userOrders(chatId: number, userId: number, s: Session) {
  const db   = getAdminDb();
  const snap = await db.collection('orders')
    .where('userId', '==', `tg_${userId}`)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (snap.empty) {
    const r = await sendMessage(chatId, '📦 Belum ada pesanan.\n\nBrowse produk dulu yuk!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Lihat Produk', callback_data: 'products' }],
          [{ text: '🌐 Website', url: `https://${SITE_DOMAIN}` }],
        ],
      },
    });
    set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
    return;
  }

  let text = '📦 <b>Pesanan Terakhir</b>\n\n';
  const keyboard: { text: string; callback_data?: string; url?: string }[][] = [];
  const statusEmoji: Record<string, string> = {
    pending: '⏳', paid: '✅', delivered: '📦', failed: '❌', cancelled: '🚫',
  };

  snap.docs.forEach((d, i) => {
    const o = d.data();
    text += `${i + 1}. ${statusEmoji[o.status] || '❓'} <b>${esc(o.productName)}</b>\n`;
    text += `   ${rp(o.totalPayment || o.amount)} — <code>${d.id}</code>\n\n`;
    keyboard.push([{ text: `📋 Order #${i + 1} — ${o.status.toUpperCase()}`, callback_data: `cek_${d.id}` }]);
  });
  keyboard.push([
    { text: '🏠 Menu', callback_data: 'menu' },
    { text: '🌐 Dashboard', url: `https://${SITE_DOMAIN}/dashboard` },
  ]);

  const r = await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── PUBLIC: Help ─────────────────────────────────────────────────────────────
async function helpMenu(chatId: number, s: Session) {
  const text =
    `❓ <b>Bantuan KAMIL-SHOP</b>\n\n` +
    `<b>Perintah:</b>\n` +
    `/menu — Menu utama\n` +
    `/produk — Lihat produk\n` +
    `/pesanan — Pesanan kamu\n` +
    `/batal — Batalkan checkout\n\n` +
    `<b>Cara Order:</b>\n` +
    `1. /produk → pilih kategori → pilih produk\n` +
    `2. Klik Beli Sekarang\n` +
    `3. Isi nama, email, nomor WA\n` +
    `4. Masukkan kode promo (opsional)\n` +
    `5. Pilih metode pembayaran\n` +
    `6. Bayar sesuai instruksi\n` +
    `7. Produk otomatis ke email ⚡\n\n` +
    `Ada masalah? Hubungi admin.`;

  const r = await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏠 Menu', callback_data: 'menu' }],
        [{ text: '🌐 Buka Website', url: `https://${SITE_DOMAIN}` }],
      ],
    },
  });
  set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── ADMIN: Dashboard ─────────────────────────────────────────────────────────
async function adminMenu(chatId: number, s: Session) {
  const db = getAdminDb();
  const [pendSnap, prodSnap] = await Promise.all([
    db.collection('orders').where('status', '==', 'pending').get(),
    db.collection('products').where('isActive', '==', true).get(),
  ]);

  const text =
    `👑 <b>Admin Panel — KAMIL-SHOP</b>\n\n` +
    `⏳ Pending: <b>${pendSnap.size}</b>\n` +
    `📦 Produk Aktif: <b>${prodSnap.size}</b>`;

  const r = await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Orders', callback_data: 'admin_orders' },
          { text: '📦 Produk', callback_data: 'admin_products' },
        ],
        [{ text: '📊 Statistik', callback_data: 'admin_stats' }],
        [{ text: '🌐 Admin Web', url: `https://${SITE_DOMAIN}/admin/dashboard` }],
      ],
    },
  });
  set(chatId, { step: 'idle', lastMsgId: msgIdFromResult(r) });
}

// ─── ADMIN: Orders ────────────────────────────────────────────────────────────
async function adminOrders(chatId: number, s: Session) {
  const db   = getAdminDb();
  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(15).get();
  if (snap.empty) {
    return sendMessage(chatId, '📋 Belum ada pesanan.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Admin Menu', callback_data: 'admin_menu' }]] },
    });
  }

  let text = '📋 <b>15 Pesanan Terbaru</b>\n\n';
  const keyboard: { text: string; callback_data?: string; url?: string }[][] = [];
  const statusEmoji: Record<string, string> = {
    pending: '⏳', paid: '✅', delivered: '📦', failed: '❌', cancelled: '🚫',
  };

  snap.docs.forEach((d, i) => {
    const o = d.data();
    text += `${i + 1}. ${statusEmoji[o.status] || '❓'} <b>${esc(o.productName)}</b>\n`;
    text += `   👤 ${esc(o.customerName)} — ${rp(o.totalPayment || o.amount)}\n\n`;
    keyboard.push([{ text: `📋 #${i + 1} ${o.productName} [${o.status}]`, callback_data: `admin_order_${d.id}` }]);
  });
  keyboard.push([
    { text: '◀️ Admin Menu', callback_data: 'admin_menu' },
    { text: '🌐 Web Orders', url: `https://${SITE_DOMAIN}/admin/orders` },
  ]);

  const r = await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── ADMIN: Order Detail ──────────────────────────────────────────────────────
async function adminOrderDetail(chatId: number, orderId: string) {
  const db  = getAdminDb();
  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists) return sendMessage(chatId, '❌ Order tidak ditemukan.');

  const o = doc.data()!;
  let text = `📋 <b>Detail Order</b>\n\n`;
  text += `🆔 <code>${orderId}</code>\n`;
  text += `🏷️ <b>${esc(o.productName)}</b>\n`;
  text += `👤 ${esc(o.customerName)}\n`;
  text += `📧 ${esc(o.customerEmail)}\n`;
  text += `📱 ${esc(o.customerWhatsApp || '-')}\n`;
  text += `💰 ${rp(o.totalPayment || o.amount)}\n`;
  text += `💳 ${o.paymentMethod}\n`;
  text += `📊 <b>${String(o.status).toUpperCase()}</b>\n`;
  if (o.deliveryContent) {
    const c = o.deliveryContent as string;
    text += `\n📦 Konten: ${c === 'STOK_HABIS' ? '⚠️ STOK HABIS' : `<code>${esc(c)}</code>`}`;
  }

  const keyboard: { text: string; callback_data?: string; url?: string }[][] = [];
  if (o.status === 'paid') {
    keyboard.push([{ text: '✅ Mark Delivered', callback_data: `admin_delivered_${orderId}` }]);
  }
  keyboard.push([
    { text: '◀️ Orders', callback_data: 'admin_orders' },
    { text: '🌐 Web', url: `https://${SITE_DOMAIN}/admin/orders` },
  ]);

  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

async function adminMarkDelivered(chatId: number, orderId: string) {
  const db = getAdminDb();
  await db.collection('orders').doc(orderId).update({
    status: 'delivered',
    paidAt: FieldValue.serverTimestamp(),
  });
  return sendMessage(chatId, `✅ Order <code>${orderId}</code> → <b>DELIVERED</b>`, {
    reply_markup: { inline_keyboard: [[{ text: '◀️ Orders', callback_data: 'admin_orders' }]] },
  });
}

// ─── ADMIN: Products ──────────────────────────────────────────────────────────
async function adminProducts(chatId: number, s: Session) {
  const db   = getAdminDb();
  const snap = await db.collection('products').orderBy('createdAt', 'desc').get();
  if (snap.empty) return sendMessage(chatId, '📦 Belum ada produk.');

  let text = '📦 <b>Semua Produk</b>\n\n';
  const keyboard: { text: string; callback_data?: string; url?: string }[][] = [];

  snap.docs.forEach((d, i) => {
    const p    = d.data();
    const stok = (p.stock as string[])?.length || 0;
    const icon = p.isActive ? '🟢' : '🔴';
    text += `${i + 1}. ${icon} <b>${esc(p.name)}</b>\n`;
    text += `   ${rp(p.price)} | 📦 ${stok} stok\n`;
    text += `   ID: <code>${d.id}</code>\n\n`;
    keyboard.push([{ text: `📦 ${p.name} (${stok} stok)`, callback_data: `admin_stock_${d.id}` }]);
  });
  keyboard.push([
    { text: '◀️ Admin Menu', callback_data: 'admin_menu' },
    { text: '🌐 Web Produk', url: `https://${SITE_DOMAIN}/admin/products` },
  ]);

  const r = await sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── ADMIN: Stock Info ────────────────────────────────────────────────────────
async function adminStockInfo(chatId: number, productId: string) {
  const db  = getAdminDb();
  const doc = await db.collection('products').doc(productId).get();
  if (!doc.exists) return sendMessage(chatId, '❌ Produk tidak ditemukan.');

  const p     = doc.data()!;
  const stock = (p.stock as string[]) || [];

  let text = `📦 <b>${esc(p.name)}</b>\n`;
  text += `🆔 <code>${productId}</code>\n`;
  text += `📊 Stok: <b>${stock.length}</b>\n\n`;
  if (stock.length > 0) {
    text += `<b>3 stok pertama:</b>\n`;
    stock.slice(0, 3).forEach((s, i) => { text += `${i + 1}. <code>${esc(s)}</code>\n`; });
    if (stock.length > 3) text += `... +${stock.length - 3} lagi\n`;
  } else {
    text += `⚠️ <b>STOK HABIS!</b>`;
  }
  text += `\n\n<b>Cara tambah stok:</b>\nKetik /addstock lalu ikuti instruksi.`;

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: p.isActive ? '🔴 Nonaktifkan' : '🟢 Aktifkan', callback_data: `admin_toggle_${productId}` }],
        [
          { text: '◀️ Produk', callback_data: 'admin_products' },
          { text: '🌐 Edit di Web', url: `https://${SITE_DOMAIN}/admin/products` },
        ],
      ],
    },
  });
}

// ─── ADMIN: Toggle Product ────────────────────────────────────────────────────
async function adminToggleProduct(chatId: number, productId: string) {
  const db  = getAdminDb();
  const doc = await db.collection('products').doc(productId).get();
  if (!doc.exists) return sendMessage(chatId, '❌ Produk tidak ditemukan.');
  const p      = doc.data()!;
  const newVal = !p.isActive;
  await db.collection('products').doc(productId).update({ isActive: newVal });
  return sendMessage(chatId,
    `${newVal ? '🟢 Produk diaktifkan' : '🔴 Produk dinonaktifkan'}: <b>${esc(p.name)}</b>`,
    { reply_markup: { inline_keyboard: [[{ text: '◀️ Produk', callback_data: 'admin_products' }]] } }
  );
}

// ─── ADMIN: Add Stock Flow ────────────────────────────────────────────────────
async function adminAddStockDo(chatId: number, userId: number, productId: string, newStock: string, s: Session) {
  const db  = getAdminDb();
  const ref = db.collection('products').doc(productId);
  const doc = await ref.get();
  if (!doc.exists) {
    return sendMessage(chatId, '❌ Product ID tidak valid. Coba lagi dengan /addstock');
  }
  const p           = doc.data()!;
  const currentStock = (p.stock as string[]) || [];
  await ref.update({ stock: [...currentStock, newStock] });
  clear(userId);

  return sendMessage(chatId,
    `✅ <b>Stok berhasil ditambah!</b>\n\n` +
    `📦 <b>${esc(p.name)}</b>\n` +
    `📊 Total stok: <b>${currentStock.length + 1}</b>\n` +
    `➕ Ditambahkan: <code>${esc(newStock)}</code>`,
    { reply_markup: { inline_keyboard: [[{ text: '◀️ Produk', callback_data: 'admin_products' }]] } }
  );
}

// ─── ADMIN: Stats ─────────────────────────────────────────────────────────────
async function adminStats(chatId: number, s: Session) {
  const db = getAdminDb();
  const [ordersSnap, productsSnap, usersSnap] = await Promise.all([
    db.collection('orders').get(),
    db.collection('products').get(),
    db.collection('users').get(),
  ]);

  let revenue = 0, pending = 0, delivered = 0, failed = 0;
  ordersSnap.docs.forEach((d) => {
    const o = d.data();
    if (['delivered', 'paid'].includes(o.status)) revenue += (o.totalPayment || o.amount || 0);
    if (o.status === 'pending')   pending++;
    if (o.status === 'delivered') delivered++;
    if (o.status === 'failed')    failed++;
  });

  const text =
    `📊 <b>Statistik KAMIL-SHOP</b>\n\n` +
    `💰 Total Revenue: <b>${rp(revenue)}</b>\n` +
    `📋 Total Orders: <b>${ordersSnap.size}</b>\n` +
    `⏳ Pending: <b>${pending}</b>\n` +
    `✅ Delivered: <b>${delivered}</b>\n` +
    `❌ Gagal: <b>${failed}</b>\n\n` +
    `📦 Total Produk: <b>${productsSnap.size}</b>\n` +
    `👤 Total Users: <b>${usersSnap.size}</b>`;

  const r = await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '◀️ Admin Menu', callback_data: 'admin_menu' },
          { text: '🌐 Analytics', url: `https://${SITE_DOMAIN}/admin/analytics` },
        ],
      ],
    },
  });
  set(chatId, { ...s, lastMsgId: msgIdFromResult(r) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── AUTH: Menu Login ─────────────────────────────────────────────────────────
async function authMenu(chatId: number, s: Session) {
  const text =
    `🔐 <b>Login ke KAMIL-SHOP</b>\n\n` +
    `Pilih metode login:`;

  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📧 Email + Password', callback_data: 'auth_email_pw' }],
        [{ text: '🔑 Email + OTP (tanpa password)', callback_data: 'auth_otp' }],
        [{ text: '🌐 Login dengan Google', url: `https://${SITE_DOMAIN}/auth/login` }],
        [{ text: '📝 Belum punya akun? Daftar', callback_data: 'auth_register' }],
        [{ text: '◀️ Kembali', callback_data: 'menu' }],
      ],
    },
  });
}

// ─── AUTH: Register Start ─────────────────────────────────────────────────────
async function registerStart(chatId: number, s: Session) {
  set(chatId, { ...s, step: 'auth_await_reg_name' });
  return sendMessage(chatId,
    `📝 <b>Daftar Akun KAMIL-SHOP</b>\n\n` +
    `Masukkan <b>nama lengkap</b> kamu:\n\n` +
    `<i>Ketik /batal untuk membatalkan</i>`
  );
}

// ─── AUTH: Login Email+Password ───────────────────────────────────────────────
async function authDoLoginPassword(chatId: number, userId: number, email: string, password: string, s: Session) {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || 'Login gagal';
      const friendly = msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('WRONG_PASSWORD') || msg.includes('EMAIL_NOT_FOUND')
        ? 'Email atau password salah.'
        : msg.includes('TOO_MANY_ATTEMPTS')
        ? 'Terlalu banyak percobaan. Coba lagi nanti.'
        : 'Login gagal. Coba lagi.';
      return sendMessage(chatId, `❌ ${friendly}`, {
        reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'auth_menu' }]] },
      });
    }

    // Simpan session login
    const db = getAdminDb();
    const snap = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    const displayName = snap.empty ? email.split('@')[0] : (snap.docs[0].data().displayName || email.split('@')[0]);

    set(userId, { step: 'idle', loggedInUserId: snap.empty ? data.localId : snap.docs[0].id, authEmail: email });

    return sendMessage(chatId,
      `✅ <b>Login berhasil!</b>\n\n` +
      `👤 ${esc(displayName)}\n` +
      `📧 ${esc(email)}`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🛒 Belanja Sekarang', callback_data: 'products' }],
        [{ text: '📦 Pesanan Saya', callback_data: 'my_orders' }],
        [{ text: '🏠 Menu Utama', callback_data: 'menu' }],
      ]}}
    );
  } catch {
    return sendMessage(chatId, '❌ Gagal menghubungi server. Coba lagi.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'auth_menu' }]] },
    });
  }
}

// ─── AUTH: Kirim OTP ──────────────────────────────────────────────────────────
async function authSendOtp(chatId: number, userId: number, email: string, s: Session) {
  try {
    const res = await fetch(`https://${SITE_DOMAIN}/api/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      return sendMessage(chatId, `❌ ${data.error || 'Gagal kirim OTP. Coba lagi.'}`, {
        reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'auth_menu' }]] },
      });
    }
    set(userId, { ...s, step: 'auth_await_otp_code', authEmail: email });
    return sendMessage(chatId,
      `📨 Kode OTP dikirim ke:\n<b>${esc(email)}</b>\n\n` +
      `Masukkan <b>6 digit kode OTP</b>:\n\n` +
      `<i>Berlaku 5 menit. Cek folder Inbox atau Promotions.</i>`
    );
  } catch {
    return sendMessage(chatId, '❌ Gagal kirim OTP. Coba lagi.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'auth_menu' }]] },
    });
  }
}

// ─── AUTH: Verifikasi OTP ─────────────────────────────────────────────────────
async function authVerifyOtp(chatId: number, userId: number, email: string, code: string, s: Session) {
  try {
    const res = await fetch(`https://${SITE_DOMAIN}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      return sendMessage(chatId, `❌ ${data.error || 'Kode OTP salah atau kedaluwarsa.'}`, {
        reply_markup: { inline_keyboard: [[{ text: '🔄 Kirim Ulang OTP', callback_data: 'auth_otp' }, { text: '◀️ Kembali', callback_data: 'auth_menu' }]] },
      });
    }
    const user = data.user;
    set(userId, { step: 'idle', loggedInUserId: user.id, authEmail: email });
    return sendMessage(chatId,
      `✅ <b>Login berhasil!</b>\n\n` +
      `👤 ${esc(user.displayName)}\n` +
      `📧 ${esc(email)}`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🛒 Belanja Sekarang', callback_data: 'products' }],
        [{ text: '📦 Pesanan Saya', callback_data: 'my_orders' }],
        [{ text: '🏠 Menu Utama', callback_data: 'menu' }],
      ]}}
    );
  } catch {
    return sendMessage(chatId, '❌ Gagal verifikasi. Coba lagi.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'auth_menu' }]] },
    });
  }
}

// ─── AUTH: Register ───────────────────────────────────────────────────────────
async function authDoRegister(chatId: number, userId: number, name: string, email: string, password: string, s: Session) {
  if (password.length < 6) {
    return sendMessage(chatId, '❌ Password minimal 6 karakter. Coba lagi:');
  }
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName: name, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || '';
      const friendly = msg.includes('EMAIL_EXISTS')
        ? 'Email sudah terdaftar. Silakan login.'
        : msg.includes('WEAK_PASSWORD')
        ? 'Password terlalu lemah. Minimal 6 karakter.'
        : 'Gagal mendaftar. Coba lagi.';
      return sendMessage(chatId, `❌ ${friendly}`, {
        reply_markup: { inline_keyboard: [[{ text: '🔐 Login', callback_data: 'auth_menu' }]] },
      });
    }

    // Simpan user ke Firestore
    const db = getAdminDb();
    const uid = data.localId;
    await db.collection('users').doc(uid).set({
      displayName: name,
      email: email.toLowerCase(),
      phone: '',
      role: 'user',
      totalOrders: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    set(userId, { step: 'idle', loggedInUserId: uid, authEmail: email });

    return sendMessage(chatId,
      `🎉 <b>Akun berhasil dibuat!</b>\n\n` +
      `👤 ${esc(name)}\n` +
      `📧 ${esc(email)}\n\n` +
      `Selamat berbelanja!`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🛒 Mulai Belanja', callback_data: 'products' }],
        [{ text: '🏠 Menu Utama', callback_data: 'menu' }],
      ]}}
    );
  } catch {
    return sendMessage(chatId, '❌ Gagal mendaftar. Coba lagi.', {
      reply_markup: { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'auth_register' }]] },
    });
  }
}

// ─── AUTH: Logout ─────────────────────────────────────────────────────────────
async function authLogout(chatId: number, userId: number, s: Session) {
  set(userId, { step: 'idle' });
  return sendMessage(chatId, '👋 Kamu sudah <b>logout</b>.', {
    reply_markup: { inline_keyboard: [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]] },
  });
}

function msgIdFromResult(r: unknown): number | undefined {
  try {
    return ((r as Record<string, unknown>).result as Record<string, unknown>)?.message_id as number;
  } catch { return undefined; }
}

// ─── Export: Notif admin Telegram saat order paid ────────────────────────────
export async function notifyAdminNewOrder(order: {
  orderId: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  totalPayment: number;
  paymentMethod: string;
  deliveryContent?: string;
}) {
  if (!ADMIN_ID || !BOT_TOKEN) return;
  const ok = !order.deliveryContent || order.deliveryContent !== 'STOK_HABIS';
  const text =
    `🔔 <b>Pembayaran Masuk!</b>\n\n` +
    `🆔 <code>${order.orderId}</code>\n` +
    `🏷️ <b>${esc(order.productName)}</b>\n` +
    `👤 ${esc(order.customerName)}\n` +
    `📧 ${esc(order.customerEmail)}\n` +
    `💰 <b>${rp(order.totalPayment)}</b>\n` +
    `💳 ${order.paymentMethod}\n` +
    `📦 ${ok ? '✅ Terkirim otomatis' : '⚠️ STOK HABIS — Kirim manual!'}`;

  await sendMessage(Number(ADMIN_ID), text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Lihat Order', url: `https://${SITE_DOMAIN}/admin/orders` }],
      ],
    },
  });
}
