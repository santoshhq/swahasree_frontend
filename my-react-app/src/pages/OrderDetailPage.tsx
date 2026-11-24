import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { CheckIcon } from '../components/Icons'
import { FreeBagLines } from '../components/Offers'
import { PayPendingOrder } from '../components/PayPendingOrder'
import { SignInPrompt } from '../components/SignInPrompt'
import { StatusPill } from '../components/StatusPill'
import { ErrorState, Loading, ProductImage } from '../components/ui'
import { ApiError, cancelMyOrder, getMyOrder } from '../lib/api'
import { awaitsPayment, CUSTOMER_CANCELLABLE, isPrepaid, money, ORDER_STEPS, orderDate, paymentStatusLabel, STATUS_LABELS, SUPPORT_EMAIL, trackingUrl } from '../lib/format'
import type { Order, OrderStatus } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../state/auth'
import { NotFoundPage } from './NotFoundPage'
import { usePageMeta } from '../lib/seo'

export function OrderDetailPage() {
  usePageMeta({ title: 'Your order', noindex: true })
  const { orderId = '' } = useParams()
  const { session, signOut } = useAuth()
  const token = session?.token ?? ''
  const result = useFetch((signal) => getMyOrder(token, orderId, signal), `order|${orderId}|${token}`)
  const [updated, setUpdated] = useState<Order | null>(null)
  // The sign-in lasts a day; after that, ask for a new code.
  const expired = result.error instanceof ApiError && (result.error.status === 401 || result.error.status === 403)
  useEffect(() => {
    if (expired) signOut('expired')
  }, [expired, signOut])

  if (!session || expired) return <SignInPrompt title="Your order" text="Sign in with the Google account you ordered with to see this order." />
  if (result.error instanceof ApiError && result.error.status === 404) return <NotFoundPage />
  if (result.error) return <div className="container page"><ErrorState message={result.error.message} onRetry={result.reload} /></div>
  const order = updated ?? result.data
  if (!order) return <div className="container page"><Loading /></div>

  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/account">Your orders</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{order.order_number}</span>
      </nav>
      <header className="page-head page-head--split">
        <div>
          <h1>Order {order.order_number}</h1>
          <p className="page-head__sub">Placed {orderDate(order.created_at)}</p>
        </div>
        <StatusPill status={order.status} />
      </header>

      {awaitsPayment(order) ? (
        // Not paid yet, so none of the delivery steps apply: the way forward is to pay for this order.
        <div className="notice notice--warn order-due order-due--detail" role="status">
          <p>
            <strong>Payment pending.</strong> Your order is saved and will be confirmed once it’s paid
            {order.cod_available ? ', online now or in cash when it arrives' : ''}. Nothing has been charged yet.
            {order.stock_released_at && ' Your items aren’t reserved any more, so paying checks they’re still in stock.'}
          </p>
          <PayPendingOrder order={order} token={token} onPlaced={setUpdated} />
        </div>
      ) : (
        <OrderProgress order={order} />
      )}

      <div className="checkout-layout">
        <section aria-labelledby="items-title">
          <h2 id="items-title" className="visually-hidden">Items</h2>
          <ul className="bag-list">
            {order.items.filter((item) => !item.is_free).map((item) => (
              <li key={`${item.product_id}|${item.variant_name}`} className="bag-line bag-line--static">
                <span className="bag-line__image"><ProductImage src={item.image} alt="" /></span>
                <div className="bag-line__info">
                  <span className="bag-line__name">{item.product_name}</span>
                  <span className="bag-line__variant">{item.variant_name} × {item.quantity}</span>
                  <span className="bag-line__unit">{money(item.unit_price)} each</span>
                </div>
                <p className="bag-line__total price">{money(item.line_total)}</p>
              </li>
            ))}
            <FreeBagLines items={order.items.filter((item) => item.is_free)} />
          </ul>

          <div className="detail-grid">
            <div>
              <h2>Delivering to</h2>
              <p>
                {order.customer.full_name}<br />
                {order.shipping_address.line1}<br />
                {order.shipping_address.line2 && <>{order.shipping_address.line2}<br /></>}
                {order.shipping_address.landmark && <>Near {order.shipping_address.landmark}<br /></>}
                {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.pincode}<br />
                {order.customer.mobile_number}
              </p>
            </div>
            {order.tracking?.awb && (
              <div className="order-tracking">
                <h2>Tracking</h2>
                <p>
                  {order.tracking.courier_name && <>{order.tracking.courier_name}<br /></>}
                  AWB {order.tracking.awb}<br />
                  {order.tracking.status && <>Latest: {order.tracking.status}<br /></>}
                  {order.tracking.etd && <>Expected by {order.tracking.etd}<br /></>}
                </p>
                <a className="text-button" href={trackingUrl(order.tracking.awb)} target="_blank" rel="noreferrer">Track parcel</a>
              </div>
            )}
            <div>
              <h2>Payment</h2>
              <p>
                {isPrepaid(order) ? 'Online payment' : 'Cash on delivery'}<br />
                {paymentStatusLabel(order)}
              </p>
            </div>
          </div>
        </section>

        <aside className="summary" aria-label="Order total">
          <h2>Total</h2>
          <dl className="summary__rows">
            <div><dt>Subtotal</dt><dd>{money(order.pricing.subtotal)}</dd></div>
            {order.pricing.discount > 0 && (
              <div className="summary__discount"><dt>Coupon {order.coupon?.code}</dt><dd>−{money(order.pricing.discount)}</dd></div>
            )}
            <div><dt>Delivery</dt><dd>{order.pricing.shipping_fee ? money(order.pricing.shipping_fee) : 'Free'}</dd></div>
            {order.pricing.cod_fee > 0 && <div><dt>Cash on delivery fee</dt><dd>{money(order.pricing.cod_fee)}</dd></div>}
            <div className="summary__total"><dt>{['collected', 'paid'].includes(order.payment.status) ? 'Paid' : order.payment.status === 'refunded' ? 'Refunded' : 'To pay'}</dt><dd>{money(order.pricing.total)}</dd></div>
          </dl>
          {CUSTOMER_CANCELLABLE.includes(order.status) && (
            <CancelOrder order={order} token={token} onCancelled={setUpdated} />
          )}
          <OrderHelp order={order} />
        </aside>
      </div>
    </div>
  )
}

// The normal journey is a real sequence, so it's shown as numbered steps.
function OrderProgress({ order }: { order: Order }) {
  if (order.status === 'cancelled' || order.status === 'returned') {
    const entry = [...order.status_history].reverse().find((h) => h.status === order.status)
    return (
      <p className="notice">
        This order was {STATUS_LABELS[order.status].toLowerCase()}
        {entry ? ` on ${orderDate(entry.at)}` : ''}
        {entry?.note ? `: ${entry.note}` : '.'}
      </p>
    )
  }
  const reached = ORDER_STEPS.indexOf(order.status)
  // Delivered is the end of the journey, so that step is done too rather than "current".
  const finished = reached === ORDER_STEPS.length - 1
  const when = new Map(order.status_history.map((h) => [h.status, h.at]))
  return (
    <ol className="progress" aria-label="Order progress">
      {ORDER_STEPS.map((step, i) => {
        const done = i < reached || (finished && i === reached)
        const current = i === reached && !finished
        return (
          <li key={step} className={`progress__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`} aria-current={i === reached ? 'step' : undefined}>
            <span className="progress__dot">{done ? <CheckIcon size={16} className="progress__check" /> : i + 1}</span>
            <span className="progress__label">{STATUS_LABELS[step]}</span>
            {when.get(step) && <span className="progress__time">{orderDate(when.get(step)!)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

function CancelOrder({ order, token, onCancelled }: { order: Order; token: string; onCancelled: (o: Order) => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return <button className="text-button text-button--danger" onClick={() => setOpen(true)}>Cancel this order</button>
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const { order: cancelled } = await cancelMyOrder(token, order.order_id, reason.trim())
      onCancelled(cancelled)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="cancel-box">
      <p><strong>Cancel order {order.order_number}?</strong> {order.payment.status === 'paid' ? `Your payment of ${money(order.pricing.total)} will be refunded to the same account in 5–7 working days.` : "You won't be charged anything."}</p>
      <label htmlFor="cancel-reason">Reason (optional)</label>
      <textarea id="cancel-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="field__error" role="alert">{error}</p>}
      <div className="cancel-box__actions">
        <button className="danger-button" onClick={confirm} disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel order'}</button>
        <button className="text-button" onClick={() => setOpen(false)} disabled={busy}>Keep order</button>
      </div>
    </div>
  )
}

// What a customer usually needs at each stage; each one opens an email to the store with the order filled in.
const HELP_TOPICS: Partial<Record<OrderStatus, string[]>> = {
  placed: ['Change my delivery address', 'Question about my order'],
  confirmed: ['Change my delivery address', 'Question about my order'],
  packed: ['Change my delivery address', 'Question about my order'],
  shipped: ['My parcel is late', 'Question about my order'],
  out_for_delivery: ['My parcel is late', 'Question about my order'],
  delivered: ['Return or replace an item', 'An item was damaged or missing', 'Question about my order'],
}

function OrderHelp({ order }: { order: Order }) {
  const topics = HELP_TOPICS[order.status] ?? ['Question about my order']
  const mailto = (topic: string) => {
    const subject = `${topic} - order ${order.order_number}`
    const body = [
      'Hello Swahasree,',
      '',
      `Order: ${order.order_number} (placed ${orderDate(order.created_at)})`,
      `Items: ${order.items.map((i) => `${i.product_name} ${i.variant_name} x ${i.quantity}`).join('; ')}`,
      '',
      'Please tell us what happened:',
      '',
    ].join('\n')
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  return (
    <div className="order-help">
      <h2>Need help with this order?</h2>
      <ul>
        {topics.map((topic) => (
          <li key={topic}><a href={mailto(topic)}>{topic}</a></li>
        ))}
      </ul>
      <p>We usually reply within a working day.</p>
    </div>
  )
}
