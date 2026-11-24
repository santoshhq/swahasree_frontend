import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { ActionBar } from '../components/ActionBar'
import { FlavorPanel } from '../components/FlavorOptions'
import { TrashIcon } from '../components/Icons'
import { FreeCartLines, OfferNudges } from '../components/Offers'
import { QuantityStepper } from '../components/QuantityStepper'
import { BrandLink, EmptyState, ProductImage } from '../components/ui'
import { ApiError, getProduct, isShownInStore } from '../lib/api'
import { money, plural } from '../lib/format'
import { useOfferPreview } from '../lib/offers'
import type { Product } from '../lib/types'
import { useAuth } from '../state/auth'
import { cartFlavors, useCart, type CartItem } from '../state/cart'
import { useSignIn } from '../state/signIn'
import { usePageMeta } from '../lib/seo'

export function CartPage() {
  usePageMeta({ title: 'Your cart', noindex: true })
  const { items, count, subtotal, setQuantity, setFlavor, remove, replace } = useCart()
  const [checking, setChecking] = useState(false)
  const checkoutButton = useRef<HTMLAnchorElement>(null)
  const { session } = useAuth()
  const { openSignIn } = useSignIn()
  // Signed out, "Checkout" opens the sign-in popup first; once signed in it carries on to checkout.
  const toCheckout = (event: MouseEvent<HTMLAnchorElement>) => {
    if (session) return
    event.preventDefault()
    openSignIn({ from: '/checkout', purpose: 'checkout' })
  }
  const productIds = [...new Set(items.map((i) => i.product_id))].sort().join(',')
  // Free items from offers, shown under the paid ones; the order works them out again when placed.
  const offers = useOfferPreview(items.filter((i) => !i.unavailable).map(({ product_id, variant_name, quantity }) => ({ product_id, variant_name, quantity })))
  const freeItems = offers?.free_items ?? []

  // Prices or stock may have changed since things were added: refresh them from the store.
  useEffect(() => {
    if (!productIds) return
    const controller = new AbortController()
    setChecking(true)
    Promise.all(
      productIds.split(',').map((id) =>
        getProduct(id, controller.signal)
          .then((p): [string, Product | null] => [id, p])
          // 404: the product was removed or hidden. Other errors: keep the line as it is.
          .catch((err): [string, Product | null | undefined] => [id, err instanceof ApiError && err.status === 404 ? null : undefined]),
      ),
    )
      .then((results) => {
        const fresh = new Map(results)
        // Updater form: quantity changes made while this was loading are kept.
        replace((current) =>
          current.map((item): CartItem => {
            const product = fresh.get(item.product_id)
            if (product === undefined) return item
            const variant = product?.variants.find((v) => v.variant_name === item.variant_name)
            if (!product || !isShownInStore(product) || !variant || !variant.in_stock) return { ...item, unavailable: true }
            return {
              ...item, unavailable: false, price: variant.price, product_name: product.product_name,
              image: product.product_imgs?.[0] ?? item.image, net_weight_grams: variant.net_weight_grams,
              customization_settings: product.customization,
            }
          }),
        )
      })
      .catch(() => {})
      .finally(() => setChecking(false))
    return () => controller.abort()
    // Only re-check when the set of products changes, not on every quantity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds])

  if (!items.length) {
    return (
      <div className="container page">
        <EmptyState title="Your cart is empty">
          <p>Explore pickles and pantry favourites whenever you’re ready.</p>
          {/* A cart saved on another device (or from a reminder email) shows once signed in. */}
          {!session && (
            <p>
              Added items on another device?{' '}
              <button type="button" className="text-button" onClick={() => openSignIn({ from: '/cart' })}>Sign in</button>{' '}
              to see your saved cart.
            </p>
          )}
          <BrandLink to="/shop">Start shopping</BrandLink>
        </EmptyState>
      </div>
    )
  }

  const unavailable = items.filter((i) => i.unavailable)
  const flavours = cartFlavors(items)

  return (
    <div className="container page">
      <header className="page-head">
        <h1>Your cart</h1>
      </header>

      <div className="checkout-layout">
        <section aria-label="Items in your cart">
          {unavailable.length > 0 && (
            <p className="notice notice--warn" role="alert">
              {unavailable.length === 1 ? 'One item is' : `${unavailable.length} items are`} no longer available.
              Remove {unavailable.length === 1 ? 'it' : 'them'} to check out.
            </p>
          )}
          <ul className="cart-list">
            {items.map((item) => (
              <li key={`${item.product_id}|${item.variant_name}`} className={`cart-line${item.unavailable ? ' cart-line--out' : ''}`}>
                <Link to={`/product/${item.product_id}`} className="cart-line__image" tabIndex={-1} aria-hidden>
                  <ProductImage src={item.image} alt="" />
                </Link>
                <div className="cart-line__info">
                  <Link to={`/product/${item.product_id}`} className="cart-line__name">{item.product_name}</Link>
                  <span className="cart-line__variant">{item.variant_name}</span>
                  {item.unavailable ? (
                    <span className="tag tag--muted">Not available</span>
                  ) : (
                    <span className="cart-line__unit">{money(item.price)} each</span>
                  )}
                </div>
                <div className="cart-line__actions">
                  {!item.unavailable && (
                    <QuantityStepper value={item.quantity} onChange={(n) => setQuantity(item.product_id, item.variant_name, n)} label={item.product_name} />
                  )}
                  <button className="icon-button" onClick={() => remove(item.product_id, item.variant_name)} aria-label={`Remove ${item.product_name} ${item.variant_name}`}>
                    <TrashIcon />
                  </button>
                </div>
                <p className="cart-line__total price">{item.unavailable ? '' : money(item.price * item.quantity)}</p>
              </li>
            ))}
            <FreeCartLines items={freeItems} />
          </ul>
          {[...flavours].map(([id, group]) => group.grams > 0 && (
            <FlavorPanel key={id} {...group} onChange={(field, level) => setFlavor(id, field, level)} />
          ))}
          <OfferNudges nudges={offers?.nudges ?? []} />
        </section>

        <aside className="summary" aria-label="Order summary">
          <h2>Summary</h2>
          <dl className="summary__rows">
            {freeItems.length > 0 && <div><dt>Free items</dt><dd>{plural(freeItems.reduce((n, i) => n + i.quantity, 0), 'item')}</dd></div>}
            <div><dt>Delivery</dt><dd>At checkout, by PIN code</dd></div>
            <div className="summary__total"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          </dl>
          <p className="summary__note">Have a coupon? Add it at checkout, where you also choose how to pay.</p>
          {unavailable.length || checking ? (
            <button className="brand-button" disabled>
              <span>{checking ? 'Checking prices…' : 'Remove unavailable items'}</span>
              <span className="brand-button__dot" />
            </button>
          ) : (
            <BrandLink ref={checkoutButton} to="/checkout" className="summary__cta" onClick={toCheckout} hasPopup={!session}>Checkout</BrandLink>
          )}
        </aside>

        {/* Only while checkout is possible: the bar's target only exists then. */}
        {!unavailable.length && !checking && (
          <ActionBar target={checkoutButton}>
            <div className="action-bar__total">
              <span>Total · {plural(count, 'item')}</span>
              <strong className="price">{money(subtotal)}</strong>
            </div>
            <BrandLink to="/checkout" onClick={toCheckout} hasPopup={!session}>Checkout</BrandLink>
          </ActionBar>
        )}
      </div>
    </div>
  )
}
