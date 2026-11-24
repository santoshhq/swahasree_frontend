// The admin's order sheet: every order matching the Orders page filters, one row per order,
// as a CSV that Excel and Google Sheets open directly.
import { getAdminOrders, type AdminOrder, type OrderFilters } from './adminApi'
import { STATUS_LABELS, paymentStatusLabel } from './format'

// Fetched a page at a time, the largest page the Orders page itself asks for.
const BATCH = 50

export async function fetchAllOrders(
  filters: Omit<OrderFilters, 'skip' | 'limit'>,
  onProgress?: (done: number, total: number) => void,
): Promise<AdminOrder[]> {
  const all: AdminOrder[] = []
  let total = Infinity
  while (all.length < total) {
    const page = await getAdminOrders({ ...filters, skip: all.length, limit: BATCH })
    total = page.total
    all.push(...page.orders)
    onProgress?.(all.length, total)
    // A short page means there's nothing more, whatever total said.
    if (page.orders.length < BATCH) break
  }
  return all
}

// The backend sends UTC without a time zone; shown as India time, "2026-10-03 16:05".
function indiaTime(iso: string): string {
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

const COLUMNS: [string, (o: AdminOrder) => string | number | null | undefined][] = [
  ['Order number', (o) => o.order_number],
  ['Placed on (IST)', (o) => indiaTime(o.created_at)],
  ['Status', (o) => STATUS_LABELS[o.status] ?? o.status],
  ['Customer name', (o) => o.customer.full_name],
  ['Email', (o) => o.customer.email_id],
  ['Mobile', (o) => o.customer.mobile_number],
  ['Address', (o) => [o.shipping_address.line1, o.shipping_address.line2, o.shipping_address.landmark].filter(Boolean).join(', ')],
  ['City', (o) => o.shipping_address.city],
  ['State', (o) => o.shipping_address.state],
  ['PIN code', (o) => o.shipping_address.pincode],
  ['Items', (o) => o.items.map((i) => `${i.product_name} (${i.variant_name}) x ${i.quantity}${i.is_free ? ' [free]' : ''}`).join('; ')],
  ['Item count', (o) => o.items.reduce((n, i) => n + i.quantity, 0)],
  ['Subtotal', (o) => o.pricing.subtotal],
  ['Discount', (o) => o.pricing.discount],
  ['Coupon', (o) => o.coupon?.code],
  ['Shipping', (o) => o.pricing.shipping_fee],
  ['COD fee', (o) => o.pricing.cod_fee],
  ['Total', (o) => o.pricing.total],
  ['Payment method', (o) => (o.payment.method === 'PREPAID' ? 'Online' : 'COD')],
  ['Payment status', (o) => paymentStatusLabel(o)],
  ['Transaction ID', (o) => o.payment.transaction_id],
  ['Courier', (o) => o.tracking?.courier_name ?? o.shipment?.courier_name],
  ['AWB', (o) => o.tracking?.awb ?? o.shipment?.awb],
  ['Notes', (o) => o.notes],
]

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  // Text starting like a formula would run as one in a spreadsheet; a leading ' keeps it text.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function ordersCsv(orders: AdminOrder[]): string {
  const lines = [COLUMNS.map(([title]) => cell(title)).join(',')]
  for (const o of orders) lines.push(COLUMNS.map(([, get]) => cell(get(o))).join(','))
  // The byte-order mark tells Excel the file is UTF-8 (names, ₹, other scripts).
  return `﻿${lines.join('\r\n')}\r\n`
}

export function downloadFile(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before the file is let go.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
