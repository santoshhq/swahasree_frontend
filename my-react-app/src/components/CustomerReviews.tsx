import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { getProductReviews } from '../lib/api'
import { shortName } from '../lib/display'
import { orderDate, SUPPORT_EMAIL } from '../lib/format'
import type { Product, Review } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { LeafMark, ArrowIcon } from './Icons'
import { Stars } from './Stars'
import { ErrorState, Loading } from './ui'

// Reviews are read from the product pages' own endpoint, so nothing here is invented: only the
// store-approved reviews rated above 4.3, newest first. Every card links back to the product where
// the review was written.
const MIN_RATING = 4.3
const LATEST_REVIEWS = 10

const FEEDBACK_LINK = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Feedback about my Swahasree experience')}`

// Long enough to read a review before the row moves on.
const AUTO_ADVANCE_MS = 6000

type HomeReview = Review & { productName: string }

// The latest qualifying reviews of every product that has any, merged into one newest-first list.
function loadReviews(products: Product[], signal: AbortSignal): Promise<HomeReview[]> {
  return Promise.all(
    products.map((p) =>
      getProductReviews(
        p.product_id,
        { sort: 'latest', skip: 0, limit: Math.max(p.rating_count, LATEST_REVIEWS) },
        signal,
      )
        .then((page) => page.reviews
          .filter((r) => r.rating_score > MIN_RATING)
          .map((r) => ({ ...r, productName: p.product_name })))
        // One product failing must not hide the reviews of the others.
        .catch(() => [] as HomeReview[]),
    ),
  )
    .then((groups) => groups.flat().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)))
    .then((reviews) => reviews.slice(0, LATEST_REVIEWS))
}

export function CustomerReviews({ products, loading = false }: { products: Product[]; loading?: boolean }) {
  // Every product that has approved reviews is checked, so the newest ones are never missed.
  const items = useMemo(() => products.filter((p) => p.rating_count > 0), [products])
  const ids = items.map((p) => p.product_id).join('|')
  const list = useFetch((signal) => loadReviews(items, signal), `home-reviews|${ids}`)

  return (
    <section className="home-reviews" aria-labelledby="home-reviews-title">
      <div className="container">
        <div className="home-reviews__head">
          <p className="eyebrow">Reviews</p>
          <h2 id="home-reviews-title" className="home-reviews__title">Loved by Our Customers</h2>
          <p className="home-reviews__lead">Real experiences from people who shop with Swahasree.</p>
        </div>

        {loading || (list.loading && !list.data) ? (
          <Loading label="Loading reviews…" />
        ) : list.error && !list.data ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : list.data?.length ? (
          <ReviewCarousel reviews={list.data} />
        ) : (
          <EmptyReviews />
        )}
      </div>
    </section>
  )
}

/**
 * The approved reviews, a page at a time: three cards on a laptop, two on a tablet, one on a phone
 * (set by the rail's columns in CSS). Arrows and page dots move a whole page; the rail still
 * swipes. It advances by itself and starts again after the last page, holds still while the
 * pointer or keyboard focus is on it, and never moves on its own for reduced-motion readers.
 */
function ReviewCarousel({ reviews }: { reviews: HomeReview[] }) {
  const railRef = useRef<HTMLUListElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)
  const paused = hovered || focused

  // Pages follow the rail's width: recount on resize, and track the page as the rail scrolls.
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const measure = () => {
      const card = rail.firstElementChild as HTMLElement | null
      if (!card) return
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0
      const pageWidth = rail.clientWidth + gap
      // Cards per page, then pages of that many (the last page may be part-full).
      const perPage = Math.max(1, Math.round(pageWidth / (card.getBoundingClientRect().width + gap)))
      const count = Math.ceil(rail.children.length / perPage)
      setPages(count)
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2
      setPage(atEnd ? count - 1 : Math.min(count - 1, Math.round(rail.scrollLeft / pageWidth)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    rail.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      rail.removeEventListener('scroll', measure)
    }
  }, [reviews.length])

  const goTo = (target: number) => {
    const rail = railRef.current
    if (!rail) return
    const next = (target + pages) % pages
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollTo({ left: next * (rail.clientWidth + gap), behavior: reduce ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (paused || pages < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (!document.hidden) goTo(page + 1)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(timer)
  })

  return (
    <div
      className="home-reviews__carousel"
      onPointerEnter={(event) => {
        // Touch never hovers, so a tap must not leave the row paused.
        if (event.pointerType !== 'touch') setHovered(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') setHovered(false)
      }}
      onFocus={(event) => {
        // Only a keyboard focus should hold the row; a click or tap keeps it moving.
        if ((event.target as HTMLElement).matches(':focus-visible')) setFocused(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <ul ref={railRef} className="home-reviews__rail" tabIndex={0} aria-label="Customer reviews">
        {reviews.map((review) => <ReviewCard key={review.review_id} review={review} />)}
      </ul>

      {pages > 1 && (
        <div className="home-reviews__controls">
          <button type="button" className="home-reviews__arrow" aria-label="Previous reviews" onClick={() => goTo(page - 1)}>
            <ArrowIcon size={18} className="home-reviews__arrow-icon--back" />
          </button>
          <div className="home-reviews__dots" role="group" aria-label="Review pages">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`home-reviews__dot${i === page ? ' is-active' : ''}`}
                aria-label={`Show review page ${i + 1} of ${pages}`}
                aria-current={i === page ? 'true' : undefined}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button type="button" className="home-reviews__arrow" aria-label="Next reviews" onClick={() => goTo(page + 1)}>
            <ArrowIcon size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

function ReviewCard({ review }: { review: HomeReview }) {
  const photo = review.images_urls[0]
  const initial = review.display_name.trim().charAt(0).toUpperCase() || '?'
  return (
    <li className="home-review">
      <div className="home-review__head">
        <span className="home-review__avatar" aria-hidden>{initial}</span>
        <div className="home-review__who">
          <p className="home-review__name">{review.display_name}</p>
          <time className="home-review__date" dateTime={review.created_at}>
            {orderDate(review.created_at).split(',')[0]}
          </time>
        </div>
      </div>

      <Stars value={review.rating_score} size={16} />
      <h3 className="home-review__title">{review.review_title}</h3>
      <ReviewText text={review.review_content} />

      <div className="home-review__foot">
        <Link to={`/product/${review.product_id}`} className="home-review__product">{shortName(review.productName)}</Link>
        {photo && (
          <img className="home-review__photo" src={photo} alt={`Photo shared by ${review.display_name}`}
            loading="lazy" decoding="async" />
        )}
      </div>
    </li>
  )
}

// The review in four lines at most; a long one gets "Read more" to open the rest in place.
const CLAMP_CHARS = 180
function ReviewText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const long = text.length > CLAMP_CHARS
  return (
    <>
      <p id={id} className={`home-review__text${long && !open ? ' is-clamped' : ''}`}>{text}</p>
      {long && (
        <button type="button" className="home-review__more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {open ? 'Read less' : 'Read more'}
        </button>
      )}
    </>
  )
}

// Shown until the store has approved reviews to display: an invitation, never a made-up rating.
function EmptyReviews() {
  return (
    <div className="home-reviews__empty">
      <span className="home-reviews__empty-mark" aria-hidden><LeafMark size={40} /></span>
      <h3>Your Experience Matters.</h3>
      <p>Have you shopped with us? Share your feedback and help others discover Swahasree.</p>
      <div className="home-reviews__empty-actions">
        <a className="brand-button home-reviews__empty-cta" href={FEEDBACK_LINK}>
          <span>Share Your Feedback</span>
          <span className="brand-button__dot"><ArrowIcon size={17} /></span>
        </a>
        <Link className="home-reviews__empty-secondary" to="/account">Review a product you bought</Link>
      </div>
    </div>
  )
}
