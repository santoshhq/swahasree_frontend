import { useEffect, useState } from 'react'

export function useNearViewport() {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (!node || near) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true)
        observer.disconnect()
      }
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [near, node])

  return [near, setNode] as const
}
