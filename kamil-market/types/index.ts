import type { Timestamp } from "firebase/firestore"

export type UserRole = "user" | "admin"

export type User = {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  role: UserRole
  createdAt: Timestamp
}

export type ProductCategory =
  | "bot-whatsapp"
  | "bot-telegram"
  | "jasa-website"
  | "script"
  | "template"
  | "tools"
  | "other"

export type DeliveryType = "download" | "email" | "manual"

export type Product = {
  id: string
  slug: string
  name: string
  description: string
  shortDesc: string
  price: number
  originalPrice?: number
  category: ProductCategory
  images: string[]
  thumbnail: string
  downloadUrl?: string
  deliveryType: DeliveryType
  deliveryContent?: string
  stock: number | "unlimited"
  sold: number
  rating: number
  reviewCount: number
  isActive: boolean
  isFeatured: boolean
  isFlashSale: boolean
  flashSaleEndAt?: Timestamp
  tags: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type OrderStatus = "pending" | "paid" | "failed" | "refunded"
export type PaymentMethod = "qris" | "url"

export type OrderItem = {
  productId: string
  name: string
  price: number
  qty: number
  thumbnail?: string
}

export type Order = {
  orderId: string
  buyerUid?: string
  buyerEmail: string
  buyerName: string
  products: OrderItem[]
  totalAmount: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  pakasirOrderId?: string
  qrisData?: string
  qrisExpiredAt?: Timestamp
  createdAt: Timestamp
  paidAt?: Timestamp
}

export type Review = {
  id: string
  productId: string
  userId: string
  userName: string
  userPhoto?: string
  rating: number
  comment: string
  createdAt: Timestamp
}

export type Category = {
  id: string
  name: string
  slug: string
  icon: string
  order: number
  isActive: boolean
}

export type OtpCode = {
  code: string
  expiresAt: Timestamp
}

export type SiteSettings = {
  siteName: string
  siteDescription: string
  bannerImages: string[]
  flashSaleActive: boolean
  flashSaleEndAt?: Timestamp
  whatsappNumber?: string
}

// NextAuth type augmentation
declare module "next-auth" {
  interface Session {
    user: {
      uid: string
      role: UserRole
      email: string
      name: string
      image?: string
    }
  }
  interface User {
    uid?: string
    role?: UserRole
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string
    role?: UserRole
  }
}
