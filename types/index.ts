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
  status: 'pending' | 'paid' | 'delivered' | 'failed' | 'cancelled';
  deliveryContent?: string;
  promoCode?: string;
  discount?: number;
  affiliateCode?: string;
  createdAt?: Timestamp | Date;
  paidAt?: Timestamp | Date;
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
