import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ApiError, getProductReviews, postReview } from '../lib/api'
import { orderDate, plural } from '../lib/format'
import type { RatingSummary, Review, ReviewSort } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { CloseIcon, LeafMark } from './Icons'
import { StarPicker, Stars } from './Stars'
import { BrandButton, ErrorState, Loading } from './ui'

const PAGE = 5
// Matches the backend: up to 5 JPEG, PNG or WebP images of at most 5 MB each.
const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const SORTS: [ReviewSort, string][] = [['top', 'Top reviews'], ['latest', 'Latest']]

type Props = {
  productId: string
  productName: string
  // Called after a new review, so the rating under the product's name updates too.
  onRatingChange: (rating: RatingSummary) => void
}

export function ProductReviews({ productId, productName, onRatingChange }: Props) {
  // Opens on the top reviews; the shopper can switch to the latest, pick a star rating and page through.
  const [sort, setSort] = useState<ReviewSort>('top')
  const [stars, setStars] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [writing, setWriting] = useState(false)
  const [thanks, setThanks] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  const list = useFetch(
    (signal) => getProductReviews(productId, { sort, rating: stars ?? undefined, skip: (page - 1) * PAGE, limit: PAGE }, signal),
    `reviews|${productId}|${sort}|${stars}|${page}`,
  )
  const data = list.data
  const rating = data?.rating ?? null
  const count = rating?.count ?? 0
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE))

  const changeView = (next: { sort?: ReviewSort; stars?: number | null }) => {
    if (next.sort !== undefined) setSort(next.sort)
    if (next.stars !== undefined) setStars(next.stars)
    setPage(1)
  }
  const goToPage = (n: number) => {
    setPage(n)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // A new review waits for the store's approval, so the list and the stars don't change yet.
  const onPosted = (summary: RatingSummary) => {
    onRatingChange(summary)
    setWriting(false)
    setThanks(true)
  }

  return (
    <section className="section reviews" id="reviews" ref={sectionRef} aria-labelledby="reviews-title">
      <div className="section__head">
        <h2 id="reviews-title" className="section__title">Customer reviews</h2>
      </div>

      {list.loading && !data ? (
        <Loading label="Loading reviews…" />
      ) : list.error && !data ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : (
        <div className="reviews__layout">
          <aside className="reviews__summary">
            {count > 0 && rating?.average != null ? (
              <>
                <p className="reviews__average">
                  <span className="reviews__average-value">{rating.average.toFixed(1)}</span>
                  <span className="reviews__average-of">out of 5</span>
                </p>
                <Stars value={rating.average} size={22} />
                <p className="reviews__count">Based on {plural(count, 'review')}</p>
                {/* Each bar is also a filter: tap "4 ★" to read only the 4-star reviews. */}
                <ul className="reviews__bars" aria-label="Ratings breakdown">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const n = rating.breakdown[String(star)] ?? 0
                    return (
                      <li key={star}>
                        <button
                          type="button"
                          className="reviews__bar"
                          aria-pressed={stars === star}
                          disabled={!n}
                          onClick={() => changeView({ stars: stars === star ? null : star })}
                        >
                          <span className="reviews__bar-label">{star} ★</span>
                          <span className="reviews__bar-track" aria-hidden>
                            <span className="reviews__bar-fill" style={{ width: `${(n / count) * 100}%` }} />
                          </span>
                          <span className="reviews__bar-count">
                            {n}<span className="visually-hidden"> {n === 1 ? 'review' : 'reviews'} with {star} stars</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="reviews__none">No reviews yet. Bought {productName}? Be the first to tell others what you think.</p>
            )}
            {!writing && (
              <button className="reviews__write" onClick={() => { setWriting(true); setThanks(false) }}>Write a review</button>
            )}
          </aside>

          <div className="reviews__main">
            {thanks && <p className="notice" role="status">Thank you! Your review will appear here once the store has checked it.</p>}
            {writing && <ReviewForm productId={productId} onPosted={onPosted} onCancel={() => setWriting(false)} />}

            {count > 0 && (
              <div className="reviews__toolbar">
                <div className="reviews__chips" role="group" aria-label="Sort reviews">
                  {SORTS.map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={sort === value} onClick={() => changeView({ sort: value })}>{label}</button>
                  ))}
                </div>
                <div className="reviews__chips" role="group" aria-label="Filter by rating">
                  <button type="button" aria-pressed={stars === null} onClick={() => changeView({ stars: null })}>All</button>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <button key={star} type="button" aria-pressed={stars === star} disabled={!rating?.breakdown[String(star)]}
                      onClick={() => changeView({ stars: star })} aria-label={`${star} stars only`}>
                      {star} ★
                    </button>
                  ))}
                </div>
              </div>
            )}

            {list.error && <p className="field__error" role="alert">{list.error.message}</p>}

            {data && data.reviews.length > 0 ? (
              <>
                <p className="reviews__showing">
                  Showing {(page - 1) * PAGE + 1}–{(page - 1) * PAGE + data.reviews.length} of {plural(data.total, stars ? `${stars}-star review` : 'review')}
                </p>
                <ul className={`review-list${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading || undefined}>
                  {data.reviews.map((r) => <ReviewItem key={r.review_id} review={r} />)}
                </ul>
              </>
            ) : data && count > 0 ? (
              <p className="reviews__none">No {stars}-star reviews yet.</p>
            ) : null}

            {pages > 1 && <Pagination page={page} pages={pages} onChange={goToPage} />}
          </div>
        </div>
      )}
    </section>
  )
}

/** Previous, the page numbers (the first, the last and those around the current one), Next. */
function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (n: number) => void }) {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  return (
    <nav className="reviews__pager" aria-label="Review pages">
      <button type="button" className="reviews__page reviews__page--step" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      {shown.map((n, i) => (
        <span key={n} className="reviews__page-group">
          {i > 0 && n - shown[i - 1] > 1 && <span className="reviews__gap" aria-hidden>…</span>}
          <button type="button" className="reviews__page" aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}
            aria-label={`Page ${n}`}>{n}</button>
        </span>
      ))}
      <button type="button" className="reviews__page reviews__page--step" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  )
}

// Reviews longer than this many words open folded: the first PREVIEW_WORDS words, with the photos
// and the store's reply hidden until "Read more".
const PREVIEW_WORDS = 25

function ReviewItem({ review }: { review: Review }) {
  const [openImage, setOpenImage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const itemRef = useRef<HTMLLIElement>(null)
  const words = review.review_content.trim().split(/\s+/)
  const long = words.length > PREVIEW_WORDS
  const folded = long && !expanded
  const bodyId = `review-body-${review.review_id}`

  const collapse = () => {
    setExpanded(false)
    // Keep the review in view when a long one folds back up.
    const el = itemRef.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }

  return (
    <li className="review" ref={itemRef}>
      {/* Who and when first, then the stars and title: the order a shopper reads a review in. */}
      <p className="review__meta">
        <span className="review__avatar" aria-hidden>{review.display_name.trim().charAt(0).toUpperCase() || '?'}</span>
        <span className="review__author">{review.display_name}</span>
        <span aria-hidden className="review__dot">·</span>
        <time dateTime={review.created_at}>{orderDate(review.created_at).split(',')[0]}</time>
      </p>
      <div className="review__head">
        <Stars value={review.rating_score} size={16} />
        <h3 className="review__title">{review.review_title}</h3>
      </div>

      <div id={bodyId}>
        <p className="review__content">{folded ? `${words.slice(0, PREVIEW_WORDS).join(' ')}…` : review.review_content}</p>
        {!folded && <ReviewExtras review={review} onOpenImage={setOpenImage} />}
      </div>

      {long && (
        <button type="button" className="review__more" aria-expanded={expanded} aria-controls={bodyId}
          onClick={() => (expanded ? collapse() : setExpanded(true))}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {openImage && <ImageViewer src={openImage} onClose={() => setOpenImage(null)} />}
    </li>
  )
}

/** A review's photos and the store's reply. */
function ReviewExtras({ review, onOpenImage }: { review: Review; onOpenImage: (src: string) => void }) {
  return (
    <>
      {review.images_urls.length > 0 && (
        <div className="review__images">
          {review.images_urls.map((src, i) => (
            <button key={src} type="button" className="review__thumb" onClick={() => onOpenImage(src)} aria-label={`Open photo ${i + 1} from ${review.display_name}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {review.admin_reply && (
        <div className="review__reply">
          <p className="review__reply-from"><LeafMark size={18} /> Reply from Swahasree</p>
          <p>{review.admin_reply.reply_content}</p>
        </div>
      )}
    </>
  )
}

function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label="Review photo" onClick={onClose}>
      <button ref={closeRef} className="image-viewer__close" onClick={onClose} aria-label="Close photo"><CloseIcon /></button>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

type FieldErrors = Partial<Record<'rating' | 'name' | 'email' | 'title' | 'content' | 'images', string>>

function ReviewForm({ productId, onPosted, onCancel }: {
  productId: string
  onPosted: (rating: RatingSummary) => void
  onCancel: () => void
}) {
  const [score, setScore] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Object URLs for the chosen photos' previews, released when they change.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const picked = Array.from(list)
    const bad = picked.find((f) => !IMAGE_TYPES.includes(f.type))
    const big = picked.find((f) => f.size > MAX_IMAGE_BYTES)
    if (bad) setErrors((e) => ({ ...e, images: `${bad.name} must be a JPEG, PNG or WebP image.` }))
    else if (big) setErrors((e) => ({ ...e, images: `${big.name} is larger than 5 MB.` }))
    else if (files.length + picked.length > MAX_IMAGES) setErrors((e) => ({ ...e, images: `You can add up to ${MAX_IMAGES} photos.` }))
    else {
      setFiles((fs) => [...fs, ...picked])
      setErrors((e) => ({ ...e, images: undefined }))
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!score) e.rating = 'Choose a rating from 1 to 5 stars.'
    if (!name.trim()) e.name = 'Enter the name to show with your review.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.'
    if (!title.trim()) e.title = 'Give your review a short title.'
    if (!content.trim()) e.content = 'Tell others what you thought.'
    return e
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const found = validate()
    setErrors(found)
    setFormError(null)
    if (Object.values(found).some(Boolean)) return

    const form = new FormData()
    form.append('rating_score', String(score))
    form.append('display_name', name.trim())
    form.append('email_id', email.trim())
    form.append('review_title', title.trim())
    form.append('review_content', content.trim())
    files.forEach((f) => form.append('images', f))

    setBusy(true)
    try {
      const res = await postReview(productId, form)
      onPosted(res.rating)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not post your review. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      <h3>Write a review</h3>

      <div className={`field${errors.rating ? ' field--error' : ''}`}>
        <span className="field__label">Your rating</span>
        <StarPicker name={`rating-${productId}`} value={score} onChange={(n) => { setScore(n); setErrors((e) => ({ ...e, rating: undefined })) }} />
        {errors.rating && <p className="field__error">{errors.rating}</p>}
      </div>

      <div className="field-row">
        <div className={`field${errors.name ? ' field--error' : ''}`}>
          <label htmlFor="review-name">Your name</label>
          <input id="review-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} />
          {errors.name && <p className="field__error">{errors.name}</p>}
        </div>
        <div className={`field${errors.email ? ' field--error' : ''}`}>
          <label htmlFor="review-email">Email <span className="field__hint">(not shown publicly)</span></label>
          <input id="review-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email} />
          {errors.email && <p className="field__error">{errors.email}</p>}
        </div>
      </div>

      <div className={`field${errors.title ? ' field--error' : ''}`}>
        <label htmlFor="review-title">Title</label>
        <input id="review-title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fresh and full of flavour" aria-invalid={!!errors.title} />
        {errors.title && <p className="field__error">{errors.title}</p>}
      </div>

      <div className={`field${errors.content ? ' field--error' : ''}`}>
        <label htmlFor="review-content">Your review</label>
        <textarea id="review-content" rows={5} value={content} maxLength={5000} onChange={(e) => setContent(e.target.value)}
          placeholder="How was the quality, taste and packing?" aria-invalid={!!errors.content} />
        {errors.content && <p className="field__error">{errors.content}</p>}
      </div>

      <div className={`field${errors.images ? ' field--error' : ''}`}>
        <span className="field__label">Photos <span className="field__hint">(optional, up to {MAX_IMAGES})</span></span>
        <div className="review-form__photos">
          {previews.map((src, i) => (
            <div key={src} className="review-form__photo">
              <img src={src} alt={`Photo ${i + 1}`} />
              <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}><CloseIcon size={14} /></button>
            </div>
          ))}
          {files.length < MAX_IMAGES && (
            <label className="review-form__add">
              <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',')} multiple onChange={(e) => addFiles(e.target.files)} className="visually-hidden" />
              <span aria-hidden>+</span>
              <span>Add photo</span>
            </label>
          )}
        </div>
        {errors.images && <p className="field__error">{errors.images}</p>}
      </div>

      {formError && <p className="notice notice--warn" role="alert">{formError}</p>}

      <div className="review-form__actions">
        <BrandButton type="submit" busy={busy} disabled={busy}>Post review</BrandButton>
        <button type="button" className="text-button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}
