import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { BulkIcon, CalendarIcon, CheckIcon, HandshakeIcon, LockIcon, MailIcon, PhoneIcon, WhatsAppIcon } from '../components/Icons'
import { BrandButton } from '../components/ui'
import { PasteCodeButton } from '../components/PasteCodeButton'
import { sendEnquiry, sendEnquiryCode, verifyEnquiryEmail } from '../lib/api'
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY, WHATSAPP_DISPLAY, WHATSAPP_URL } from '../lib/format'
import { usePageMeta } from '../lib/seo'

type Draft = { name: string; email: string; mobile: string; comments: string }
type Field = keyof Draft

const EMPTY_DRAFT: Draft = { name: '', email: '', mobile: '', comments: '' }

const BENEFITS = [
  { icon: <BulkIcon size={22} />, title: 'Bulk quantities', text: 'Order in the quantities your business needs.' },
  { icon: <HandshakeIcon size={22} />, title: 'Business order support', text: 'Our team helps you pick products and pricing.' },
  { icon: <CalendarIcon size={22} />, title: 'Delivery planning', text: 'Tell us your city and dates, and we plan around them.' },
]

// idle: not checked yet; sent: a code is on its way; verified: the code matched this email.
type EmailCheck = 'idle' | 'sent' | 'verified'

// The backend lets a new code go out once a minute.
const RESEND_SECONDS = 60
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same rules as the address form, checked here so mistakes show next to the field.
function validate(d: Draft): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  if (!d.name.trim()) errors.name = 'Enter your name'
  if (!EMAIL_PATTERN.test(d.email.trim())) errors.email = 'Enter a valid email address'
  if (!/^[6-9]\d{9}$/.test(d.mobile)) errors.mobile = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9'
  if (!d.comments.trim()) errors.comments = 'Tell us which products and how much you need'
  return errors
}

/**
 * Bulk orders (shops, restaurants, events): an enquiry form rather than the bag. The email is
 * confirmed with a 6-digit code first, so replies reach a real inbox; "Send enquiry" stays off until then.
 */
export function BulkOrdersPage() {
  usePageMeta({
    title: 'Bulk orders',
    description: 'Enquire about bulk Swahasree products for restaurants, shops, caterers and events.',
  })
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [check, setCheck] = useState<EmailCheck>('idle')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeNote, setCodeNote] = useState<string | null>(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const verified = check === 'verified'

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const set = (field: Field, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  // A confirmed (or pending) check belongs to the address it was made for; a new address starts over.
  const setEmail = (value: string) => {
    set('email', value)
    if (check !== 'idle') resetCheck()
  }

  const resetCheck = () => {
    setCheck('idle')
    setCode('')
    setCodeError(null)
    setCodeNote(null)
  }

  const requestCode = async () => {
    const email = draft.email.trim()
    if (!EMAIL_PATTERN.test(email)) {
      setErrors((e) => ({ ...e, email: 'Enter a valid email address' }))
      document.getElementById('enquiry-email')?.focus()
      return
    }
    setSendingCode(true)
    setCodeError(null)
    try {
      const result = await sendEnquiryCode(email)
      setCheck('sent')
      setCode('')
      setCodeNote(result.message)
      setCooldown(RESEND_SECONDS)
      requestAnimationFrame(() => codeRef.current?.focus())
    } catch (err) {
      setErrors((e) => ({ ...e, email: (err as Error).message }))
    } finally {
      setSendingCode(false)
    }
  }

  const confirmCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Enter the 6-digit code from the email')
      codeRef.current?.focus()
      return
    }
    setVerifying(true)
    setCodeError(null)
    try {
      await verifyEnquiryEmail(draft.email.trim(), code)
      setCheck('verified')
      setCodeNote(null)
    } catch (err) {
      setCodeError((err as Error).message)
      codeRef.current?.focus()
    } finally {
      setVerifying(false)
    }
  }

  // Enter in the email or code box runs that step, not the whole form.
  const onEmailKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); if (!verified) requestCode() }
  }
  const onCodeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmCode() }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`enquiry-${Object.keys(found)[0]}`)?.focus()
      return
    }
    if (!verified) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await sendEnquiry({
        name: draft.name.trim(),
        email_id: draft.email.trim(),
        mobile_number: draft.mobile,
        subject: 'Bulk order',
        comments: draft.comments.trim() || null,
      })
      setSent(true)
      // The thank-you takes the form's place: brought into view and read out.
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({ block: 'start' })
        doneRef.current?.focus({ preventScroll: true })
      })
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const startOver = () => {
    setDraft(EMPTY_DRAFT)
    resetCheck()
    setSent(false)
  }

  const field = (name: Field, label: string, props: Record<string, unknown> = {}) => (
    <div className={`field${errors[name] ? ' field--error' : ''}`}>
      <label htmlFor={`enquiry-${name}`}>{label}</label>
      <input
        id={`enquiry-${name}`}
        value={draft[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `enquiry-${name}-error` : undefined}
        {...props}
      />
      {errors[name] && <p className="field__error" id={`enquiry-${name}-error`}>{errors[name]}</p>}
    </div>
  )

  const form = (
    <form className="enquiry-form" onSubmit={submit} noValidate aria-labelledby="enquiry-title">
      <div className="enquiry-form__head">
        <h2 id="enquiry-title">Send a bulk enquiry</h2>
        <p>Share a few details and our team will reply by email.</p>
      </div>

      <fieldset className="enquiry-form__group">
        <legend><span aria-hidden>1</span> Your details</legend>
        <div className="field-row">
          {field('name', 'Your name', { autoComplete: 'name' })}
          {field('mobile', 'Mobile number', {
            type: 'tel',
            autoComplete: 'tel-national',
            inputMode: 'numeric',
            maxLength: 10,
            placeholder: '10-digit number',
            onChange: (e: { target: { value: string } }) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10)),
          })}
        </div>

        <div className={`field${errors.email ? ' field--error' : ''}`}>
          <label htmlFor="enquiry-email">Email address</label>
          <div className="email-verify">
            <input
              id="enquiry-email"
              type="email"
              autoComplete="email"
              placeholder="you@business.com"
              value={draft.email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onEmailKey}
              readOnly={verified}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'enquiry-email-error' : check === 'idle' ? 'enquiry-email-hint' : undefined}
            />
            {verified ? (
              <span className="email-verify__done" role="status">
                <CheckIcon size={16} /> Verified
              </span>
            ) : (
              <button
                type="button"
                className="email-verify__button"
                onClick={requestCode}
                disabled={sendingCode || check === 'sent'}
              >
                {sendingCode ? 'Sending…' : check === 'sent' ? 'Code sent' : 'Verify'}
              </button>
            )}
          </div>
          {errors.email ? (
            <p className="field__error" id="enquiry-email-error">{errors.email}</p>
          ) : check === 'idle' && (
            <p className="field__hint" id="enquiry-email-hint">We'll email you a 6-digit code to confirm it's yours.</p>
          )}
          {verified && (
            <button type="button" className="text-button email-verify__change" onClick={resetCheck}>
              Use a different email
            </button>
          )}
        </div>

        {check === 'sent' && (
          <div className="code-panel" role="group" aria-labelledby="enquiry-code-label">
            <p className="code-panel__note">
              <MailIcon size={18} />
              <span>{codeNote}</span>
            </p>
            <label id="enquiry-code-label" htmlFor="enquiry-code">6-digit code</label>
            <div className="code-panel__row">
              <input
                ref={codeRef}
                id="enquiry-code"
                className="code-panel__input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError(null) }}
                onKeyDown={onCodeKey}
                aria-invalid={!!codeError}
                aria-describedby={codeError ? 'enquiry-code-error' : undefined}
              />
              <button type="button" className="email-verify__button" onClick={confirmCode} disabled={verifying}>
                {verifying ? 'Checking…' : 'Confirm'}
              </button>
            </div>
            <PasteCodeButton onPaste={(pasted) => { setCode(pasted); setCodeError(null); codeRef.current?.focus() }} />
            {codeError && <p className="field__error" id="enquiry-code-error" role="alert">{codeError}</p>}
            <div className="code-panel__links">
              <button type="button" className="text-button" onClick={requestCode} disabled={cooldown > 0 || sendingCode}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
              <button type="button" className="text-button" onClick={resetCheck}>Change email</button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="enquiry-form__group">
        <legend><span aria-hidden>2</span> Your requirement</legend>

        <div className={`field${errors.comments ? ' field--error' : ''}`}>
          <label htmlFor="enquiry-comments">What do you need?</label>
          <textarea
            id="enquiry-comments"
            rows={5}
            placeholder="For example: 50 kg rice and 20 L cold-pressed oil every month, delivered to Hyderabad"
            value={draft.comments}
            onChange={(e) => set('comments', e.target.value)}
            aria-invalid={!!errors.comments}
            aria-describedby={errors.comments ? 'enquiry-comments-error' : 'enquiry-comments-hint'}
          />
          {errors.comments ? (
            <p className="field__error" id="enquiry-comments-error">{errors.comments}</p>
          ) : (
            <p className="field__hint" id="enquiry-comments-hint">Products, approximate quantities, delivery city and when you need them.</p>
          )}
        </div>
      </fieldset>

      {submitError && <p className="notice notice--warn" role="alert">{submitError}</p>}

      <div className="enquiry-form__actions">
        <BrandButton type="submit" disabled={!verified || submitting} busy={submitting}>Send enquiry</BrandButton>
        <p className="enquiry-form__hint">
          <LockIcon size={14} />
          {verified ? 'Your email is verified. We only use it to reply to this enquiry.' : 'Verify your email to send your enquiry.'}
        </p>
      </div>
    </form>
  )

  const done = (
    <div className="enquiry-done" role="status">
      <span className="enquiry-done__icon"><CheckIcon size={28} /></span>
      <h2 ref={doneRef} tabIndex={-1}>Thanks, we've got your enquiry</h2>
      <p>Our team will reply to <strong>{draft.email.trim()}</strong> with prices and delivery details.</p>
      <div className="enquiry-done__links">
        <Link to="/shop" className="text-button">Continue shopping</Link>
        <button type="button" className="text-button" onClick={startOver}>Send another enquiry</button>
      </div>
    </div>
  )

  return (
    <section className="bulk-hero" aria-labelledby="bulk-title">
      <div className="container bulk-hero__grid">
        <div className="bulk-hero__intro">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Bulk orders</span>
          </nav>
          <h1 id="bulk-title" className="bulk-hero__title">Stock Up on Goodness.</h1>
          <p className="bulk-hero__lead">Request a quote for restaurants, caterers, retailers and events.</p>
          <p className="bulk-hero__text">
            Tell us what your business needs, and our team will help you find the right products, quantities,
            pricing, and delivery options.
          </p>
        </div>

        <div ref={cardRef} className="bulk-hero__form">
          {sent ? done : form}
        </div>

        {/* Below the introduction on wide screens; after the form on phones. */}
        <div className="bulk-hero__more">
          <ul className="bulk-benefits">
            {BENEFITS.map((b) => (
              <li key={b.title}>
                <span className="bulk-benefits__icon">{b.icon}</span>
                <span>
                  <strong>{b.title}</strong>
                  {b.text}
                </span>
              </li>
            ))}
          </ul>

          <div className="bulk-contact">
            <p className="bulk-contact__title">Prefer to talk?</p>
            <p className="bulk-contact__text">Contact us about packs, quantities and delivery.</p>
            <div className="bulk-contact__links">
              {SUPPORT_PHONE && <a href={`tel:${SUPPORT_PHONE}`} className="bulk-contact__link"><PhoneIcon size={18} /> {SUPPORT_PHONE_DISPLAY}</a>}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="bulk-contact__link"><MailIcon size={18} /> {SUPPORT_EMAIL}</a>
              {WHATSAPP_URL && <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="bulk-contact__link">
                <WhatsAppIcon size={18} /> {WHATSAPP_DISPLAY}
              </a>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

