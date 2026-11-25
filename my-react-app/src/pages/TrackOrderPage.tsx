import { ArrowUpRight, PackageSearch, Truck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { StatusPill } from '../components/StatusPill'
import { ApiError, getMyOrder, getMyOrders } from '../lib/api'
import { orderDate, SUPPORT_EMAIL, trackingUrl } from '../lib/format'
import { usePageMeta } from '../lib/seo'
import type { Order } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../state/auth'
import { useSignIn } from '../state/signIn'
import './trackOrder.css'

type Lookup = { kind: 'order' | 'awb'; value: string }
const referencePattern = /^[a-z0-9][a-z0-9-]{2,63}$/i
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

async function findOrder(token: string, lookup: Lookup, signal: AbortSignal): Promise<Order | null> {
  if (lookup.kind === 'order' && uuidPattern.test(lookup.value)) {
    try {
      return await getMyOrder(token, lookup.value.toLowerCase(), signal)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  }

  // Legacy order references and AWBs can still be matched against the customer's order history.
  let skip = 0
  const reference = lookup.value.toUpperCase()
  while (true) {
    signal.throwIfAborted()
    const { orders, total } = await getMyOrders(token, skip, 100, signal)
    const found = orders.find((order) => (
      lookup.kind === 'order' ? order.order_number : order.tracking?.awb
    )?.toUpperCase() === reference)
    if (found) return found
    skip += orders.length
    if (!orders.length || skip >= total) return null
  }
}

const pendingOrderKey = 'swahasree_track_order'

function savedOrderReference() {
  try {
    const reference = sessionStorage.getItem(pendingOrderKey)
    return reference && referencePattern.test(reference) ? reference : ''
  } catch {
    return ''
  }
}

export function TrackOrderPage() {
  usePageMeta({ title: 'Track order' })
  const location = useLocation()
  const { session, signOut } = useAuth()
  const { openSignIn } = useSignIn()
  const token = session?.token ?? ''
  const orderReference = location.state as { orderId?: string; orderNumber?: string } | null
  const [kind, setKind] = useState<Lookup['kind']>('order')
  const [value, setValue] = useState(() => orderReference?.orderId ?? orderReference?.orderNumber ?? savedOrderReference())
  const [lookup, setLookup] = useState<Lookup | null>(() => value ? { kind: 'order', value } : null)
  const [invalid, setInvalid] = useState(false)
  const key = lookup && token ? JSON.stringify([lookup.kind, lookup.value, token]) : ''
  const result = useFetch(async (signal) => lookup && token ? {
    key, order: await findOrder(token, lookup, signal),
  } : null, key)
  const current = key && result.data?.key === key ? result.data : null
  const expired = Boolean(key && result.error instanceof ApiError && [401, 403].includes(result.error.status))

  useEffect(() => {
    if (expired) signOut('expired')
  }, [expired, signOut])

  useEffect(() => {
    if (!token) return
    try { sessionStorage.removeItem(pendingOrderKey) } catch { /* Storage may be unavailable. */ }
  }, [token])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reference = value.trim().replace(/^#/, '')
    if (!referencePattern.test(reference)) {
      setInvalid(true)
      setLookup(null)
      return
    }
    setInvalid(false)
    setLookup({ kind, value: reference })
    if (lookup?.kind === kind && lookup.value === reference && token) result.reload()
  }

  function signInToTrack() {
    if (lookup?.kind !== 'order') return
    try { sessionStorage.setItem(pendingOrderKey, lookup.value) } catch { /* The input remains available in this tab. */ }
    openSignIn({ from: '/track-order' })
  }

  const trackingAwb = current?.order?.tracking?.awb ?? (lookup?.kind === 'awb' ? lookup.value : null)

  return (
    <div className="track-order">
      <div className="container track-order__layout">
        <header className="track-order__head">
          <span className="track-order__icon" aria-hidden="true"><PackageSearch size={28} strokeWidth={2.25} /></span>
          <h1>Track your order</h1>
          <p>Enter the order ID from your confirmation email or the AWB number from your shipping update.</p>
        </header>
        <form className="track-order__card" onSubmit={submit}>
          <fieldset className="track-order__choices">
            <legend className="visually-hidden">Track with</legend>
            {(['order', 'awb'] as const).map((option) => (
              <label key={option}>
                <input className="visually-hidden" type="radio" name="tracking-kind" value={option} checked={kind === option}
                  onChange={() => { setKind(option); setValue(''); setLookup(null); setInvalid(false) }} />
                <span>{option === 'order' ? 'Order ID' : 'AWB number'}</span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="tracking-reference">{kind === 'order' ? 'Order ID' : 'AWB number'}</label>
          <div className="track-order__input">
            <input id="tracking-reference" value={value} maxLength={65} type="text" required autoComplete="off" spellCheck={false}
              autoCapitalize="off" aria-invalid={invalid || undefined} aria-describedby={invalid ? 'tracking-reference-error' : undefined}
              onChange={(event) => { setValue(event.target.value); setInvalid(false); setLookup(null) }} />
            <button type="submit" className="track-order__button">Track order</button>
          </div>
          {invalid && <p id="tracking-reference-error" className="track-order__error" role="alert">Enter a valid {kind === 'order' ? 'order ID' : 'AWB number'} using letters, numbers or hyphens.</p>}
        </form>

        {lookup && (
          <div className="track-order__card track-order__result" aria-live="polite" aria-busy={Boolean(key && result.loading)}>
            {lookup.kind === 'order' && !token ? (
              <>
                <h2>Sign in to view your order</h2>
                <p>Use the email address from your order confirmation to see its latest status.</p>
                <button type="button" className="track-order__button" onClick={signInToTrack}>Sign in</button>
              </>
            ) : key && (result.loading || (!current && !result.error)) ? (
              <p>Looking up your order…</p>
            ) : (
              <>
                {current?.order ? <TrackingSummary order={current.order} /> : lookup.kind === 'awb' ? (
                  <><h2>Track with Shiprocket</h2><p>Open Shiprocket to check the courier updates for AWB <strong>{lookup.value}</strong>.</p></>
                ) : result.error ? (
                  <><h2>We couldn’t check your order</h2><p>Please try again.</p><button type="button" className="track-order__button" onClick={result.reload}>Try again</button></>
                ) : (
                  <><h2>Order not found</h2><p>Check the order ID and make sure you’re signed in with the email you used to place the order.</p></>
                )}
                {trackingAwb && <a className="track-order__button" href={trackingUrl(trackingAwb)} target="_blank" rel="noreferrer">
                  Track with Shiprocket <ArrowUpRight size={17} aria-hidden="true" />
                </a>}
              </>
            )}
          </div>
        )}
        <p className="track-order__help">Need help? <a href={`mailto:${SUPPORT_EMAIL}`}>Contact us</a> or <Link to="/account">view your orders</Link>.</p>
      </div>
    </div>
  )
}

function TrackingSummary({ order }: { order: Order }) {
  const { tracking } = order
  return (
    <>
      <div className="track-order__summary">
        <h2>Order {order.order_number}</h2>
        <StatusPill status={order.status} />
      </div>
      <p>Placed {orderDate(order.created_at)}</p>
      {tracking?.awb ? (
        <dl className="track-order__details">
          <div><dt>AWB number</dt><dd>{tracking.awb}</dd></div>
          {tracking.courier_name && <div><dt>Courier</dt><dd>{tracking.courier_name}</dd></div>}
          {tracking.status && <div><dt>Latest update</dt><dd>{tracking.status}</dd></div>}
          {tracking.etd && <div><dt>Expected by</dt><dd>{tracking.etd}</dd></div>}
        </dl>
      ) : ['cancelled', 'returned', 'delivered'].includes(order.status) ? null : (
        <p><Truck size={18} aria-hidden="true" /> Courier tracking will appear after an AWB is assigned.</p>
      )}
      <Link to={`/account/orders/${order.order_id}`}>View order details</Link>
    </>
  )
}
