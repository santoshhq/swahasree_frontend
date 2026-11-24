import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { BRAND_RED } from '../lib/brand'

const COLORS = [BRAND_RED, '#ac171c', '#c6a267', '#f18c8f', '#f7e4dc']
const PIECES = 46
const DURATION_MS = 1600

type Piece = { id: string; x: number; y: number; dx: number; dy: number; spin: number; color: string; delay: number; round: boolean }

const between = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * A short confetti burst for a coupon or a customization unlock. `fire(element)`
 * bursts from that element's centre; the pieces clear themselves. Nothing happens for people who
 * asked their system for less motion.
 */
export function useConfetti() {
  const [pieces, setPieces] = useState<Piece[]>([])
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const fire = useCallback((from: HTMLElement | null) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const box = from?.getBoundingClientRect()
    const x = box ? box.left + box.width / 2 : window.innerWidth / 2
    const y = box ? box.top + box.height / 2 : window.innerHeight / 3
    const burst = Date.now()
    setPieces(Array.from({ length: PIECES }, (_, i) => ({
      id: `${burst}-${i}`,
      x,
      y,
      dx: between(-170, 170),
      dy: between(-230, -90),
      spin: between(-540, 540),
      color: COLORS[i % COLORS.length],
      delay: between(0, 120),
      round: i % 3 === 0,
    })))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPieces([]), DURATION_MS + 200)
  }, [])

  const confetti = pieces.length
    ? createPortal(
        <div className="confetti" aria-hidden>
          {pieces.map((p) => (
            <span
              key={p.id}
              className={`confetti__piece${p.round ? ' confetti__piece--round' : ''}`}
              style={{
                left: p.x,
                top: p.y,
                background: p.color,
                animationDelay: `${p.delay}ms`,
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                '--spin': `${p.spin}deg`,
              } as CSSProperties}
            />
          ))}
        </div>,
        document.body,
      )
    : null

  return { fire, confetti }
}
