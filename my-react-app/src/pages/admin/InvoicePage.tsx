import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { BRAND_LOGO as logo } from '../../lib/brand'
import { ErrorState, Loading } from '../../components/ui'
import { getAdminOrder } from '../../lib/adminApi'
import {
  awaitsPayment,
  isPrepaid,
  paymentStatusLabel,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
} from '../../lib/format'
import type { Address, Order } from '../../lib/types'
import { useFetch } from '../../lib/useFetch'
import { panel } from '../../lib/panelPath'
import './invoice.css'

const SELLER = {
  brand: 'Swahasree',
  legalName: import.meta.env.VITE_SELLER_LEGAL_NAME?.trim() || 'Swahasree',
  addressLines: (import.meta.env.VITE_SELLER_ADDRESS ?? '').split('|').map((line: string) => line.trim()).filter(Boolean),
  gstin: import.meta.env.VITE_SELLER_GSTIN?.trim(),
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Stable display invoice reference derived from the backend order ID.
 * This is a frontend reference, not a government/official invoice sequence.
 * Prefer o.invoice_number when the backend provides one.
 */
function invoiceCode(orderId: string): string {
  let seed = 0x811c9dc5
  for (let i = 0; i < orderId.length; i++) {
    seed = Math.imul(seed ^ orderId.charCodeAt(i), 0x01000193)
  }

  const next = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const code = Array.from(
    { length: 7 },
    () => CODE_CHARS[Math.floor(next() * CODE_CHARS.length)],
  )
  code[0] = CODE_CHARS[Math.floor(next() * 24)]
  code[6] = CODE_CHARS[24 + Math.floor(next() * 8)]
  return code.join('')
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const rupees = (amount: number) => inr.format(Number.isFinite(amount) ? amount : 0)

// The backend sends UTC without a timezone suffix; mark it as UTC before converting.
function invoiceDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function addressLines(address: Address): string[] {
  return [
    address.line1,
    address.line2,
    address.landmark ? `Near ${address.landmark}` : '',
    [address.city, address.state].filter(Boolean).join(', ') +
      (address.pincode ? ` - ${address.pincode}` : ''),
  ].filter(Boolean) as string[]
}

function amountDue(order: Order): number {
  if (order.status === 'cancelled') return 0
  switch (order.payment.status) {
    case 'pending':
    case 'awaiting_payment':
    case 'failed':
      return order.pricing.total
    default:
      return 0
  }
}

export function InvoicePage() {
  const { orderId = '' } = useParams()
  const order = useFetch(
    (signal) => getAdminOrder(orderId, signal),
    `invoice-order|${orderId}`,
  )
  const [printedOn] = useState(() => new Date().toISOString())
  const o = order.data

  useEffect(() => {
    if (o) document.title = `Invoice ${o.invoice_number || invoiceCode(o.order_id)}`
    return () => { document.title = 'Swahasree' }
  }, [o])

  if (order.loading && !o) return <Loading />
  if (order.error || !o) {
    return <ErrorState message={order.error?.message ?? 'Order not found'} onRetry={order.reload} />
  }

  if (awaitsPayment(o)) {
    return (
      <div className="invoice-page">
        <div className="invoice-toolbar no-print">
          <Link to={panel(`/admin/orders/${o.order_id}`)}>← Back to order</Link>
        </div>
        <section className="invoice-locked" role="status">
          <div className="invoice-locked__icon" aria-hidden="true">!</div>
          <h1>Invoice not available yet</h1>
          <p>
            Order <strong>{o.order_number}</strong> is awaiting payment. The invoice will become
            available once the payment is completed or the order is switched to cash on delivery.
          </p>
          <Link className="invoice-locked__link" to={panel(`/admin/orders/${o.order_id}`)}>
            Return to order
          </Link>
        </section>
      </div>
    )
  }

  const customer = o.customer
  const billing = o.billing_address ?? o.shipping_address
  const shipping = o.shipping_address
  const due = amountDue(o)
  const cancelled = o.status === 'cancelled'
  const invoiceNumber = o.invoice_number || invoiceCode(o.order_id)
  const issueDate = invoiceDate(o.invoice_date || printedOn)
  const paymentMode = isPrepaid(o) ? 'Prepaid (Online)' : 'Cash on Delivery'
  const paidOn = o.payment.collected_at ? invoiceDate(o.payment.collected_at) : null
  const discount = o.pricing.discount || o.coupon?.discount_amount || 0

  return (
    <main className="invoice-page">
      <div className="invoice-toolbar no-print">
        <Link className="invoice-toolbar__back" to={panel(`/admin/orders/${o.order_id}`)}>
          <span aria-hidden="true">←</span> Back to order
        </Link>
        <div className="invoice-toolbar__hint">A4 · Print or save as PDF</div>
        <button type="button" className="invoice-toolbar__print" onClick={() => window.print()}>
          <span aria-hidden="true">⎙</span> Print Invoice
        </button>
      </div>

      <article className={`invoice${cancelled ? ' invoice--cancelled' : ''}`} aria-label="Invoice">
        {cancelled && <div className="invoice__stamp" aria-hidden="true">CANCELLED</div>}

        <header className="invoice__head">
          <div className="invoice__seller">
            <img src={logo} alt={SELLER.brand} className="invoice__logo" />
            <p className="invoice__legal-name">{SELLER.legalName}</p>
            {SELLER.addressLines.length > 0 && (
              <address className="invoice__seller-address">
                {SELLER.addressLines.map((line: string) => <span key={line}>{line}</span>)}
              </address>
            )}
            {SELLER.gstin && <p className="invoice__gstin"><span>GSTIN</span>{SELLER.gstin}</p>}
          </div>

          <div className="invoice__title">
            <h2>Invoice</h2>
            <dl className="invoice__meta">
              <div><dt>Invoice No.</dt><dd>{invoiceNumber}</dd></div>
              <div><dt>Invoice Date</dt><dd>{issueDate}</dd></div>
              <div><dt>Order No.</dt><dd>{o.order_number}</dd></div>
              <div><dt>Order Date</dt><dd>{invoiceDate(o.created_at)}</dd></div>
            </dl>
          </div>
        </header>

        <section className="invoice__parties" aria-label="Billing and shipping addresses">
          <div className="invoice__party">
            <h3 className="invoice__label">Billing Address</h3>
            <p className="invoice__customer-name">{customer.full_name}</p>
            <p className="invoice__address">
              {addressLines(billing).map((line, index) => <span key={`billing-${index}`}>{line}</span>)}
            </p>
            <p className="invoice__contact">{customer.mobile_number || '—'}</p>
            {customer.email_id && <p className="invoice__contact">{customer.email_id}</p>}
          </div>

          <div className="invoice__party">
            <h3 className="invoice__label">Shipping Address</h3>
            <p className="invoice__customer-name">{customer.full_name}</p>
            <p className="invoice__address">
              {addressLines(shipping).map((line, index) => <span key={`shipping-${index}`}>{line}</span>)}
            </p>
            <p className="invoice__contact">{customer.mobile_number || '—'}</p>
          </div>
        </section>

        <table className="invoice__items">
          <thead>
            <tr>
              <th scope="col" className="invoice__col-sn">#</th>
              <th scope="col" className="invoice__col-description">Item</th>
              <th scope="col" className="invoice__col-qty num">Qty</th>
              <th scope="col" className="invoice__col-price num">Rate</th>
              <th scope="col" className="invoice__col-amount num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((item, index) => (
              <tr key={[item.is_free ? item.offer_id : '', item.product_id, item.variant_name].join('|')}>
                <td className="invoice__col-sn">{index + 1}</td>
                <td className="invoice__item-description">
                  <span className="invoice__product-name">{item.product_name}</span>
                  <span className="invoice__variant">
                    {item.variant_name}
                    {item.is_free && <>
                      {item.variant_name && ' · '}<span className="invoice__free-label">Free</span>
                      {item.offer_title && ` — ${item.offer_title}`}
                    </>}
                  </span>
                </td>
                <td className="num">{item.quantity}</td>
                <td className="num">{item.is_free ? '—' : rupees(item.unit_price)}</td>
                <td className="num invoice__line-amount">{item.is_free ? 'Free' : rupees(item.unit_price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="invoice__summary">
          <dl className="invoice__payment">
            <div><dt>Payment Mode</dt><dd>{paymentMode}</dd></div>
            <div><dt>Payment Status</dt><dd>{paymentStatusLabel(o)}</dd></div>
            {paidOn && <div><dt>{isPrepaid(o) ? 'Paid On' : 'Collected On'}</dt><dd>{paidOn}</dd></div>}
            {o.payment.transaction_id && (
              <div><dt>Transaction ID</dt><dd className="invoice__mono">{o.payment.transaction_id}</dd></div>
            )}
          </dl>

          <div className="invoice__totals">
            <dl className="invoice__breakdown">
              <div><dt>Subtotal</dt><dd>{rupees(o.pricing.subtotal)}</dd></div>
              {discount > 0 && (
                <div className="invoice__discount">
                  <dt>
                    Discount
                    {o.coupon?.code && <> (Coupon: <span className="invoice__coupon">{o.coupon.code}</span>)</>}
                  </dt>
                  <dd>− {rupees(discount)}</dd>
                </div>
              )}
              <div>
                <dt>Shipping</dt>
                <dd>{o.pricing.shipping_fee > 0 ? rupees(o.pricing.shipping_fee) : 'Free'}</dd>
              </div>
              {o.pricing.cod_fee > 0 && (
                <div><dt>COD Fee</dt><dd>{rupees(o.pricing.cod_fee)}</dd></div>
              )}
            </dl>
            <div className="invoice__grand-total">
              <span>Total (incl. all taxes)</span>
              <strong>{rupees(o.pricing.total)}</strong>
            </div>
            {!cancelled && (
              <div className={`invoice__due${due > 0 ? ' invoice__due--open' : ''}`}>
                <span>{due > 0 ? 'Amount Due' : 'Amount Paid'}</span>
                <strong>{rupees(due > 0 ? due : o.pricing.total)}</strong>
              </div>
            )}
          </div>
        </section>

        {o.notes && <section className="invoice__note"><strong>Note</strong><p>{o.notes}</p></section>}

        <footer className="invoice__footer">
          <p className="invoice__thanks">Thank you for shopping with {SELLER.brand}.</p>
          <p>{SUPPORT_PHONE_DISPLAY && <>{SUPPORT_PHONE_DISPLAY} · </>}{SUPPORT_EMAIL} · swahasree.com</p>
          <p className="invoice__generated">This is a computer-generated invoice.</p>
        </footer>
      </article>
    </main>
  )
}
