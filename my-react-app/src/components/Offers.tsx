import { money } from '../lib/format'
import { offerRule } from '../lib/offers'
import type { OfferNudge, OrderItem, ShopOffer } from '../lib/types'
import { GiftIcon } from './Icons'
import { ProductImage } from './ui'

/** The offers on a product page: what to buy and what comes free. */
export function OfferBox({ offers }: { offers: ShopOffer[] }) {
  if (!offers.length) return null
  return (
    <ul className="offer-box" aria-label="Offers">
      {offers.map((o) => (
        <li key={o.offer_id}>
          <GiftIcon size={20} />
          <span>
            <strong>{o.title}</strong>
            <small>{offerRule(o)}{o.description ? `. ${o.description}` : ''}</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Free items in the cart and order detail lists: no price, no quantity buttons, the offer named. */
export function FreeCartLines({ items }: { items: OrderItem[] }) {
  return (
    <>
      {items.map((item) => (
        <li key={`free|${item.offer_id}|${item.product_id}|${item.variant_name}`} className="cart-line cart-line--static cart-line--free">
          <span className="cart-line__image"><ProductImage src={item.image} alt="" /></span>
          <div className="cart-line__info">
            <span className="cart-line__name">{item.product_name}</span>
            <span className="cart-line__variant">{item.variant_name} × {item.quantity}</span>
            <span className="cart-line__offer"><GiftIcon size={14} /> {item.offer_title}</span>
          </div>
          <p className="cart-line__total price">
            <span className="free-price">FREE</span>
            {item.free_value ? <s className="free-price__worth">{money(item.free_value)}</s> : null}
          </p>
        </li>
      ))}
    </>
  )
}

/** "Add 1 more to get ..." under the cart. */
export function OfferNudges({ nudges }: { nudges: OfferNudge[] }) {
  if (!nudges.length) return null
  return (
    <ul className="offer-nudges" role="status">
      {nudges.map((n) => (
        <li key={n.offer_id}><GiftIcon size={16} /> {n.message}</li>
      ))}
    </ul>
  )
}
