import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Link } from 'react-router'
import { getBanners } from '../lib/api'
import { DEFAULT_ANIMATION, type HeroAnimation } from '../lib/heroAnimations'
import { BANNER_HEIGHT, BANNER_WIDTH, type HeroSlide } from '../lib/heroSlides'
import { useFetch } from '../lib/useFetch'

// Limit the hero to the same number of slides as the admin panel.
const MAX_SLIDES = 5

// How long each banner stays before the next one comes in (see .hero--<animation> in App.css).
const INTERVAL_MS = 5000

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function HeroBanner({ fallback }: { fallback?: HeroSlide }) {
  const banners = useFetch((signal) => getBanners(signal), 'hero-banners')
  const uploaded = banners.data?.banners ?? []
  if (!uploaded.length && banners.loading) return <div className="hero__frame" aria-hidden />
  const slides = uploaded.slice(0, MAX_SLIDES).map((banner) => ({
    key: banner.banner_id,
    src: banner.image_url,
    link: banner.link,
    label: banner.alt_text ?? 'Shop the featured collection',
  }))
  return <HeroCarousel slides={slides} animation={banners.data?.animation ?? DEFAULT_ANIMATION} fallback={fallback} />
}

/**
 * The slideshow itself, also used for the live preview in the admin's animation picker.
 * preview: no links, no pause on hover, and a shorter wait, so the animation shows straight away.
 */
export function HeroCarousel({ slides: requested, animation, preview = false, fallback }: {
  slides: HeroSlide[]
  animation: HeroAnimation
  preview?: boolean
  fallback?: HeroSlide
}) {
  // Remove broken uploads from the rotation.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const uploaded = requested.filter((slide) => !failed.has(slide.src))
  const slides = !uploaded.length && fallback && !failed.has(fallback.src) ? [fallback] : uploaded
  const n = slides.length
  const animationMode = n > 1 ? animation : 'static'
  // prev: the banner on its way out, which some animations (slide, wipe) move as well.
  const [{ index, prev }, setPosition] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null })
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  // The first banner downloads on its own, so it isn't sharing the connection with banners nobody
  // can see yet; the rest start once it has arrived (or after a short wait, whichever is first).
  // A banner the shopper jumps to before then is fetched straight away.
  const [restReady, setRestReady] = useState(preview)
  useEffect(() => {
    if (restReady) return
    const timer = window.setTimeout(() => setRestReady(true), 2500)
    return () => window.clearTimeout(timer)
  }, [restReady])
  // If the list got shorter, stay within it.
  const current = n ? index % n : 0

  useEffect(() => {
    if (n < 2 || (paused && !preview) || (!preview && prefersReducedMotion())) return
    const timer = window.setInterval(() => {
      if (document.hidden) return
      setPosition((p) => ({ index: (p.index + 1) % n, prev: p.index % n }))
    }, preview ? 2600 : INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [n, paused, preview])

  if (!n) return null

  const show = (i: number) => {
    const next = ((i % n) + n) % n
    if (next !== current) setPosition({ index: next, prev: current })
  }

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0].clientX
    setPaused(true)
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current
    touchX.current = null
    setPaused(false)
    if (start === null) return
    const dx = e.changedTouches[0].clientX - start
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1))
  }

  return (
    <section
      className={`hero hero--${animationMode}${preview ? ' hero--preview' : ''}${paused && !preview ? ' is-paused' : ''}`}
      aria-roledescription={n > 1 ? 'carousel' : undefined}
      aria-label={preview ? 'Animation preview' : 'Featured'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="hero__frame">
        {slides.map((slide, i) => {
          const active = i === current
          const leaving = !active && i === prev
          const image = (
            <img
              src={i === 0 || active || restReady ? slide.src : undefined}
              alt=""
              className="hero__image"
              width={BANNER_WIDTH}
              height={BANNER_HEIGHT}
              fetchPriority={i === 0 && !preview ? 'high' : 'auto'}
              draggable={false}
              onLoad={i === 0 ? () => setRestReady(true) : undefined}
              onError={() => {
                if (i === 0) setRestReady(true)
                setFailed((set) => new Set(set).add(slide.src))
              }}
            />
          )
          return (
            <div
              key={slide.key}
              className={`hero__slide${active ? ' is-active' : leaving ? ' is-leaving' : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Banner ${i + 1} of ${n}`}
              aria-hidden={!active || undefined}
            >
              {preview ? (
                <div className="hero__link">{image}</div>
              ) : (
                <SlideLink link={slide.link} label={slide.label} focusable={active}>{image}</SlideLink>
              )}
            </div>
          )
        })}
      </div>

      {n > 1 && (
        <div className="hero__dots" role="group" aria-label="Choose banner">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              className="hero__dot"
              aria-label={`Show banner ${i + 1} of ${n}`}
              aria-pressed={i === current}
              onClick={() => show(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// A store page ("/category/...") opens in the app; a full https address is a normal link.
// No link of its own: the shop.
function SlideLink({ link, label, focusable, children }: { link: string | null; label: string; focusable: boolean; children: ReactNode }) {
  const tabIndex = focusable ? 0 : -1
  if (link && /^https?:\/\//.test(link)) {
    return <a href={link} className="hero__link" tabIndex={tabIndex} aria-label={label}>{children}</a>
  }
  return <Link to={link ?? '/shop'} className="hero__link" tabIndex={tabIndex} aria-label={label}>{children}</Link>
}
