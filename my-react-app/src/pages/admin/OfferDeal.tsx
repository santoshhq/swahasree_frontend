import { GiftIcon } from '../../components/Icons'
import { ProductImage } from '../../components/ui'
import type { DealSide } from './offerSides'

/** A side's picture with its quantity on it. The free one has the gold ring. */
export function DealThumb({ side, quantity, free = false, size = 'md' }: { side: DealSide | null; quantity: number; free?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span className={`deal-thumb deal-thumb--${size}${free ? ' deal-thumb--free' : ''}`}>
      {side?.letter ? (
        <span className="deal-thumb__letter" aria-hidden>{side.letter}</span>
      ) : side ? (
        <ProductImage src={side.image} alt="" />
      ) : (
        <span className="deal-thumb__letter" aria-hidden>?</span>
      )}
      <span className="deal-thumb__qty">×{quantity}</span>
    </span>
  )
}

/** Compact deal for the offers list: [buy ×2] + [free ×1]. */
export function DealMini({ buy, free, buyQuantity, getQuantity }: { buy: DealSide | null; free: DealSide | null; buyQuantity: number; getQuantity: number }) {
  return (
    <span className="deal-mini" aria-hidden>
      <DealThumb side={buy} quantity={buyQuantity} size="sm" />
      <span className="deal-mini__join"><GiftIcon size={12} /></span>
      <DealThumb side={free} quantity={getQuantity} size="sm" free />
    </span>
  )
}
