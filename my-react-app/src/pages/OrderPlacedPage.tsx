import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { useCart } from '../state/cart'
import { CheckIcon } from '../components/Icons'
import { BrandLink } from '../components/ui'
import { flavorSummary } from '../lib/flavor'
import { isPrepaid, money, partialPayment } from '../lib/format'
import type { Order } from '../lib/types'
import { usePageMeta } from '../lib/seo'

export function OrderPlacedPage() {
  usePageMeta({ title: 'Order placed', noindex: true })
  const order = (useLocation().state as { order?: Order } | null)?.order
  const { clear } = useCart()
  const split = order && partialPayment(order)
  const customizedItems = order?.items.flatMap((item) => {
    const summary = flavorSummary(item.customization)
    return summary ? [{ item, summary }] : []
  }) ?? []

  // The order is saved, so the cart it came from is done with.
  useEffect(() => {
    if (order) clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.order_id])

  return (
    <div className="container page">
      <section className="confirmation">
        <span className="confirmation__mark"><CheckIcon size={32} /></span>
        <h1>Thank you, your order is placed</h1>
        {order ? (
          <>
            <p className="confirmation__number">Order ID <strong>{order.order_number}</strong></p>
            <p>
              We've sent the details to <strong>{order.customer.email_id}</strong>.
              {split
                ? <> We've received <strong>{money(split.online)}</strong> online. Pay <strong>{money(split.balance)}</strong> in cash on delivery.</>
                : isPrepaid(order)
                  ? <> We've received your payment of <strong>{money(order.pricing.total)}</strong>.</>
                  : <> Please keep <strong>{money(order.pricing.total)}</strong> ready to pay in cash when it arrives.</>}
            </p>
            {customizedItems.length > 0 && (
              <div className="confirmation__address">
                <h2>Customizations</h2>
                <ul>
                  {customizedItems.map(({ item, summary }) => (
                    <li key={`${item.product_id}|${item.variant_name}`}>
                      <strong>{item.product_name} · {item.variant_name}</strong><br />
                      {summary}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="confirmation__address">
              <h2>Delivering to</h2>
              <p>
                {order.customer.full_name}<br />
                {order.shipping_address.line1}
                {order.shipping_address.line2 && <>, {order.shipping_address.line2}</>}<br />
                {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.pincode}
              </p>
            </div>
          </>
        ) : (
          <p>We've emailed you the order details.</p>
        )}
        <div className="confirmation__actions">
          <BrandLink to="/shop">Continue shopping</BrandLink>
          <Link to="/track-order" state={{ orderId: order?.order_id }} className="text-button">Track this order</Link>
        </div>
      </section>
    </div>
  )
}
