import { useEffect, useId, useRef, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { money, plural } from '../lib/format'
import { useAuth } from '../state/auth'
import { useCart } from '../state/cart'
import type { SignInOptions } from '../state/signIn'
import { GoogleSignInButton } from './GoogleSignInButton'
import { CartIcon, CloseIcon, LockIcon } from './Icons'

/**
 * The sign-in popup (opened with useSignIn().openSignIn()): a modal <dialog>, centred on laptops and
 * tablets and rising from the bottom on phones (see .signin-dialog in App.css). The browser gives it
 * the focus trap, Escape to close and the focus back where it was. No passwords: customers continue
 * with their Google account, and a first sign-in creates the account.
 */
export function SignInDialog({ open, purpose, from, onClose }: {
  open: boolean
  purpose?: SignInOptions['purpose']
  // Where to land once signed in; by default, back on this page.
  from?: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const leadId = useId()
  const { expiredEmail } = useAuth()
  const { items, subtotal } = useCart()
  const checkout = purpose === 'checkout'
  const cartCount = items.filter((i) => !i.unavailable).reduce((n, i) => n + i.quantity, 0)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // The panel fills the dialog's box, so a click on the <dialog> itself is a click on the dimmed page.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <dialog ref={ref} className="signin-dialog" aria-labelledby={titleId} aria-describedby={leadId} onClose={onClose} onClick={onClick}>
      <div className="signin-dialog__panel">
        <button type="button" className="signin-dialog__close" aria-label="Close sign-in" onClick={onClose}>
          <CloseIcon size={20} />
        </button>

        {checkout ? (
          <>
            <h2 id={titleId} className="signin-dialog__title">Sign in to resume checkout</h2>
            <p id={leadId} className="signin-dialog__lead">
              Your cart is saved. Sign in with Google and you'll go straight on to delivery and payment.
            </p>
            {cartCount > 0 && (
              <p className="signin-dialog__cart">
                <CartIcon size={16} />
                <span>{plural(cartCount, 'item')} in your cart</span>
                <strong>{money(subtotal)}</strong>
              </p>
            )}
          </>
        ) : (
          <>
            <h2 id={titleId} className="signin-dialog__title">Welcome to Swahasree</h2>
            <p id={leadId} className="signin-dialog__lead">Sign in or create your account in one step with Google.</p>
          </>
        )}

        {expiredEmail && (
          <p className="notice notice--warn signin-dialog__expired" role="status">
            For your security, sign-ins last a day. Yours (<strong>{expiredEmail}</strong>) has ended, so please continue
            with Google again.
          </p>
        )}

        <GoogleSignInButton text="continue_with" returnTo={from} />

        <p className="signin-dialog__note">
          <LockIcon size={14} />
          We only use your Google name, email and photo.
        </p>

        {checkout ? (
          // From the cart or from the checkout page: either way, back to the cart.
          <Link to="/cart" className="signin-dialog__continue" onClick={onClose}>Back to cart</Link>
        ) : (
          // Back to the page the shopper was on.
          <button type="button" className="signin-dialog__continue" onClick={onClose}>Continue shopping</button>
        )}
      </div>
    </dialog>
  )
}
