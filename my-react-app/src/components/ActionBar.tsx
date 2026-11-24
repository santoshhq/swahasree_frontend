import { useEffect, useState, type ReactNode, type RefObject } from 'react'

/**
 * Phones and tablets (single-column layouts): the total and the page's main button, pinned to
 * the bottom of the screen while that button is still further down the page. It slides away
 * once the real button scrolls into view (or past it, at the footer), and while `paused`
 * (the shopper is typing, so it never sits on top of the keyboard). Desktop never shows it.
 */
export function ActionBar({ target, paused = false, children }: { target: RefObject<HTMLElement | null>; paused?: boolean; children: ReactNode }) {
  const [targetBelow, setTargetBelow] = useState(false)

  useEffect(() => {
    const element = target.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      setTargetBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [target])

  const visible = targetBelow && !paused
  // inert: while slid away, its button can't be tabbed to or read out.
  return (
    <div className={`action-bar${visible ? ' is-visible' : ''}`} inert={!visible}>
      {children}
    </div>
  )
}
