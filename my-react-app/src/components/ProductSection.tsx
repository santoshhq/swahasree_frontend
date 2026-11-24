import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { isShownInStore } from '../lib/api'
import type { Product } from '../lib/types'
import { ChevronIcon } from './Icons'
import { ProductCard } from './ProductCard'

/** A section's heading: a small eyebrow, the title in the display face, and a quiet "View all". */
export function SectionHead({ id, eyebrow, title, intro, more, align = 'split' }: {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  more?: { to: string; label: string }
  // centre: the heading on its own, centred (trust, reviews).
  align?: 'split' | 'center'
}) {
  return (
    <div className={`section__head${align === 'center' ? ' section__head--center' : ''}`}>
      <div className="section__titles">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={id} className="section__title">{title}</h2>
        {intro && <p className="section__intro">{intro}</p>}
      </div>
      {more && <Link to={more.to} className="section__more">{more.label} <ChevronIcon size={16} /></Link>}
    </div>
  )
}

/** A titled row of product cards (home page, related products), with a link to the rest of them. */
export function ProductSection({ id, eyebrow, title, intro, more, products, contained = true, rail = false, children }: {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  more: { to: string; label: string }
  products?: Product[]
  // false: inside a page that already has its own .container (the product page).
  contained?: boolean
  // true: one row that scrolls sideways (with arrows on wider screens) rather than a wrapping grid.
  rail?: boolean
  // In place of the cards: a loading, error or empty state.
  children?: ReactNode
}) {
  return (
    <section className={`${contained ? 'container home-section ' : ''}section`} aria-labelledby={id}>
      <SectionHead id={id} eyebrow={eyebrow} title={title} intro={intro} more={more} />
      {children ?? (rail ? (
        <ProductRail label={title} products={products?.filter(isShownInStore) ?? []} />
      ) : (
        <div className="product-grid product-grid--row">
          {products?.filter(isShownInStore).map((p) => <ProductCard key={p.product_id} product={p} />)}
        </div>
      ))}
    </section>
  )
}

/**
 * Product cards in one sideways-scrolling row: four in view on a laptop, two on a phone. Swipe or
 * scroll it; the arrows move by a screenful and are switched off at either end.
 */
function ProductRail({ label, products }: { label: string; products: Product[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [ends, setEnds] = useState({ start: true, end: true })

  useEffect(() => {
    const el = track.current
    if (!el) return
    const update = () => setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [products.length])

  const move = (direction: 1 | -1) => {
    const el = track.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="product-rail">
      <div ref={track} className="product-rail__track" role="region" aria-label={label} tabIndex={0}>
        {products.map((p) => <ProductCard key={p.product_id} product={p} />)}
      </div>
      {!(ends.start && ends.end) && (
        <div className="product-rail__arrows">
          <button type="button" className="product-rail__arrow product-rail__arrow--back" onClick={() => move(-1)} disabled={ends.start} aria-label="Previous products">
            <ChevronIcon size={20} />
          </button>
          <button type="button" className="product-rail__arrow" onClick={() => move(1)} disabled={ends.end} aria-label="More products">
            <ChevronIcon size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
