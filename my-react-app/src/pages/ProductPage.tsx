import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { FlavorPanel } from '../components/FlavorOptions'
import { CartIcon, CardIcon, CashIcon, CheckIcon } from '../components/Icons'
import { NotifyButton } from '../components/NotifyButton'
import { OfferBox } from '../components/Offers'
import { ProductDescription } from '../components/ProductDescription'
import { ProductSection } from '../components/ProductSection'
import { ProductReviews } from '../components/ProductReviews'
import { QuantityStepper } from '../components/QuantityStepper'
import { RatingBadge } from '../components/Stars'
import { BrandButton, ErrorState, Loading, ProductImage } from '../components/ui'
import { ApiError, getCategoryProducts, getPaymentOptions, getProduct, isShownInStore } from '../lib/api'
import { money } from '../lib/format'
import { flavorMinimumGrams } from '../lib/flavor'
import { offersFor, useActiveOffers } from '../lib/offers'
import { productJsonLd, snippet, usePageMeta } from '../lib/seo'
import type { FlavorSelection, PaymentMethod, Product, RatingSummary } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { addCartItem, cartFlavors, useCart } from '../state/cart'
import { NotFoundPage } from './NotFoundPage'

export function ProductPage() {
  const { productId = '' } = useParams()
  const product = useFetch((signal) => getProduct(productId, signal), `product|${productId}`)

  if (product.loading && !product.data) return <div className="container page"><Loading /></div>
  if (product.error) {
    return product.error instanceof ApiError && product.error.status === 404
      ? <NotFoundPage />
      : <div className="container page"><ErrorState message={product.error.message} onRetry={product.reload} /></div>
  }
  if (!product.data) return null
  // Switched off by the admin: the page is gone from the store, like a deleted product.
  if (!isShownInStore(product.data)) return <NotFoundPage />
  // key: a new product gets fresh state (selected size, photo, quantity).
  return <ProductDetail key={product.data.product_id} product={product.data} />
}

function ProductDetail({ product }: { product: Product }) {
  const { add, items, setFlavor } = useCart()
  const images = product.product_imgs ?? []
  const [imageIndex, setImageIndex] = useState(0)
  // Start on the first size that can actually be bought.
  const [variantName, setVariantName] = useState(
    (product.variants.find((v) => v.in_stock) ?? product.variants[0])?.variant_name,
  )
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [draftFlavors, setDraftFlavors] = useState<FlavorSelection>({})
  const offers = offersFor(product, useActiveOffers())
  const variant = product.variants.find((v) => v.variant_name === variantName)
  const pack = variant?.in_stock ? {
    product_id: product.product_id, variant_name: variant.variant_name, product_name: product.product_name,
    price: variant.price, image: images[0] ?? null, unavailable: false,
    net_weight_grams: variant.net_weight_grams, customization_settings: product.customization,
  } : null
  const productItems = items.filter((item) => item.product_id === product.product_id)
  const flavor = cartFlavors(productItems).get(product.product_id)
  const gramsInCart = flavor?.grams ?? 0
  const minimum = flavorMinimumGrams(product.customization)
  const unlockedInCart = minimum > 0 && gramsInCart >= minimum
  const previewGrams = pack && !added
    ? cartFlavors(addCartItem(productItems, pack, quantity)).get(product.product_id)?.grams ?? 0
    : gramsInCart
  // Starts from the product's numbers; a review posted on this page updates it.
  const [rating, setRating] = useState({ average: product.rating_average, count: product.rating_count })
  const onRatingChange = (r: RatingSummary) => setRating({ average: r.average, count: r.count })
  usePageMeta({
    title: `${product.product_name}: Buy Online`,
    description: snippet(product.description
      || `Buy ${product.product_name} online from Swahasree. Explore pack sizes and delivery options.`),
    image: images[0],
    jsonLd: productJsonLd(product, rating),
  })

  const related = useFetch(
    (signal) => getCategoryProducts(product.category_id, { limit: 6 }, signal),
    `related|${product.category_id}`,
  )
  const others = related.data?.products
    .filter((p) => p.product_id !== product.product_id && isShownInStore(p))
    .slice(0, 5) ?? []
  // How this store takes payment, so the note under the button is true for it.
  const payment = useFetch((signal) => getPaymentOptions(product.product_id, signal), `payment-options|${product.product_id}`)

  const addToCart = () => {
    if (!pack) return
    const includeDraft = minimum > 0 && previewGrams >= minimum && Object.keys(draftFlavors).length > 0
    add(includeDraft ? { ...pack, customization: draftFlavors } : pack, quantity)
    setDraftFlavors({})
    setAdded(true)
  }

  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden>/</span>
        <Link to={`/category/${product.category_id}`}>{product.category_name}</Link>
        {product.sub_category && (
          <>
            <span aria-hidden>/</span>
            <Link to={`/category/${product.category_id}/${encodeURIComponent(product.sub_category)}`}>{product.sub_category}</Link>
          </>
        )}
      </nav>

      <div className="product-detail">
        <div className="gallery">
          <ProductImage src={images[imageIndex]} alt={product.product_name} className={`gallery__main${product.in_stock ? '' : ' is-out'}`} />
          {images.length > 1 && (
            <div className="gallery__thumbs" role="group" aria-label="Product photos">
              {images.map((src, i) => (
                <button key={src} className="gallery__thumb" aria-pressed={i === imageIndex} aria-label={`Photo ${i + 1}`} onClick={() => setImageIndex(i)} onMouseEnter={() => setImageIndex(i)}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <Link to={`/category/${product.category_id}`} className="product-info__category">{product.sub_category || product.category_name}</Link>
          <h1>{product.product_name}</h1>
          <a href="#reviews" className="product-info__rating">
            {rating.count > 0
              ? <><RatingBadge average={rating.average} count={rating.count} size={18} /><span className="visually-hidden"> reviews</span></>
              : 'No reviews yet · Write the first'}
          </a>
          <div className="product-info__price-block">
            <p className="product-info__price price">{money(variant?.price ?? product.min_price)}</p>
            {/* Item prices include GST (lib/format.ts); checkout shows the tax part. */}
            <p className="product-info__price-note">{variant ? `${variant.variant_name} · ` : ''}Inclusive of all taxes</p>
          </div>
          <OfferBox offers={offers} />

          <fieldset className="sizes">
            <legend>Pack size</legend>
            <div className="sizes__options">
              {product.variants.map((v) => (
                <label key={v.variant_name} className={`size${v.in_stock ? '' : ' size--out'}`}>
                  <input
                    type="radio"
                    name="size"
                    value={v.variant_name}
                    checked={v.variant_name === variantName}
                    disabled={!v.in_stock}
                    onChange={() => { setVariantName(v.variant_name); setAdded(false) }}
                  />
                  <span className="size__name">{v.variant_name}</span>
                  <span className="size__price">{v.in_stock ? money(v.price) : 'Out of stock'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {variant?.in_stock ? (
            <div className="buy-row">
              <QuantityStepper value={quantity} onChange={(n) => { setQuantity(n); setAdded(false) }} label={product.product_name} />
              <BrandButton onClick={addToCart} className={added ? 'is-added' : ''} icon={added ? <CheckIcon /> : <CartIcon size={18} />}>
                {added ? 'Added to cart' : 'Add to cart'}
              </BrandButton>
            </div>
          ) : (
            <div className="notify-row">
              <p className="notice">This product is out of stock right now. Get an email as soon as it's back.</p>
              <NotifyButton productId={product.product_id} productName={product.product_name} variant="page" />
            </div>
          )}
          {added && <p className="added-note" role="status"><Link to="/cart">View your cart</Link> or keep shopping.</p>}
          {product.variants.some((v) => v.in_stock && v.net_weight_grams) && (
            <FlavorPanel name={product.product_name} grams={previewGrams} settings={product.customization}
              selection={unlockedInCart ? flavor?.selection : draftFlavors} preview={!unlockedInCart}
              onChange={(field, level) => {
                if (unlockedInCart) setFlavor(product.product_id, field, level, product.customization)
                else setDraftFlavors((current) => ({ ...current, [field]: level }))
              }} />
          )}
          {payment.data && <PaymentNote methods={payment.data.methods} />}

          {product.description && (
            <section className="product-info__description" aria-labelledby="about-title">
              <h2 id="about-title">About this product</h2>
              <ProductDescription text={product.description} />
            </section>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <ProductSection
          id="related-title"
          title={`More from ${product.category_name}`}
          more={{ to: `/category/${product.category_id}`, label: 'View all' }}
          products={others}
          contained={false}
        />
      )}

      {/* Last on the page: below the suggested products, just above the footer. */}
      <ProductReviews productId={product.product_id} productName={product.product_name} onRatingChange={onRatingChange} />
    </div>
  )
}

function PaymentNote({ methods }: { methods: PaymentMethod[] }) {
  const online = methods.includes('PREPAID')
  const cash = methods.includes('COD')
  return (
    <p className="pay-note">
      {online ? <CardIcon size={20} /> : <CashIcon size={20} />}
      {online && cash
        ? 'Pay online with UPI, card or net banking, or in cash on delivery.'
        : online
          ? 'Pay securely online with UPI, card or net banking.'
          : 'Pay in cash when your order is delivered.'}
    </p>
  )
}
