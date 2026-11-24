import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { ApiError, getMyStockAlerts, requestStockAlert } from '../lib/api'
import { useAuth } from '../state/auth'
import { useSignIn } from '../state/signIn'
import { BellIcon, CheckIcon } from './Icons'
import { BrandButton } from './ui'

// The products a signed-in customer is already waiting for, fetched once per sign-in and shared by
// every "Notify me" on the page (a grid of out-of-stock cards makes one request, not one each).
const myAlerts = new Map<string, Promise<Set<string>>>()

function alertsFor(token: string): Promise<Set<string>> {
  let alerts = myAlerts.get(token)
  if (!alerts) {
    alerts = getMyStockAlerts(token)
      .then((rows) => new Set(rows.map((r) => r.product_id)))
      // Not knowing just means the button offers itself again; asking twice is harmless.
      .catch(() => new Set<string>())
    myAlerts.clear()
    myAlerts.set(token, alerts)
  }
  return alerts
}

// "Notify me" on an out-of-stock product: the store emails the signed-in customer once it's back,
// at the email on their account.
// Signed out, it opens the sign-in popup, which then comes back to this page with ?notify=<product id>;
// that turns the alert on without a second click.
export function NotifyButton({ productId, productName, variant = 'card' }: {
  productId: string
  productName: string
  variant?: 'card' | 'page'
}) {
  const { session, signOut } = useAuth()
  const { openSignIn } = useSignIn()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState<'idle' | 'saving'>('idle')
  // The sign-in (token) the alert is on for: another customer signing in here starts fresh.
  const [doneFor, setDoneFor] = useState<string | null>(null)
  // Where the email will go: what the server saved the alert under (the account's email).
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const token = session?.token
  // Already asked on an earlier visit: show it as on instead of offering the button again.
  useEffect(() => {
    if (!token) return
    let live = true
    void alertsFor(token).then((alerts) => {
      if (live && alerts.has(productId)) setDoneFor(token)
    })
    return () => { live = false }
  }, [token, productId])

  const toLogin = () => {
    const back = new URLSearchParams(location.search)
    back.set('notify', productId)
    openSignIn({ from: `${location.pathname}?${back}` })
  }

  const notify = async () => {
    if (!session) return toLogin()
    setState('saving')
    setError(null)
    try {
      const res = await requestStockAlert(session.token, productId)
      setEmail(res.email_id)
      void alertsFor(session.token).then((alerts) => alerts.add(productId))
      setState('idle')
      setDoneFor(session.token)
    } catch (err) {
      setState('idle')
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        signOut('expired')
        toLogin()
      } else {
        setError((err as Error).message)
      }
    }
  }

  // Back from sign-in: finish what the shopper asked for, once.
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || !session || params.get('notify') !== productId) return
    resumed.current = true
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('notify')
      return next
    }, { replace: true })
    void notify()
  })

  // Signed out (or signed out since), the alert belongs to nobody on this screen: offer the button.
  if (session && doneFor === session.token) {
    const to = email ?? session.customer.email
    return (
      <p className={`notify-done notify-done--${variant}`} role="status">
        <CheckIcon size={16} />
        <span>
          {variant === 'page' ? "You're on the list. " : ''}
          We'll email {to ? <strong className="notify-done__email">{to}</strong> : 'you'} when it's back.
        </span>
      </p>
    )
  }
  return (
    <div className={`notify notify--${variant}`}>
      {variant === 'page' ? (
        <BrandButton onClick={notify} busy={state === 'saving'} icon={<BellIcon size={18} />}>
          {session ? 'Notify me' : 'Sign in to get notified'}
        </BrandButton>
      ) : (
        <button className="add-button add-button--ghost" onClick={notify} disabled={state === 'saving'}
          aria-label={session ? `Email me when ${productName} is back in stock` : `Sign in to get an email when ${productName} is back in stock`}>
          <BellIcon size={16} />
          <span>{state === 'saving' ? 'Saving…' : 'Notify me'}</span>
        </button>
      )}
      {!session && variant === 'page' && (
        <p className="notify__hint">Sign in and we'll email you at your account's address as soon as it's back.</p>
      )}
      {error && <p className="notify__error" role="alert">{error}</p>}
    </div>
  )
}
