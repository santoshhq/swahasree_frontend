import { StarIcon } from './Icons'

/** A read-only row of five stars, filled to `value` (out of 5) rounded to the nearest half star. */
export function Stars({ value, size = 16, className = '' }: { value: number; size?: number; className?: string }) {
  const halves = Math.round(Math.max(0, Math.min(5, value)) * 2)
  return (
    <span className={`stars ${className}`} role="img" aria-label={`Rated ${value} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        // 1 = full, 0.5 = half, 0 = empty.
        const fill = Math.max(0, Math.min(2, halves - i * 2)) / 2
        return (
          // Each star has its own fixed-size box: a grey star with the gold one laid over it,
          // cut to the fill. The gold star keeps its full size, so it is cut off, never squashed.
          <span key={i} className="stars__star" style={{ width: size, height: size }} aria-hidden>
            <StarIcon size={size} filled className="stars__empty" />
            {fill > 0 && (
              <span className="stars__fill" style={{ width: `${fill * 100}%` }}>
                <StarIcon size={size} filled />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/** "★★★★☆ 4.3 (12)" under a product's name; nothing until the product has a review. */
export function RatingBadge({ average, count, size = 14 }: { average: number | null; count: number; size?: number }) {
  if (!count || average == null) return null
  return (
    <span className="rating-badge">
      <Stars value={average} size={size} />
      <span className="rating-badge__value">{average.toFixed(1)}</span>
      <span className="rating-badge__count">({count})</span>
    </span>
  )
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/** Five radio buttons drawn as stars, for choosing a rating in the review form. */
export function StarPicker({ value, onChange, name }: { value: number; onChange: (n: number) => void; name: string }) {
  return (
    <div className="star-picker">
      <div className="star-picker__stars" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`star-picker__star${n <= value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="visually-hidden" />
            <StarIcon size={30} filled={n <= value} />
            <span className="visually-hidden">{n} {n === 1 ? 'star' : 'stars'}, {LABELS[n]}</span>
          </label>
        ))}
      </div>
      <span className="star-picker__label" aria-hidden>{value ? LABELS[value] : 'Tap a star'}</span>
    </div>
  )
}
