import { useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from 'react'
import { Link } from 'react-router'
import { ArrowIcon, LeafMark } from './Icons'

/**
 * The store's main call to action: a solid forest-green button with the label and a small arrow
 * that steps forward on hover. Used only for the one primary action on a page.
 */
type BrandButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; busy?: boolean; ref?: Ref<HTMLButtonElement> }

export function BrandButton({ children, icon, busy, className = '', ...rest }: BrandButtonProps) {
  return (
    <button {...rest} className={`brand-button ${className}`} aria-busy={busy || undefined}>
      <span>{busy ? 'Please wait…' : children}</span>
      <span className="brand-button__dot">{icon ?? <ArrowIcon size={17} />}</span>
    </button>
  )
}

// onClick can stop the navigation (preventDefault), e.g. to sign in first; hasPopup says so to screen readers.
export function BrandLink({ to, children, className = '', ref, onClick, hasPopup }: {
  to: string
  children: ReactNode
  className?: string
  ref?: Ref<HTMLAnchorElement>
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  hasPopup?: boolean
}) {
  return (
    <Link ref={ref} to={to} className={`brand-button ${className}`} onClick={onClick} aria-haspopup={hasPopup ? 'dialog' : undefined}>
      <span>{children}</span>
      <span className="brand-button__dot"><ArrowIcon size={17} /></span>
    </Link>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state state--loading" role="status">
      <LeafMark size={36} className="state__leaf" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p>{message}</p>
      {onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <LeafMark size={40} className="state__leaf" />
      <h3>{title}</h3>
      {children}
    </div>
  )
}

// eager: for the one picture at the top of a page, which shouldn't wait to be scrolled to.
export function ProductImage({ src, alt, className = '', eager = false }: { src?: string | null; alt: string; className?: string; eager?: boolean }) {
  // Remember which URL failed, so a missing file on the image server shows the leaf instead of a broken icon.
  const [failed, setFailed] = useState<string | null>(null)
  return src && failed !== src ? (
    <img
      src={src}
      alt={alt}
      className={`product-image ${className}`}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(src)}
    />
  ) : (
    <div className={`product-image product-image--empty ${className}`} role="img" aria-label={alt}>
      <LeafMark size={44} />
    </div>
  )
}

// Placeholder cards while a product row loads, shaped like the real ones so nothing jumps.
export function ProductGridSkeleton({ count = 4, rail = false }: { count?: number; rail?: boolean }) {
  return (
    <div className={rail ? 'product-rail__track product-rail__track--loading' : 'product-grid product-grid--row'} role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="product-card product-card--skeleton" aria-hidden>
          <span className="skeleton skeleton--media" />
          <span className="product-card__body">
            <span className="skeleton skeleton--line skeleton--short" />
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line skeleton--mid" />
            <span className="skeleton skeleton--button" />
          </span>
        </div>
      ))}
    </div>
  )
}
