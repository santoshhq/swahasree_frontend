import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Copy } from 'lucide-react'
import { Link } from 'react-router'
import { getAnnouncement, type AnnouncementLine, type PublicAnnouncement } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { CheckIcon } from './Icons'

// How long each line stays before the next one fades in (static bar with more than one line).
const LINE_SECONDS = 4
// How long "Copied" stays on the coupon button before it offers the copy again.
const COPIED_SECONDS = 2

type StripProps = Pick<PublicAnnouncement, 'content' | 'height_px' | 'background_color' | 'text_color' | 'scroll_style' | 'scroll_seconds'> & {
  // Admin preview: drawn inside the panel, not as a page landmark.
  preview?: boolean
}

// Bars saved before lines could carry a coupon or link come back as plain strings from old data.
const asLine = (line: AnnouncementLine | string): AnnouncementLine =>
  typeof line === 'string' ? { text: line, coupon_code: null, link: null } : line

// "//host" is a web address too, so it is never handed to the router as a store page.
const isWebAddress = (link: string) => /^(?:https?:)?\/\//i.test(link)

/**
 * The bar itself, with its own height and colours. Static: the text stays still and several lines
 * take turns. Scrolling: all the lines run across the bar in one row, one pass every scroll_seconds.
 * Each line can also carry a coupon code (copied with one tap) and a link to a store page.
 */
export function AnnouncementStrip({ content, height_px, background_color, text_color, scroll_style, scroll_seconds, preview = false }: StripProps) {
  const lines = content
    .map(asLine)
    .map((line) => ({ ...line, text: line.text.trim() }))
    .filter((line) => line.text)
  const count = lines.length
  const scrolling = scroll_style !== 'static'

  if (!count) return null
  const style = {
    '--announce-height': `${height_px}px`,
    '--announce-bg': background_color,
    '--announce-fg': text_color,
    '--announce-seconds': `${scroll_seconds}s`,
  } as CSSProperties

  return (
    <div
      className={`announcement-bar${scrolling ? ` announcement-bar--scroll announcement-bar--${scroll_style}` : ''}${preview ? ' announcement-bar--preview' : ''}`}
      style={style}
      role={preview ? undefined : 'region'}
      aria-label={preview ? undefined : 'Store announcement'}
    >
      {scrolling
        ? (
          <ScrollingLines lines={lines} preview={preview} />
        )
        : <RotatingLines lines={lines} live={!preview} preview={preview} />}
    </div>
  )
}

function ScrollingLines({ lines, preview }: { lines: AnnouncementLine[]; preview: boolean }) {
  const run = useRef<HTMLParagraphElement>(null)
  const [distance, setDistance] = useState(0)

  useEffect(() => {
    const element = run.current
    if (!element) return
    const measure = () => setDistance(Math.round(element.getBoundingClientRect().width))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const style = distance ? {
    '--announce-distance': `${distance}px`,
    animationTimingFunction: `steps(${distance}, end)`,
  } as CSSProperties : undefined

  return (
    <div className="announcement-bar__track">
      <p ref={run} className="announcement-bar__run" style={style}>
        {lines.map((line, i) => <span key={i}><Line line={line} preview={preview} /></span>)}
      </p>
    </div>
  )
}

/** One line: its text (linked when the admin set a link), then a coupon pill when there is a code. */
function Line({ line, preview }: { line: AnnouncementLine; preview: boolean }) {
  const linked = Boolean(line.link && !preview)
  const text = line.link && !linked
    ? <span className="announcement-bar__link">{line.text}</span>
    : line.link
      ? isWebAddress(line.link)
        ? <a className="announcement-bar__link" href={line.link} target="_blank" rel="noopener noreferrer">{line.text}</a>
        : <Link className="announcement-bar__link" to={line.link}>{line.text}</Link>
      : line.text

  return (
    <span className="announcement-bar__line">
      {text}
      {line.coupon_code && <CouponCode code={line.coupon_code} />}
    </span>
  )
}

/** The code stays readable; the small button copies it, so no careful selecting is needed. */
function CouponCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    window.clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      timer.current = window.setTimeout(() => setCopied(false), COPIED_SECONDS * 1000)
    } catch {
      // Clipboard refused (or an old browser): the code is on screen and can still be selected.
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      className={`announcement-bar__coupon${copied ? ' is-copied' : ''}`}
      onClick={copy}
      aria-label={copied ? `Copied coupon code ${code}` : `Copy coupon code ${code}`}
      title={copied ? 'Copied!' : 'Copy code'}
    >
      <span className="announcement-bar__coupon-code">{code}</span>
      <span className="announcement-bar__coupon-icon" aria-hidden>
        {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
      </span>
    </button>
  )
}

function RotatingLines({ lines, live, preview }: { lines: AnnouncementLine[]; live: boolean; preview: boolean }) {
  const [index, setIndex] = useState(0)
  const count = lines.length

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(() => setIndex((i) => i + 1), LINE_SECONDS * 1000)
    return () => window.clearInterval(timer)
  }, [count])

  const shown = index % count
  // The key restarts the fade for each new line.
  return (
    <p key={shown} className="announcement-bar__text" aria-live={live ? 'polite' : undefined}>
      <Line line={lines[shown]} preview={preview} />
    </p>
  )
}

/** The storefront's bar, above the header. Shows nothing when no announcement is switched on. */
export function AnnouncementBar() {
  const loaded = useFetch((signal) => getAnnouncement(signal), 'public-announcement')
  const announcement = loaded.data?.announcement
  if (!announcement) return null
  return <AnnouncementStrip {...announcement} />
}
