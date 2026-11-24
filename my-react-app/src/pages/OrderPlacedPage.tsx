import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { useCart } from '../state/cart'
import { CheckIcon } from '../components/Icons'
import { BrandLink } from '../components/ui'
import { isPrepaid, money } from '../lib/format'
import type { Order } from '../lib/types'
import { usePageMeta } from '../lib/seo'

export function OrderPlacedPage() {
  usePageMeta({ title: 'Order placed', noindex: true })
  const order = (useLocation().state as { order?: Order } | null)?.order
  const { clear } = useCart()

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
            <p className="confirmation__number">Order number <strong>{order.order_number}</strong></p>
            <p>
              We've sent the details to <strong>{order.customer.email_id}</strong>.
              {isPrepaid(order)
                ? <>We've received your payment of <strong>{money(order.pricing.total)}</strong>.</>
                : <>Please keep <strong>{money(order.pricing.total)}</strong> ready to pay in cash when it arrives.</>}
            </p>
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
          <Link to="/account" className="text-button">Track this order</Link>
        </div>
      </section>
    </div>
  )
}
