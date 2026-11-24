import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { isShownInStore } from '../lib/api'
import { shortName, titleCase } from '../lib/display'
import { money } from '../lib/format'
import { offersFor, useActiveOffers } from '../lib/offers'
import type { Product, Variant } from '../lib/types'
import { MAX_QUANTITY, useCart } from '../state/cart'
import { CartIcon, MinusIcon, PlusIcon, TrashIcon } from './Icons'
import { NotifyButton } from './NotifyButton'
import { RatingBadge } from './Stars'
import { ProductImage } from './ui'

/**
 * `variants` is the list the listing's price range leaves in view. Left out (home page, related
 * products, mobile listing), the card shows every variant exactly as before.
 */
export function ProductCard({ product, variants }: { product: Product; variants?: Variant[] }) {
  const { items, add, setQuantity, remove } = useCart()
  const sizeId = useId()
  const url = `/product/${product.product_id}`
  const images = product.product_imgs ?? []
  const image = images[0]
  const offer = offersFor(product, useActiveOffers())[0]

  const shownVariants = variants ?? product.variants
  // A filtered card is only as available as the variants still in its price range.
  const inStock = variants ? shownVariants.some((v) => v.in_stock) : product.in_stock

  // The size the card adds: the shopper's pick, or the first one in stock. Each size keeps its own
  // price, so the price shown is always the price of the size that "Add" puts in the cart.
  const firstInStock = shownVariants.find((v) => v.in_stock) ?? shownVariants[0]
  const [picked, setPicked] = useState<string | null>(null)
  const variant = shownVariants.find((v) => v.variant_name === picked && v.in_stock) ?? firstInStock
  const several = shownVariants.length > 1
  // Several out-of-stock sizes: the card advertises the cheapest one still in view.
  const cheapestInView = shownVariants.length ? Math.min(...shownVariants.map((v) => v.price)) : product.min_price
  const line = variant && items.find((i) => i.product_id === product.product_id && i.variant_name === variant.variant_name)

  // Pointing at a card with several photos shows them in turn; leaving goes back to the first.
  const [hovered, setHovered] = useState(false)
  const [slide, setSlide] = useState(0)
  const timer = useRef<number | null>(null)
  const startSlides = () => {
    if (images.length < 2 || timer.current !== null) return
    setHovered(true)
    setSlide(1)
    timer.current = window.setInterval(() => setSlide((n) => (n + 1) % images.length), 1200)
  }
  const stopSlides = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    setSlide(0)
  }
  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current)
  }, [])

  const addToCart = () => {
    if (!variant?.in_stock) return
    add({
      product_id: product.product_id, variant_name: variant.variant_name, product_name: product.product_name,
      price: variant.price, image: image ?? null, unavailable: false,
      net_weight_grams: variant.net_weight_grams, customization_settings: product.customization,
    }, 1)
  }

  const label = several && variant ? `${product.product_name}, ${variant.variant_name}` : product.product_name

  // Switched off by the admin ("Shown in the store"): leave it out of every grid completely.
  if (!isShownInStore(product)) return null

  return (
    <article className={`product-card${inStock ? '' : ' product-card--out'}`}>
      <Link to={url} className="product-card__media" tabIndex={-1} aria-hidden
        onMouseEnter={startSlides} onMouseLeave={stopSlides}>
        {images.length > 1 ? (
          <>
            {/* The other photos are only loaded once the shopper first points at the card. */}
            {(hovered ? images : images.slice(0, 1)).map((src, i) => (
              <ProductImage key={src} src={src} alt="" className={`product-card__slide${i === slide ? ' is-shown' : ''}`} />
            ))}
            {hovered && (
              <span className="product-card__dots">
                {images.map((src, i) => <span key={src} className={i === slide ? 'is-on' : ''} />)}
              </span>
            )}
          </>
        ) : (
          <ProductImage src={image} alt="" />
        )}
        {!inStock && <span className="tag tag--muted">Out of stock</span>}
        {inStock && offer && <span className="tag tag--offer">{offer.title}</span>}
      </Link>
      <div className="product-card__body">
        <p className="product-card__category">{titleCase(product.sub_category || product.category_name)}</p>
        <h3 className="product-card__name" title={product.product_name}><Link to={url}>{shortName(product.product_name)}</Link></h3>

        {several && inStock ? (
          <div className="product-card__size">
            <label htmlFor={sizeId} className="visually-hidden">Pack size for {product.product_name}</label>
            <select id={sizeId} value={variant?.variant_name} onChange={(e) => setPicked(e.target.value)}>
              {shownVariants.map((v) => (
                <option key={v.variant_name} value={v.variant_name} disabled={!v.in_stock}>
                  {v.variant_name}{v.in_stock ? '' : ' (out of stock)'}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="product-card__sizes">
            {several ? `${shownVariants.length} sizes` : <>Size<strong>{variant?.variant_name}</strong></>}
          </p>
        )}

        <RatingBadge average={product.rating_average} count={product.rating_count} />

        <div className="product-card__foot">
          <p className="price product-card__price">
            {inStock || !several ? money(variant?.price) : <><span className="price__from">from </span>{money(cheapestInView)}</>}
          </p>

          {!inStock ? (
            <NotifyButton productId={product.product_id} productName={product.product_name} />
          ) : line ? (
            // Already in the cart: the button becomes the cart's quantity for this size.
            <div className="card-stepper" role="group" aria-label={`${label} in your cart`}>
              <button type="button" onClick={() => (line.quantity > 1 ? setQuantity(line.product_id, line.variant_name, line.quantity - 1) : remove(line.product_id, line.variant_name))}
                aria-label={line.quantity > 1 ? `One less ${label}` : `Remove ${label} from cart`}>
                {line.quantity > 1 ? <MinusIcon size={16} /> : <TrashIcon size={16} />}
              </button>
              <output aria-live="polite" aria-label={`${line.quantity} in cart`}>
                {line.quantity}<span className="card-stepper__unit"> in cart</span>
              </output>
              <button type="button" onClick={() => setQuantity(line.product_id, line.variant_name, line.quantity + 1)}
                disabled={line.quantity >= MAX_QUANTITY} aria-label={`One more ${label}`}>
                <PlusIcon size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className="product-card__add" onClick={addToCart} aria-label={`Add ${label} to cart`}>
              <CartIcon size={16} />
              <span>Add to cart</span>
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
