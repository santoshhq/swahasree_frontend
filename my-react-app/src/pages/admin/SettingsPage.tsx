import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CardIcon, CashIcon, CheckIcon, MailIcon } from '../../components/Icons'
import { ErrorState, Loading } from '../../components/ui'
import { PasteCodeButton } from '../../components/PasteCodeButton'
import {
  getAdminProfile, getPaymentSettings, getShippingMode, requestPasswordResetCode, resetPasswordWithCode, updateAdminProfile,
  updatePaymentSettings, updateShippingMode, type AdminProfile, type PaymentSettings, type ShippingMode,
} from '../../lib/adminApi'
import { useFetch } from '../../lib/useFetch'
import { EyeIcon, EyeOffIcon, FreeShippingIcon, ShieldIcon, StoreIcon } from './AdminIcons'
import { AdminPageHead, Switch, Toast } from './AdminUi'

type ToastState = { message: string; kind: 'success' | 'error' } | null

// Same rules as the backend (models/admin_model.py and routers/admin_auth_router.py).
const MIN_PASSWORD = 8
const MAX_PASSWORD = 128
const CODE_MINUTES = 5
const RESEND_SECONDS = 60

export function SettingsPage() {
  const profile = useFetch((signal) => getAdminProfile(signal), 'admin-profile')
  if (profile.loading && !profile.data) return <Loading />
  if (profile.error) return <ErrorState message={profile.error.message} onRetry={profile.reload} />
  if (!profile.data) return null
  return <Settings key={profile.data.admin_id} profile={profile.data} />
}

function Settings({ profile }: { profile: AdminProfile }) {
  // What the server has now; the summary card follows it as details are saved.
  const [saved, setSaved] = useState(profile)
  const [toast, setToast] = useState<ToastState>(null)

  return (
    <>
      <AdminPageHead title="Store settings" subtitle="Your store details, how customers pay, how orders ship, and how you sign in." />

      <div className="settings">
        <div className="settings-summary">
          <span className="settings-summary__avatar" aria-hidden>{(saved.store_name || saved.email_id).charAt(0).toUpperCase()}</span>
          <div className="settings-summary__text">
            <strong>{saved.store_name || 'Your store'}</strong>
            <span>{saved.full_name ? `${saved.full_name}, store owner` : 'Store owner'}</span>
          </div>
          <span className="settings-summary__email"><MailIcon size={16} /> {saved.email_id}</span>
        </div>

        <SettingsSection icon={<StoreIcon />} title="Store details" description="Your store's name and the owner's contact details.">
          <StoreDetailsForm profile={saved} onSaved={(changes) => setSaved((s) => ({ ...s, ...changes }))} onToast={setToast} />
        </SettingsSection>

        <SettingsSection icon={<CardIcon size={20} />} title="Payment methods" description="How customers can pay at checkout. At least one must stay on. Changes save at once.">
          <PaymentMethods onToast={setToast} />
        </SettingsSection>

        <SettingsSection icon={<FreeShippingIcon />} title="Shipping" description="Who moves orders on once the courier is booked. Changes save at once.">
          <ShippingModeSetting onToast={setToast} />
        </SettingsSection>

        <SettingsSection icon={<ShieldIcon />} title="Security" description="Change the password you use to sign in to this admin panel.">
          <PasswordReset email={saved.email_id} onToast={setToast} />
        </SettingsSection>
      </div>

      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

// One settings area: what it's for on the left, its controls in a card on the right.
function SettingsSection({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section className="settings-section" aria-labelledby={id}>
      <div className="settings-section__intro">
        <span className="settings-section__icon" aria-hidden>{icon}</span>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="settings-card">{children}</div>
    </section>
  )
}

type DetailChanges = Partial<Pick<AdminProfile, 'store_name' | 'full_name' | 'mobile_number'>>

function StoreDetailsForm({ profile, onSaved, onToast }: { profile: AdminProfile; onSaved: (changes: DetailChanges) => void; onToast: (t: ToastState) => void }) {
  const [storeName, setStoreName] = useState(profile.store_name ?? '')
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [mobile, setMobile] = useState(profile.mobile_number ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changes: DetailChanges = Object.fromEntries(
    Object.entries({ store_name: storeName.trim(), full_name: fullName.trim(), mobile_number: mobile.trim() })
      .filter(([k, v]) => v && v !== profile[k as keyof DetailChanges]),
  )
  const changed = Object.keys(changes).length > 0

  const discard = () => {
    setStoreName(profile.store_name ?? '')
    setFullName(profile.full_name ?? '')
    setMobile(profile.mobile_number ?? '')
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.')
      return
    }
    if (!changed) return
    setSaving(true)
    try {
      await updateAdminProfile(changes)
      onSaved(changes)
      onToast({ message: 'Your store details were saved.', kind: 'success' })
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="settings-card__body">
        <div className="admin-field">
          <label htmlFor="s-store" className="admin-label">Store name</label>
          <input id="s-store" className="admin-input" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
        <div className="field-pair">
          <div className="admin-field">
            <label htmlFor="s-name" className="admin-label">Owner's full name</label>
            <input id="s-name" className="admin-input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </div>
          <div className="admin-field">
            <label htmlFor="s-mobile" className="admin-label">Mobile number</label>
            <div className="settings-prefix">
              <span aria-hidden>+91</span>
              <input id="s-mobile" className="admin-input" inputMode="numeric" maxLength={10} value={mobile} aria-invalid={!!error}
                onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '')); setError(null) }} autoComplete="tel-national" />
            </div>
            {error && <p className="settings-error" role="alert">{error}</p>}
          </div>
        </div>
        <div className="admin-field">
          <span className="admin-label">Sign-in email</span>
          <p className="settings-readonly"><MailIcon size={16} /> {profile.email_id}</p>
          <p className="admin-hint admin-hint--tight">You sign in to the admin panel with this email. It can't be changed here.</p>
        </div>
      </div>
      <div className="settings-card__foot">
        <span className="settings-card__status">{changed ? 'You have unsaved changes' : 'All changes saved'}</span>
        {changed && <button type="button" className="admin-button admin-button--ghost" onClick={discard} disabled={saving}>Discard</button>}
        <button type="submit" className="admin-button" disabled={saving || !changed}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  )
}

const METHODS: { key: keyof PaymentSettings; icon: ReactNode; label: string; on: string }[] = [
  { key: 'prepaid', icon: <CardIcon size={22} />, label: 'Online payment', on: 'UPI, cards, net banking and wallets, through Razorpay' },
  { key: 'cod', icon: <CashIcon size={22} />, label: 'Cash on delivery', on: 'Customers pay in cash when the order arrives' },
]

// Saved the moment a switch flips: there's nothing to type, so no Save button.
function PaymentMethods({ onToast }: { onToast: (t: ToastState) => void }) {
  const loaded = useFetch((signal) => getPaymentSettings(signal), 'admin-payment-settings')
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [saving, setSaving] = useState(false)

  if (loaded.loading && !loaded.data) return <div className="settings-card__body"><Loading /></div>
  if (loaded.error || !loaded.data) {
    return <div className="settings-card__body"><ErrorState message={loaded.error?.message ?? 'Could not load the payment methods'} onRetry={loaded.reload} /></div>
  }

  const current = settings ?? { prepaid: loaded.data.prepaid, cod: loaded.data.cod }
  const onlineAvailable = loaded.data.online_payments_available

  const toggle = async (method: keyof PaymentSettings, value: boolean) => {
    const next = { ...current, [method]: value }
    if (!next.prepaid && !next.cod) {
      onToast({ message: 'Keep at least one payment method on.', kind: 'error' })
      return
    }
    setSaving(true)
    try {
      const res = await updatePaymentSettings(next)
      setSettings(res.payment_settings)
      onToast({ message: 'Payment methods updated.', kind: 'success' })
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ul className="settings-options">
      {METHODS.map((m) => {
        const on = current[m.key]
        const lastOne = on && !(m.key === 'prepaid' ? current.cod : current.prepaid)
        const unavailable = m.key === 'prepaid' && !onlineAvailable && !on
        return (
          <li key={m.key} className={`settings-option${on ? ' is-on' : ''}`}>
            <span className="settings-option__icon" aria-hidden>{m.icon}</span>
            <div className="settings-option__text">
              <strong>{m.label} <span className={`settings-pill${on ? ' is-on' : ''}`}>{on ? 'On' : 'Off'}</span></strong>
              <span>
                {unavailable ? 'Razorpay keys are not set up on the server yet.' : on ? m.on : 'Not offered at checkout.'}
                {lastOne && ' It stays on because it is the only method.'}
              </span>
            </div>
            <Switch checked={on} onChange={(v) => toggle(m.key, v)} label={m.label} disabled={saving || lastOne || unavailable} />
          </li>
        )
      })}
    </ul>
  )
}

// On (the default): after "Packed: book courier", Shiprocket's tracking updates mark orders shipped,
// out for delivery and delivered, and those buttons leave the order page. Off: the admin sets them.
function ShippingModeSetting({ onToast }: { onToast: (t: ToastState) => void }) {
  const loaded = useFetch((signal) => getShippingMode(signal), 'admin-shipping-mode')
  const [saved, setSaved] = useState<ShippingMode | null>(null)
  const [saving, setSaving] = useState(false)

  if (loaded.loading && !loaded.data) return <div className="settings-card__body"><Loading /></div>
  if (loaded.error || !loaded.data) {
    return <div className="settings-card__body"><ErrorState message={loaded.error?.message ?? 'Could not load the shipping setting'} onRetry={loaded.reload} /></div>
  }

  const current = saved ?? loaded.data
  const on = current.mode === 'shiprocket'

  const toggle = async (value: boolean) => {
    setSaving(true)
    try {
      const res = await updateShippingMode(value ? 'shiprocket' : 'manual')
      setSaved(res.shipping_mode)
      onToast({
        message: value ? 'Shiprocket now updates orders once the courier is booked.' : 'You now mark orders shipped and delivered yourself.',
        kind: 'success',
      })
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ul className="settings-options">
      <li className={`settings-option${on ? ' is-on' : ''}`}>
        <span className="settings-option__icon" aria-hidden><FreeShippingIcon size={22} /></span>
        <div className="settings-option__text">
          <strong>Shiprocket updates order status <span className={`settings-pill${on ? ' is-on' : ''}`}>{on ? 'On' : 'Off'}</span></strong>
          <span>
            {on
              ? 'Book the courier when the parcel is packed. Shiprocket then marks the order shipped, out for delivery and delivered.'
              : 'You mark orders shipped, out for delivery and delivered. Shiprocket only updates the tracking details.'}
            {on && !current.tracking_updates_ready && ' Tracking updates are not set up on the server yet (SHIPROCKET_WEBHOOK_SECRET), so until they are you still set these steps yourself.'}
          </span>
        </div>
        <Switch checked={on} onChange={toggle} label="Shiprocket updates order status" disabled={saving} />
      </li>
    </ul>
  )
}

type ResetStep = 'idle' | 'code' | 'done'

// Changing the password: a 6-digit code is emailed to the sign-in email, then the code and the
// new password are sent together. The code proves the person changing it can read that inbox.
function PasswordReset({ email, onToast }: { email: string; onToast: (t: ToastState) => void }) {
  const [step, setStep] = useState<ResetStep>('idle')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const longEnough = password.length >= MIN_PASSWORD
  const matches = password.length > 0 && password === repeat

  const sendCode = async () => {
    setBusy(true)
    setError(null)
    try {
      await requestPasswordResetCode(email)
      setStep('code')
      setCode('')
      setWait(RESEND_SECONDS)
      onToast({ message: `A 6-digit code was sent to ${email}.`, kind: 'success' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStep('idle')
    setCode('')
    setPassword('')
    setRepeat('')
    setShow(false)
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return setError('Enter the 6-digit code from the email.')
    if (!longEnough) return setError(`Use at least ${MIN_PASSWORD} characters for the new password.`)
    if (!matches) return setError("The two passwords don't match.")
    setBusy(true)
    setError(null)
    try {
      await resetPasswordWithCode(email, code, password)
      setStep('done')
      setPassword('')
      setRepeat('')
      onToast({ message: 'Your password was changed.', kind: 'success' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="settings-card__body settings-done" role="status">
        <span className="settings-done__icon" aria-hidden><CheckIcon size={22} /></span>
        <div>
          <strong>Password changed</strong>
          <p>Use your new password the next time you sign in to the admin panel.</p>
        </div>
        <button type="button" className="admin-button admin-button--ghost" onClick={reset}>Done</button>
      </div>
    )
  }

  if (step === 'idle') {
    return (
      <div className="settings-card__body">
        <div className="settings-password">
          <div>
            <strong>Password</strong>
            <p>To change it, we'll email a 6-digit code to <b>{email}</b> to confirm it's you.</p>
          </div>
          <button type="button" className="admin-button" onClick={sendCode} disabled={busy}>
            {busy ? 'Sending code…' : 'Change password'}
          </button>
        </div>
        {error && <p className="settings-error" role="alert">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="settings-card__body">
        <ol className="settings-steps" aria-label="Steps">
          <li className="is-done"><span>1</span> Code sent</li>
          <li className="is-current"><span>2</span> New password</li>
        </ol>
        <p className="settings-sent">
          <MailIcon size={16} /> We sent a 6-digit code to <b>{email}</b>. It expires in {CODE_MINUTES} minutes.
        </p>

        <div className="admin-field">
          <label htmlFor="reset-code" className="admin-label">6-digit code</label>
          <div className="code-boxes settings-code">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={`code-boxes__box${i === Math.min(code.length, 5) ? ' is-current' : ''}${code[i] ? ' is-filled' : ''}`} aria-hidden>
                {code[i] ?? ''}
              </span>
            ))}
            <input id="reset-code" className="code-boxes__input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }} />
          </div>
          <PasteCodeButton onPaste={(pasted) => { setCode(pasted); setError(null) }} />
          <p className="admin-hint admin-hint--tight">
            Didn't get it? Check spam, or{' '}
            <button type="button" className="settings-link" onClick={sendCode} disabled={busy || wait > 0}>
              {wait > 0 ? `send a new code in ${wait}s` : 'send a new code'}
            </button>
          </p>
        </div>

        <div className="field-pair">
          <div className="admin-field">
            <label htmlFor="reset-password" className="admin-label">New password</label>
            <div className="settings-secret">
              <input id="reset-password" className="admin-input" type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={MAX_PASSWORD}
                value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} />
              <button type="button" className="settings-secret__toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'} title={show ? 'Hide' : 'Show'}>
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="reset-repeat" className="admin-label">Type it again</label>
            <input id="reset-repeat" className="admin-input" type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={MAX_PASSWORD}
              value={repeat} onChange={(e) => { setRepeat(e.target.value); setError(null) }} />
          </div>
        </div>

        <ul className="settings-checks" aria-label="Password rules">
          <li className={longEnough ? 'is-met' : ''}><CheckIcon size={14} /> At least {MIN_PASSWORD} characters</li>
          <li className={matches ? 'is-met' : ''}><CheckIcon size={14} /> Both passwords match</li>
        </ul>
        {error && <p className="settings-error" role="alert">{error}</p>}
      </div>
      <div className="settings-card__foot">
        <button type="button" className="admin-button admin-button--ghost" onClick={reset} disabled={busy}>Cancel</button>
        <button type="submit" className="admin-button" disabled={busy || code.length !== 6 || !longEnough || !matches}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
