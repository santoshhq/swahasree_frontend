import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { BrandLink, EmptyState } from '../components/ui'
import { ApiError, unsubscribeCartReminders } from '../lib/api'
import { usePageMeta } from '../lib/seo'

// The "Stop bag reminders" link in a reminder email. It asks for a click rather than unsubscribing
// on load: mail scanners open links in emails, and that mustn't switch the reminders off.
export function UnsubscribePage() {
  usePageMeta({ title: 'Unsubscribe', noindex: true })
  const token = useSearchParams()[0].get('token')
  const [state, setState] = useState<'ready' | 'working' | 'done'>('ready')
  const [error, setError] = useState<string | null>(token ? null : 'This link is incomplete. Please use the link from the email again.')

  const stop = () => {
    if (!token) return
    setState('working')
    setError(null)
    unsubscribeCartReminders(token)
      .then(() => setState('done'))
      .catch((err) => {
        setState('ready')
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      })
  }

  if (state === 'done') {
    return (
      <div className="container page">
        <EmptyState title="Bag reminders are off">
          <p>We won't email you about items left in your bag again. Your bag is still saved.</p>
          <BrandLink to="/cart">View your bag</BrandLink>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="container page">
      <EmptyState title="Stop bag reminders?">
        <p>We send a few reminders when items are left in your bag. You can switch them off here.</p>
        {error && <p className="notice notice--warn" role="alert">{error}</p>}
        {token && (
          <button className="brand-button" onClick={stop} disabled={state === 'working'}>
            <span>{state === 'working' ? 'Saving…' : 'Stop bag reminders'}</span>
            <span className="brand-button__dot" />
          </button>
        )}
      </EmptyState>
    </div>
  )
}
