import type { Order, OrderStatus } from './types'

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

export function money(amount: number | null | undefined): string {
  // Whole rupees without ".00", but keep paise when there are some (₹120 vs ₹99.50).
  const value = amount ?? 0
  return Number.isInteger(value) ? rupees.format(value).replace(/\.00$/, '') : rupees.format(value)
}

export const weightLabel = (grams: number) => grams < 1000 ? `${grams} g` : `${grams / 1000} kg`

export function orderDate(iso: string): string {
  // The backend sends UTC without a timezone suffix; mark it as UTC before converting.
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  payment_pending: 'Payment pending',
  placed: 'Order placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
}

// The normal journey of an order, in order. Cancelled and returned are exits from it.
export const ORDER_STEPS: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered']

// Matches the backend rule: customers can cancel until the order is packed, and an unpaid one any time.
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['payment_pending', 'placed', 'confirmed']

// "1 category", "3 categories".
// Shiprocket's public tracking page for a parcel.
export const trackingUrl = (awb: string) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`

export { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY, WHATSAPP_URL, WHATSAPP_DISPLAY } from './brand'

// Item prices already include 5% GST. This is the tax part of what the items cost after any coupon
// (₹105 holds ₹5), shown under the total only: it is not added to the amount, and delivery is left out.
export const GST_RATE = 0.05
export const taxIncluded = (itemsValue: number) => Math.round((itemsValue * GST_RATE) / (1 + GST_RATE) * 100) / 100

export const plural =(n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const isPrepaid = (order: Order) => order.payment.method === 'PREPAID'

// An online order placed but not paid for yet. It stays pending (never cancelled by itself) until it
// is paid online or switched to cash on delivery; until then it can't be confirmed, invoiced or shipped.
export const awaitsPayment = (order: Order) => order.status === 'payment_pending'

export function paymentMethodLabel(order: Order): string {
  if (order.payment.method === 'PARTIAL_PREPAID') return 'Partial COD'
  return isPrepaid(order) ? 'Online payment' : 'Cash on delivery'
}

export function partialPayment(order: Order) {
  const { method, status, amount_paise, balance_paise } = order.payment
  if (method !== 'PARTIAL_PREPAID' || amount_paise == null || balance_paise == null) return null
  const online = amount_paise / 100
  const balance = balance_paise / 100
  const onlineCollected = ['partially_paid', 'collected', 'refund_pending'].includes(status)
  const collected = status === 'collected' ? order.pricing.total : onlineCollected ? online : 0
  const pending = order.status === 'cancelled' || status === 'collected' ? 0 : onlineCollected ? balance : order.pricing.total
  return { online, balance, collected, pending }
}

// One short phrase for where the money stands, shared by the customer and admin screens.
export function paymentStatusLabel(order: Order): string {
  switch (order.payment.status) {
    case 'collected': return 'Cash collected'
    case 'paid': return 'Paid'
    case 'partially_paid': return 'Partially paid'
    case 'awaiting_payment': return 'Payment pending'
    case 'refund_pending': return 'Refund in progress'
    case 'refunded': return 'Refunded'
    case 'failed': return 'Payment not completed'
    case 'cancelled': return 'Not charged'
    default: return order.status === 'cancelled' ? 'Not charged' : 'Pay on delivery'
  }
}

export function discountText(c: { discount_type: 'fixed_amount' | 'percentage'; discount_value: number; max_discount_amount: number | null }): string {
  return c.discount_type === 'percentage'
    ? `${c.discount_value}% off, up to ${money(c.max_discount_amount)}`
    : `${money(c.discount_value)} off`
}
