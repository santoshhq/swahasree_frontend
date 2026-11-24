import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { LockIcon } from '../../components/Icons'
import { StatusPill } from '../../components/StatusPill'
import { ErrorState, Loading, ProductImage } from '../../components/ui'
import { allowOrderCod, getAdminOrder, getShippingMode, updateOrderStatus, type AdminOrder } from '../../lib/adminApi'
import { STATUS_LABELS, awaitsPayment, isPrepaid, money, orderDate, paymentMethodLabel, paymentStatusLabel } from '../../lib/format'
import type { OrderStatus } from '../../lib/types'
import { flavorSummary } from '../../lib/flavor'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { AlertIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Panel, Toast } from './AdminUi'
import { panel } from '../../lib/panelPath'

// Same rules as ALLOWED_TRANSITIONS in the backend's order_service.py.
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  // Only the payment (online, or switched to cash on delivery) moves it on; the admin can only cancel it.
  payment_pending: ['cancelled'],
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}

// Set by Shiprocket's tracking updates when the store hands shipping over to it (Store settings > Shipping).
const COURIER_STEPS: OrderStatus[] = ['shipped', 'out_for_delivery', 'delivered']

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm order',
  packed: 'Mark as packed',
  shipped: 'Mark as shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered, cash collected',
  returned: 'Mark as returned',
}

export function OrderAdminDetailPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('orders')
  const { orderId = '' } = useParams()
  const result = useFetch((signal) => getAdminOrder(orderId, signal), `admin-order|${orderId}`)
  // Not loaded (yet, or it failed): the buttons show, and the backend still refuses what Shiprocket owns.
  const shipping = useFetch((signal) => getShippingMode(signal), 'admin-shipping-mode')
  const courierDrives = !!shipping.data?.courier_drives_status
  const [updated, setUpdated] = useState<AdminOrder | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)

  if (result.loading && !result.data) return <Loading />
  if (result.error) return <ErrorState message={result.error.message} onRetry={result.reload} />
  const order = updated ?? result.data
  if (!order) return null

  const move = async (status: OrderStatus) => {
    setBusy(true)
    try {
      const res = await updateOrderStatus(order.order_id, status, note.trim())
      setUpdated(res.order)
      setNote('')
      setToast({ message: `Order ${order.order_number} is now ${STATUS_LABELS[status].toLowerCase()}.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const next = NEXT[order.status]
  // Handed over to Shiprocket: these come from the courier's tracking updates, not buttons.
  const byCourier = courierDrives ? next.filter((s) => COURIER_STEPS.includes(s)) : []
  const forward = next.filter((s) => s !== 'cancelled' && !byCourier.includes(s))
  const canCancel = next.includes('cancelled')
  const courierBooked = !!order.shipment?.pickup_scheduled_at
  // Not paid yet: confirming, the invoice and the courier stay locked until it is.
  const unpaid = awaitsPayment(order)
  const a = order.shipping_address

  return (
    <>
      <Link to={panel('/admin/orders')} className="admin-back">← All orders</Link>
      <AdminPageHead
        title={`Order ${order.order_number}`}
        subtitle={`Placed ${orderDate(order.created_at)}`}
        actions={
          <>
            <StatusPill status={order.status} />
            {unpaid ? (
              <button type="button" className="admin-button admin-button--ghost" disabled title="Available once the order is paid">
                <LockIcon size={16} /> Print invoice
              </button>
            ) : (
              <Link to={panel(`/admin/orders/${order.order_id}/invoice`)} target="_blank" className="admin-button admin-button--ghost">Print invoice</Link>
            )}
          </>
        }
      />

      <div className="detail-columns">
        <div className="detail-columns__main">
          <Panel title="Items">
            <ul className="admin-items">
              {order.items.map((item) => (
                <li key={`${item.is_free ? `free|${item.offer_id}|` : ''}${item.product_id}|${item.variant_name}`}>
                  <ProductImage src={item.image} alt="" className="admin-items__img" />
                  <span className="admin-items__name">
                    <Link to={panel(`/admin/products/${item.product_id}/edit`)}>{item.product_name}</Link>
                    <span>{item.variant_name} × {item.quantity} {item.is_free ? `free: ${item.offer_title}` : `at ${money(item.unit_price)}`}</span>
                    {item.customization && <span>{flavorSummary(item.customization)}</span>}
                  </span>
                  <span className="num">
                    {item.is_free ? <span className="free-price">FREE</span> : money(item.line_total)}
                    {item.is_free && item.free_value ? <span className="table__sub">worth {money(item.free_value)}</span> : null}
                    {item.discount > 0 && <span className="table__sub">−{money(item.discount)} coupon</span>}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="admin-totals">
              <div><dt>Subtotal</dt><dd>{money(order.pricing.subtotal)}</dd></div>
              {order.pricing.discount > 0 && <div><dt>Coupon {order.coupon?.code}</dt><dd>−{money(order.pricing.discount)}</dd></div>}
              <div><dt>Delivery</dt><dd>{order.pricing.shipping_fee ? money(order.pricing.shipping_fee) : 'Free'}</dd></div>
              {order.pricing.cod_fee > 0 && <div><dt>COD fee</dt><dd>{money(order.pricing.cod_fee)}</dd></div>}
              <div className="admin-totals__total"><dt>{unpaid ? 'Payment pending' : isPrepaid(order) ? `${paymentMethodLabel(order)}: ${paymentStatusLabel(order)}` : order.payment.status === 'collected' ? 'Collected' : 'To collect in cash'}</dt><dd>{money(order.pricing.total)}</dd></div>
            </dl>
            {order.payment.transaction_id && <p className="table__sub">Razorpay payment {order.payment.transaction_id}</p>}
          </Panel>

          <Panel title="History">
            <ol className="timeline">
              {[...order.status_history].reverse().map((h, i) => (
                <li key={i}>
                  <span className="timeline__dot" />
                  <div>
                    <strong>{STATUS_LABELS[h.status]}</strong>
                    <span className="timeline__meta">{orderDate(h.at)}, by {h.by}</span>
                    {h.note && <p className="timeline__note">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="detail-columns__side">
          {unpaid && <PaymentPendingPanel order={order} canEdit={can.edit} onUpdated={setUpdated} onToast={setToast} />}

          {can.edit && next.length > 0 && (
            <Panel title="Next step">
              {byCourier.length > 0 && (
                <p className="admin-hint admin-hint--tight">
                  {courierBooked || !canCancel
                    ? 'Shiprocket moves this order on from here: it marks it shipped, out for delivery and delivered as the courier updates the parcel.'
                    : 'Once the courier is booked, Shiprocket marks this order shipped, out for delivery and delivered as tracking updates arrive.'}
                </p>
              )}
              {(forward.length > 0 || canCancel) && (
                <>
                  <label htmlFor="status-note" className="admin-label">Note (optional, the customer sees it for cancellations)</label>
                  <textarea id="status-note" className="admin-input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder={courierDrives ? 'e.g. Customer asked to cancel' : 'e.g. Shipped with Delhivery, AWB 1234'} />
                  <div className="next-actions">
                    {unpaid && (
                      <button className="admin-button" disabled title="Locked until the order is paid">
                        <LockIcon size={16} /> Confirm order
                      </button>
                    )}
                    {forward.map((s) => (
                      <button key={s} className="admin-button" disabled={busy} onClick={() => move(s)}>
                        {s === 'delivered' && isPrepaid(order) ? 'Mark as delivered' : ACTION_LABELS[s] ?? STATUS_LABELS[s]}
                      </button>
                    ))}
                    {canCancel && (
                      <ConfirmButton
                        label="Cancel order"
                        confirm={{
                          title: 'Cancel this order?',
                          message: <p>{order.payment.status === 'paid'
                            ? "The items go back into stock and the customer's payment is refunded. This can't be undone."
                            : "The items go back into stock. This can't be undone."}</p>,
                          confirmLabel: 'Cancel order',
                          cancelLabel: 'Keep order',
                          icon: <AlertIcon size={22} />,
                        }}
                        className="admin-button admin-button--danger-ghost"
                        onConfirm={() => move('cancelled')}
                      />
                    )}
                  </div>
                </>
              )}
            </Panel>
          )}

          <Panel title="Customer">
            <p className="admin-address">
              <strong>{order.customer.full_name}</strong><br />
              <a href={`tel:+91${order.customer.mobile_number}`}>{order.customer.mobile_number}</a><br />
              <a href={`mailto:${order.customer.email_id}`}>{order.customer.email_id}</a>
            </p>
          </Panel>
          <Panel title="Deliver to">
            <p className="admin-address">
              {a.line1}<br />
              {a.line2 && <>{a.line2}<br /></>}
              {a.landmark && <>Near {a.landmark}<br /></>}
              {a.city}, {a.state} {a.pincode}
            </p>
            {order.notes && <p className="admin-callout"><strong>Customer note:</strong> {order.notes}</p>}
          </Panel>
        </div>
      </div>
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

/**
 * An online order the customer hasn't paid for. It stays here, not cancelled, until it is paid online
 * or switched to cash on delivery (by the customer, when the store takes COD or the admin allows it).
 */
function PaymentPendingPanel({ order, canEdit, onUpdated, onToast }: {
  order: AdminOrder
  canEdit: boolean
  onUpdated: (order: AdminOrder) => void
  onToast: (toast: { message: string; kind: 'success' | 'error' }) => void
}) {
  const [busy, setBusy] = useState(false)
  const allowed = !!order.payment.cod_allowed

  const toggleCod = async () => {
    setBusy(true)
    try {
      const res = await allowOrderCod(order.order_id, !allowed)
      onUpdated(res.order)
      onToast({ message: res.message, kind: 'success' })
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Payment pending">
      <p className="admin-callout admin-callout--flush">
        The customer hasn&rsquo;t paid for this order yet. Confirming, the invoice and booking the courier stay locked
        until it is paid online{order.cod_available ? ' or the customer switches it to cash on delivery' : ''}.
      </p>
      {order.stock_released_at && (
        <p className="admin-hint admin-hint--tight">
          The payment time ran out, so its items went back on sale. Paying takes them again if they&rsquo;re still in stock.
        </p>
      )}
      <p className="admin-hint admin-hint--tight">
        {allowed
          ? 'You allowed cash on delivery for this order. The customer can choose it on their order page.'
          : order.cod_available
            ? 'Your store takes cash on delivery, so the customer can switch to it on their order page.'
            : `Cash on delivery isn't open for this order (your store doesn't take it, or the order is above the COD limit). Allow it if the customer would rather pay in cash.`}
      </p>
      {canEdit && (allowed || !order.cod_available) && (
        <button type="button" className="admin-button admin-button--ghost" disabled={busy} onClick={toggleCod}>
          {busy ? 'Saving…' : allowed ? 'Turn off cash on delivery' : 'Allow cash on delivery'}
        </button>
      )}
    </Panel>
  )
}
