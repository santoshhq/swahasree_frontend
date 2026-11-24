import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, DeleteIcon } from './AdminIcons'

// stickyActions: on phones the actions (Save, Cancel) stay pinned to the bottom of the screen,
// so a long form can be saved without scrolling back to the top.
export function AdminPageHead({ title, subtitle, actions, stickyActions }: { title: string; subtitle?: ReactNode; actions?: ReactNode; stickyActions?: boolean }) {
  return (
    <header className={`admin-head${stickyActions ? ' admin-head--sticky-actions' : ''}`}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="admin-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="admin-head__actions">{actions}</div>}
    </header>
  )
}

export function Panel({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel__head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__thumb" />
    </button>
  )
}

// The words of a confirmation: what's about to happen and the two answers.
// tone "danger" (deleting, cancelling) gets a red confirm button; "neutral" (signing out) the green one.
export type ConfirmText = {
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'neutral'
  icon?: ReactNode
}

/**
 * The admin panel's confirmation box, used before anything is deleted, cancelled or signed out.
 * Cancel has the focus when it opens, so Enter pressed by habit never confirms. Escape or a click
 * outside cancels (except while the action runs). It sits above any open panel (a Modal), and its
 * Escape doesn't also close that panel.
 */
export function ConfirmDialog({ open, busy = false, onConfirm, onCancel, title, message, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', icon, busyLabel = 'Please wait…', className = '' }: ConfirmText & {
  open: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  // Shown on the confirm button while the action runs.
  busyLabel?: string
  // An extra class on the box, for a dialog that needs its own look (the sign-out box).
  className?: string
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  // Read by the key handler, which is set up once per opening (so focus isn't reset mid-action).
  const latest = useRef({ busy, onCancel })
  useEffect(() => {
    latest.current = { busy, onCancel }
  })

  useEffect(() => {
    if (!open) return
    const returnTo = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Capture phase, so an open Modal's own Escape handler never sees this key.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (!latest.current.busy) latest.current.onCancel()
      } else if (e.key === 'Tab') {
        // Keep the focus on the two buttons while the box is open.
        e.preventDefault()
        const next = document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current
        next?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previous
      returnTo?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="confirm-layer">
      <div className="modal-scrim" onClick={() => !busy && onCancel()} aria-hidden />
      <section className={`confirm-box confirm-box--${tone} ${className}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <span className="confirm-box__icon" aria-hidden>{icon ?? <DeleteIcon size={22} />}</span>
        <div className="confirm-box__text">
          <h2 id="confirm-title">{title}</h2>
          <div id="confirm-message" className="confirm-box__message">{message}</div>
        </div>
        <div className="confirm-box__actions">
          <button ref={cancelRef} type="button" className="admin-button admin-button--ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className={`admin-button${tone === 'danger' ? ' admin-button--danger' : ''}`} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

/** A button that asks for confirmation in a ConfirmDialog before running onConfirm. */
export function ConfirmButton({
  label,
  confirm,
  onConfirm,
  icon,
  disabled,
  className = 'admin-icon-button admin-icon-button--danger',
}: {
  label: string
  confirm: ConfirmText
  onConfirm: () => Promise<void> | void
  icon?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={disabled} aria-label={label} title={label}>
        {icon ?? label}
      </button>
      <ConfirmDialog {...confirm} open={asking} busy={busy} onConfirm={run} onCancel={() => setAsking(false)} />
    </>
  )
}

/** Small message that confirms an action, then fades out on its own. */
export function Toast({ message, kind = 'success', onDone }: { message: string | null; kind?: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onDone, kind === 'error' ? 6000 : 3000)
    return () => window.clearTimeout(timer)
    // onDone is usually a new arrow function each render; only a new message restarts the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, kind])
  if (!message) return null
  return (
    <div className={`toast toast--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  )
}

/**
 * A popup box in the middle of the screen for creating or editing one thing,
 * so the list behind it keeps its place. Esc or a click outside closes it.
 */
// wide: for content that needs the room, like the managers' tick-box grid.
export function Modal({ open, title, subtitle, onClose, children, footer, wide = false }: {
  open: boolean
  wide?: boolean
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Keep the page behind from scrolling while the panel is open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  return (
    <div className="modal-layer">
      <div className="modal-scrim" onClick={onClose} aria-hidden />
      <section className={`modal${wide ? ' modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p className="modal__sub">{subtitle}</p>}
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </section>
    </div>
  )
}

export function StatTile({ label, value, detail, tone = 'plain' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'plain' | 'forest' | 'gold' }) {
  return (
    <div className={`stat stat--${tone}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {detail && <p className="stat__detail">{detail}</p>}
    </div>
  )
}
