/**
 * types/index.ts (UPDATED)
 *
 * Penambahan field untuk mendukung produk Top Up Game:
 * - Product.productType: 'stock' | 'topup-game'
 * - Product.qiospayProduct: kode produk Qiospay
 * - Product.gameName: nama game
 * - Product.needsZoneId: apakah butuh Zone/Server ID
 * - Product.needsNick: apakah butuh Nickname
 * - Order.productType, gameDestination, gameZoneId, topupStatus, dll.
 */

import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  role: 'admin' | 'user';
  totalOrders: number;
  referralCode?: string;
  referredBy?: string;
  affiliateBalance?: number;
  balance?: number;
  createdAt?: Timestamp | Date;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  features: string[];
  price: number;
  originalPrice: number;
  category: string;
  imageUrl: string;
  badge: 'bestseller' | 'new' | '' | 'flash-sale';
  rating: number;
  ratingCount?: number;
  totalSold: number;
  stock: string[];
  contentType?: 'text' | 'link';
  isActive: boolean;
  flashSalePrice?: number;
  flashSaleEnd?: string;
  bundleIds?: string[];
  bundlePrice?: number;
  createdAt?: Timestamp | Date;

  // ─── Tambahan untuk Top Up Game ────────────────────────────────
  /** 'stock' = kirim dari stok, 'topup-game' = proses via Qiospay H2H */
  productType?: 'stock' | 'topup-game';
  /** Kode produk Qiospay (contoh: 'ML5', 'FFP5', 'CODM10') */
  qiospayProduct?: string;
  /** Nama game (contoh: 'Mobile Legends', 'Free Fire') */
  gameName?: string;
  /** Apakah transaksi membutuhkan Zone/Server ID */
  needsZoneId?: boolean;
  /** Apakah transaksi membutuhkan Nickname */
  needsNick?: boolean;
  /** Label field ID (default: 'User ID') */
  idLabel?: string;
  /** Label field Zone (default: 'Zone ID / Server') */
  zoneLabel?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
}

export interface Order {
  id?: string;
  orderId: string;
  userId?: string;
  productId: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  customerWhatsApp: string;
  amount: number;
  fee: number;
  totalPayment: number;
  paymentMethod: string;
  paymentNumber: string;
  expiredAt: string;
  status: 'pending' | 'paid' | 'delivered' | 'failed' | 'cancelled' | 'topup_failed';
  deliveryContent?: string;
  promoCode?: string;
  discount?: number;
  affiliateCode?: string;
  createdAt?: Timestamp | Date;
  paidAt?: Timestamp | Date;
  cancelledAt?: Timestamp | Date;

  // ─── Tambahan untuk Top Up Game ────────────────────────────────
  /** Tipe produk — menentukan alur delivery */
  productType?: 'stock' | 'topup-game';
  /** Nama game */
  gameName?: string;
  /** Kode produk Qiospay */
  qiospayProduct?: string;
  /** User ID / Player ID game */
  gameDestination?: string;
  /** Zone ID / Server ID (opsional, tergantung game) */
  gameZoneId?: string;
  /** Status topup dari Qiospay: processing | success | failed | config_error */
  topupStatus?: string;
  /** Pesan/respons dari Qiospay */
  topupNote?: string;
  /** Respons mentah dari Qiospay */
  topupRaw?: string;
  /** Apakah topup sudah dikirim ke Qiospay (mencegah double-send) */
  topupSent?: boolean;
  topupSentAt?: Timestamp | Date;
  topupUpdatedAt?: Timestamp | Date;
  topupCallbackAt?: Timestamp | Date;
  topupFailedAt?: Timestamp | Date;
}

export interface PromoCode {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrder?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiredAt?: string;
  createdAt?: Timestamp | Date;
}

export interface Deposit {
  id?: string;
  depositId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  fee: number;
  totalPayment: number;
  paymentMethod: string;
  paymentNumber: string;
  expiredAt: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  createdAt?: Timestamp | Date;
  paidAt?: Timestamp | Date;
  cancelledAt?: Timestamp | Date;
}

export interface AffiliateTransaction {
  id: string;
  affiliateUserId: string;
  referredUserId: string;
  orderId: string;
  commission: number;
  status: 'pending' | 'paid';
  createdAt?: Timestamp | Date;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  orderId: string;
  displayName: string;
  rating: number;
  comment: string;
  createdAt?: Timestamp | Date;
}

export interface SiteSettings {
  siteName: string;
  pakasirSlug: string;
  pakasirApiKey: string;
  maintenanceMode: boolean;
  tagline?: string;
  affiliateCommissionPercent?: number;
  affiliateMinWithdraw?: number;
  depositMin?: number;
  depositMax?: number;
  // Qiospay settings (disimpan di Firestore settings/site)
  qiospayMemberId?: string;
  qiospayPin?: string;
  qiospayPassword?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutForm {
  customerName: string;
  customerEmail: string;
  customerWhatsApp: string;
  paymentMethod: string;
  promoCode?: string;
  // Tambahan untuk topup-game
  gameDestination?: string;
  gameZoneId?: string;
}

export interface PaymentData {
  order_id: string;
  payment_number: string;
  amount: number;
  fee: number;
  total_payment: number;
  expired_at: string;
  method: string;
  status: string;
}

export interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  totalCustomers: number;
}

// ─── Data statis game dari Qiospay ────────────────────────────────────────────
export interface GameProduct {
  code: string;
  name: string;
  price: number;
}

export interface GameData {
  name: string;
  slug: string;
  icon: string;
  needsZoneId: boolean;
  needsNick: boolean;
  products: GameProduct[];
}
