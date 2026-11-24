import { useEffect, useState, type FormEvent } from 'react'
import { ErrorState, Loading } from '../../components/ui'
import { PasteCodeButton } from '../../components/PasteCodeButton'
import { changeManagerPassword, getManagerMe, sendManagerPasswordCode } from '../../lib/adminApi'
import { orderDate } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { AdminPageHead, Panel } from './AdminUi'
import { LoginIdBadge } from './ManagerParts'
import { actionsText, sectionsWithAccess } from './managerSections'

const MIN_PASSWORD = 8

/**
 * A store manager's own page: their staff pass (who they are, read only; the owner manages it)
 * and the one thing they change themselves, their password.
 */
export function ManagerProfilePage() {
  const me = useFetch((signal) => getManagerMe(signal), 'manager-me')

  if (me.loading && !me.data) return <Loading />
  if (me.error || !me.data) return <ErrorState message={me.error?.message ?? 'Your profile couldn’t be loaded.'} onRetry={me.reload} />
  const m = me.data
  const sections = sectionsWithAccess(m.permissions)

  return (
    <>
      <AdminPageHead title="My profile" subtitle="Your sign-in details. The store owner manages everything else on your account." />

      <div className="profile-layout">
        <section className="staff-pass" aria-label="Your staff pass">
          <div className="staff-pass__band">
            <span>{m.store_name ?? 'Store'}</span>
            <span>Store manager</span>
          </div>
          <div className="staff-pass__body">
            <h2 className="staff-pass__name">{m.full_name}</h2>
            <LoginIdBadge id={m.login_id} size="lg" />
            <dl className="staff-pass__facts">
              <div><dt>Email</dt><dd>{m.email_id}</dd></div>
              <div><dt>Mobile</dt><dd>{m.mobile_number}</dd></div>
              <div><dt>Last sign-in</dt><dd>{m.last_login_at ? orderDate(m.last_login_at) : 'This is your first'}</dd></div>
            </dl>
          </div>
          <div className="staff-pass__access">
            <h3>What you can use</h3>
            {sections.length ? (
              <ul>
                {sections.map((s) => (
                  <li key={s.key}>
                    <span className="staff-pass__icon"><s.icon size={16} /></span>
                    <span className="staff-pass__section">{s.label}</span>
                    <span className="staff-pass__actions">{actionsText(m.permissions, s)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing yet. Ask the store owner to give you access.</p>
            )}
          </div>
        </section>

        <ChangePassword email={m.email_id} />
      </div>
    </>
  )
}

/** r****@gmail.com, as the backend shows it. */
const maskEmail = (email: string) => {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(name.length - 1, 3))}@${domain ?? ''}`
}

type Stage = 'start' | 'code' | 'done'

/**
 * Changing the password takes a code from the manager's email: they press "Email me a code",
 * then enter the 6 digits with their new password. Three states: start, code, done.
 */
function ChangePassword({ email }: { email: string }) {
  const [stage, setStage] = useState<Stage>('start')
  const [sentTo, setSentTo] = useState(maskEmail(email))
  const [expiresIn, setExpiresIn] = useState(5)
  const [otp, setOtp] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Seconds until a new code can be asked for.
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const codeReady = /^\d{6}$/.test(otp)
  const longEnough = next.length >= MIN_PASSWORD
  const matches = !!next && next === again

  const sendCode = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await sendManagerPasswordCode()
      setSentTo(res.sent_to)
      setExpiresIn(res.expires_in_minutes)
      setWait(res.resend_after_seconds)
      setOtp('')
      setStage('code')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!codeReady) return setError('Enter the 6-digit code from your email.')
    if (!longEnough) return setError(`Your new password needs at least ${MIN_PASSWORD} characters.`)
    if (!matches) return setError('The two new passwords don’t match.')
    setBusy(true)
    setError(null)
    try {
      await changeManagerPassword(otp, next)
      setOtp('')
      setNext('')
      setAgain('')
      setStage('done')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <Panel title="Change password" className="profile-password">
      {stage === 'start' && (
        <div className="otp-start">
          <p>To keep your account safe, we first email you a 6-digit code. You enter it here with your new password.</p>
          <p className="otp-start__to">The code goes to <strong>{sentTo}</strong></p>
          {error && <p className="field__error" role="alert">{error}</p>}
          <button type="button" className="admin-button" onClick={sendCode} disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </div>
      )}

      {stage === 'code' && (
        <form onSubmit={submit} noValidate>
          <p className="otp-sent" role="status">
            We sent a code to <strong>{sentTo}</strong>. It works for {expiresIn} minutes.
          </p>
          <div className="admin-field">
            <label htmlFor="pw-otp" className="admin-label">6-digit code</label>
            <input id="pw-otp" className="admin-input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder="••••••" value={otp} autoFocus onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }} />
            <PasteCodeButton onPaste={(pasted) => { setOtp(pasted); setError(null) }} />
            <p className="admin-hint otp-resend">
              Didn’t get it? Check spam, or{' '}
              {wait > 0
                ? <span>send a new code in {wait}s</span>
                : <button type="button" className="text-button" onClick={sendCode} disabled={busy}>send a new code</button>}
            </p>
          </div>
          <div className="admin-field">
            <label htmlFor="pw-new" className="admin-label">New password</label>
            <input id="pw-new" type={type} className="admin-input" autoComplete="new-password" value={next}
              onChange={(e) => { setNext(e.target.value); setError(null) }} />
          </div>
          <div className="admin-field">
            <label htmlFor="pw-again" className="admin-label">New password again</label>
            <input id="pw-again" type={type} className="admin-input" autoComplete="new-password" value={again}
              onChange={(e) => { setAgain(e.target.value); setError(null) }} />
          </div>

          {/* Each rule turns green as it's met, so it's clear before pressing the button. */}
          <ul className="password-rules" aria-label="Before you change it">
            <li className={codeReady ? 'is-met' : ''}>The 6-digit code from your email</li>
            <li className={longEnough ? 'is-met' : ''}>At least {MIN_PASSWORD} characters</li>
            <li className={matches ? 'is-met' : ''}>Both new passwords match</li>
          </ul>

          <label className="password-show">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
          </label>
          {error && <p className="field__error" role="alert">{error}</p>}
          <div className="otp-actions">
            <button type="submit" className="admin-button" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
            <button type="button" className="text-button" onClick={() => { setStage('start'); setError(null) }}>Cancel</button>
          </div>
        </form>
      )}

      {stage === 'done' && (
        <div className="otp-done" role="status">
          <span className="otp-done__mark" aria-hidden>✓</span>
          <div>
            <p><strong>Your password is changed.</strong></p>
            <p className="admin-hint">Use the new one the next time you sign in with your login ID.</p>
          </div>
          <button type="button" className="text-button" onClick={() => setStage('start')}>Change it again</button>
        </div>
      )}
    </Panel>
  )
}
