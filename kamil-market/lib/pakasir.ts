const PAKASIR_SLUG = process.env.PAKASIR_SLUG ?? "kamil13str"
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY!
const PAKASIR_BASE = "https://app.pakasir.com"

export type PakasirQRISResponse = {
  status: boolean
  message: string
  data?: {
    order_id: string
    qr_string: string
    expired_at: string
    amount: number
  }
}

export async function createQRISPayment(
  orderId: string,
  amount: number
): Promise<PakasirQRISResponse> {
  const res = await fetch(`${PAKASIR_BASE}/api/transactioncreate/qris`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: PAKASIR_SLUG,
      order_id: orderId,
      amount,
      api_key: PAKASIR_API_KEY,
    }),
  })
  return res.json()
}

export function getPaymentURL(orderId: string, amount: number, redirectUrl?: string): string {
  let url = `${PAKASIR_BASE}/pay/${PAKASIR_SLUG}/${amount}?order_id=${orderId}`
  if (redirectUrl) url += `&redirect=${encodeURIComponent(redirectUrl)}`
  return url
}

export function generateOrderId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `KM-${timestamp}-${random}`
}
