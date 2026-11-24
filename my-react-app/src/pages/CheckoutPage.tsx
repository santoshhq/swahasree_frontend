import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ActionBar } from '../components/ActionBar'
import { AddressForm } from '../components/AddressForm'
import { CheckoutSteps } from '../components/CheckoutSteps'
import { useConfetti } from '../components/Confetti'
import { OfferNudges } from '../components/Offers'
import { BagIcon, CardIcon, CashIcon, EditIcon, GiftIcon, LockIcon, PinIcon, PlusIcon, TruckIcon, UserIcon } from '../components/Icons'
import { BrandButton, ProductImage } from '../components/ui'
import { ApiError, getMyAddresses, getPaymentOptions, getShippingQuote, placeOrder, validateCoupon, verifyPayment } from '../lib/api'
import { ADDRESS_TYPES } from '../lib/addresses'
import { flavorSummary } from '../lib/flavor'
import { useOfferPreview } from '../lib/offers'
import { money, plural, taxIncluded } from '../lib/format'
import { payWithRazorpay } from '../lib/razorpay'
import type { Customer, CouponQuote, OrderItem, PaymentMethod, SavedAddress } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../state/auth'
import { orderLine, useCart, type CartItem } from '../state/cart'
import { useSignIn } from '../state/signIn'
import { usePageMeta } from '../lib/seo'

// Fields that bring up the phone keyboard (not the payment radio buttons).
function isTextField(target: EventTarget): boolean {
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    || (target instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit'].includes(target.type))
}

function newKey(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

function isExpired(err: Error | null): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403)
}

// Ordering needs a signed-in customer:
//   not signed in          -> the sign-in popup (SignInDialog), over the order summary
//   signed in, no address  -> add the first delivery address
//   signed in with address -> the default address is preselected; change, edit or add one
export function CheckoutPage() {
  usePageMeta({ title: 'Checkout', noindex: true })
  const { session } = useAuth()
  const { items } = useCart()
  const lines = items.filter((i) => !i.unavailable)
  if (!lines.length) return <Navigate to="/cart" replace />
  if (!session) return <CheckoutSignIn />
  return <CheckoutForm key={session.token} token={session.token} customer={session.customer} />
}

// Title, what's in the bag and its price, and the way back to the bag.
function CheckoutHead({ itemCount, subtotal }: { itemCount: number; subtotal: number }) {
  return (
    <header className="checkout__head">
      <div>
        <h1>Checkout</h1>
        <p className="checkout__meta">
          <span className="checkout__chip"><BagIcon size={15} /> {plural(itemCount, 'item')}</span>
          <span className="checkout__chip checkout__chip--price">Subtotal <strong>{money(subtotal)}</strong></span>
          <span className="checkout__meta-note">Delivery is charged by PIN code</span>
        </p>
      </div>
      <Link to="/cart" className="checkout__back"><EditIcon size={14} /> Edit bag</Link>
    </header>
  )
}

// The bag's lines in the summary: a quantity badge on the photo, then the size, count and unit price.
function SummaryItems({ items, freeItems }: { items: CartItem[]; freeItems: OrderItem[] }) {
  return (
    <ul className="summary__items">
      {items.map((i) => (
        <li key={`${i.product_id}|${i.variant_name}`}>
          <span className="summary__thumb-wrap">
            <ProductImage src={i.image} alt="" className="summary__thumb" />
            <span className="summary__qty" aria-hidden>{i.quantity}</span>
          </span>
          <span className="summary__item-name">
            {i.product_name}
            <small>{i.variant_name} · Qty {i.quantity}{i.quantity > 1 && <> × {money(i.price)}</>}</small>
            {i.customization && <small>{flavorSummary(i.customization)}</small>}
          </span>
          <span className="summary__item-price">{money(i.price * i.quantity)}</span>
        </li>
      ))}
      {freeItems.map((i) => (
        <li key={`free|${i.offer_id}|${i.product_id}|${i.variant_name}`} className="summary__free">
          <span className="summary__thumb-wrap">
            <ProductImage src={i.image} alt="" className="summary__thumb" />
            <span className="summary__qty" aria-hidden>{i.quantity}</span>
          </span>
          <span className="summary__item-name">{i.product_name}<small>{i.variant_name} · Qty {i.quantity} · {i.offer_title}</small></span>
          <span className="free-price">FREE</span>
        </li>
      ))}
    </ul>
  )
}

function CheckoutSignIn() {
  const { expiredEmail } = useAuth()
  const { openSignIn } = useSignIn()
  const { items, subtotal } = useCart()
  const available = items.filter((i) => !i.unavailable)
  const itemCount = available.reduce((n, l) => n + l.quantity, 0)
  const offerPreview = useOfferPreview(available.map(({ product_id, variant_name, quantity }) => ({ product_id, variant_name, quantity })))

  // The same sign-in popup as everywhere else, opened straight away. Signing in swaps this page for
  // the checkout form, so nothing else is needed afterwards.
  useEffect(() => {
    openSignIn({ purpose: 'checkout' })
    // Once, when checkout opens signed out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="container page checkout">
      <CheckoutHead itemCount={itemCount} subtotal={subtotal} />

      {/* Signed out: the bag is done, signing in is the start of the address step. */}
      <CheckoutSteps current={2} />

      <div className="checkout-layout">
        <section className="checkout-signin" aria-labelledby="checkout-signin-title">
          <span className="checkout-signin__icon" aria-hidden><UserIcon size={24} /></span>
          <h2 id="checkout-signin-title">Sign in to continue</h2>
          {expiredEmail ? (
            <p className="notice notice--warn" role="status">Your sign-in has ended. Please continue with Google again. Your bag is saved.</p>
          ) : (
            <p className="checkout-signin__lead">Use your Google account to place your order.</p>
          )}
          {/* In case the popup was closed: open it again. */}
          <BrandButton type="button" aria-haspopup="dialog" onClick={() => openSignIn({ purpose: 'checkout' })}>Sign in to continue</BrandButton>
          <p className="checkout-signin__note"><LockIcon size={14} /> Your bag is saved while you sign in.</p>
        </section>

        <aside className="summary" aria-label="Order summary">
          <h2><BagIcon size={20} /> Your order <span className="summary__count">{plural(itemCount, 'item')}</span></h2>
          <SummaryItems items={available} freeItems={offerPreview?.free_items ?? []} />
          <dl className="summary__rows">
            <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
            <div><dt>Delivery</dt><dd className="summary__pending">After you add an address</dd></div>
            <div className="summary__total">
              <dt>Total so far<small> plus delivery</small></dt>
              <dd>{money(subtotal)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}

function CheckoutForm({ token, customer }: { token: string; customer: Customer }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { items, subtotal } = useCart()
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  // What the button is waiting on, so the customer knows the payment window is coming.
  const [stage, setStage] = useState<'placing' | 'paying' | 'confirming'>('placing')
  const [orderError, setOrderError] = useState<string | null>(null)
  const [chosenMethod, setChosenMethod] = useState<PaymentMethod | null>(null)
  // True while a text field has focus: the phone keyboard is up, so the pinned total bar steps aside.
  const [typing, setTyping] = useState(false)
  const payButton = useRef<HTMLButtonElement>(null)

  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<CouponQuote | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  // A coupon that works gets a little celebration: confetti from the coupon box.
  const couponBox = useRef<HTMLDivElement>(null)
  const { fire: celebrate, confetti } = useConfetti()

  // One key per checkout: if the connection drops after the order was saved, pressing the
  // button again returns that same order instead of creating a second one.
  const idempotencyKey = useRef(newKey())

  // ---- Delivery address: one of the saved ones, or the form to add / edit one ----
  const addresses = useFetch((signal) => getMyAddresses(token, signal), `addresses|${token}`)
  const saved = addresses.data?.addresses ?? []
  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null)
  // Preselected: the one picked on this page, else the default, else the first.
  const selected: SavedAddress | null =
    saved.find((a) => a.address_id === chosenAddressId) ?? saved.find((a) => a.is_default) ?? saved[0] ?? null
  const [editor, setEditor] = useState<{ address: SavedAddress | null } | null>(null)
  // A new customer (or one who deleted every address) goes straight to the form.
  const noAddresses = addresses.data !== null && saved.length === 0
  const showingForm = editor !== null || noAddresses

  // The sign-in lasts a day; after that, back to "Continue with Google" (the bag is kept).
  const addressesExpired = isExpired(addresses.error)
  useEffect(() => {
    if (addressesExpired) signOut('expired')
  }, [addressesExpired, signOut])

  const lines = items.filter((i) => !i.unavailable).map(({ product_id, variant_name, quantity }) => ({ product_id, variant_name, quantity }))
  // Free items from offers: shown in the summary, and added to the order by the backend.
  const offerPreview = useOfferPreview(lines)
  const freeItems = offerPreview?.free_items ?? []
  // The store decides which payment methods it takes; any product in the bag identifies the store.
  const firstProduct = lines[0]?.product_id ?? ''
  // An empty bag redirects below, so there is nothing to ask the server about.
  const paymentOptions = useFetch(
    (signal) => (firstProduct ? getPaymentOptions(firstProduct, signal) : Promise.resolve(null)),
    `payment-options|${firstProduct}`,
  )
  const methods = paymentOptions.data?.methods ?? []
  const method: PaymentMethod | null = chosenMethod && methods.includes(chosenMethod) ? chosenMethod : paymentOptions.data?.default ?? null

  // Delivery charge from Shiprocket to the chosen address's PIN code; asked again when the address,
  // the payment method (cash on delivery costs more to ship), the coupon (delivery is free above the
  // store's order value, counted after the discount) or the bag changes.
  const pincode = !showingForm && selected ? selected.PIN_code : ''
  const pinReady = /^[1-9]\d{5}$/.test(pincode)
  const bagKey = lines.map((l) => `${l.product_id}:${l.variant_name}:${l.quantity}`).join(',')
  const couponCode = coupon?.code ?? null
  const shippingKey = pinReady && method ? `${pincode}|${method}|${couponCode ?? ''}|${bagKey}` : ''
  const shipping = useFetch(
    (signal) => (shippingKey && method ? getShippingQuote(pincode, lines, method, couponCode, signal, token) : Promise.resolve(null)),
    `shipping|${shippingKey}`,
  )
  // While a new quote loads, the old one (another PIN code or method) must not be used.
  const shippingQuote = !shipping.loading && shipping.data?.pincode === pincode ? shipping.data : null
  const shippingFee = shippingQuote?.shipping_fee ?? null
  // No address chosen yet, or a PIN code without a charge yet (loading, or no courier delivers there): can't pay yet.
  const waitingForDelivery = !pinReady || shippingFee === null

  const prepaid = method === 'PREPAID'
  const discount = coupon?.pricing.discount ?? 0
  const codFee = method === 'COD' ? paymentOptions.data?.cod_fee ?? 0 : 0
  const total = Math.max(0, subtotal - discount) + codFee + (shippingFee ?? 0)
  const maxCod = paymentOptions.data?.max_cod_order_value ?? null
  const codTooLarge = method === 'COD' && maxCod !== null && total > maxCod

  // A different method or coupon is a different order, so it gets a new key. The key is kept
  // only for retrying the same order: pressing Pay again after closing Razorpay reopens it.
  const startNewOrder = () => { idempotencyKey.current = newKey() }

  const chooseMethod = (next: PaymentMethod) => {
    if (next === method) return
    setChosenMethod(next)
    setOrderError(null)
    startNewOrder()
  }

  const chooseAddress = (id: string) => {
    if (id === selected?.address_id) return
    setChosenAddressId(id)
    setOrderError(null)
    startNewOrder()
  }

  // A saved address becomes the chosen one; the list is read again for the new default flags.
  const addressSaved = (address: SavedAddress) => {
    setChosenAddressId(address.address_id)
    setEditor(null)
    setOrderError(null)
    startNewOrder()
    addresses.reload()
  }

  const applyCoupon = async (event: FormEvent) => {
    event.preventDefault()
    const code = couponInput.trim()
    if (!code) return
    setCheckingCoupon(true)
    setCouponError(null)
    try {
      setCoupon(await validateCoupon(code, lines, token))
      startNewOrder()
      celebrate(couponBox.current)
    } catch (err) {
      setCoupon(null)
      setCouponError((err as Error).message)
    } finally {
      setCheckingCoupon(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (showingForm || !selected) {
      setOrderError('Save your delivery address first.')
      return
    }
    if (!method || waitingForDelivery) return
    setPlacing(true)
    setStage('placing')
    setOrderError(null)
    const a = selected
    try {
      const { order, payment } = await placeOrder(
        token,
        {
          // The email is the signed-in account's; name and phone are the delivery address's.
          customer: { full_name: a.full_name, email_id: customer.email, mobile_number: a.mobile_number },
          shipping_address: {
            line1: a.House_number_building_street,
            line2: a.Area_or_locality || null,
            landmark: a.Landmark || null,
            city: a.City_or_town,
            country: a.Country ?? 'India',
            state: a.State,
            pincode: a.PIN_code,
          },
          items: items.filter((item) => !item.unavailable).map(orderLine),
          coupon_code: coupon?.code,
          payment_method: method,
          notes: notes.trim() || undefined,
        },
        idempotencyKey.current,
      )

      let placed = order
      if (payment) {
        setStage('paying')
        const result = await payWithRazorpay(payment, 'Swahasree')
        setStage('confirming')
        placed = (await verifyPayment(order.order_id, result)).order
      } else if (order.status === 'cancelled') {
        // Retrying an online payment after it timed out: that order is gone, the next press makes a new one.
        startNewOrder()
        throw new Error('That payment attempt expired. Press Pay again to start a new one.')
      }
      // The confirmation page empties the bag. Emptying it here would re-render this page with
      // no items before the navigation lands, and its "empty bag" redirect to /cart would win.
      navigate('/order-placed', { replace: true, state: { order: placed } })
    } catch (err) {
      if (isExpired(err as Error)) {
        signOut('expired')
        return
      }
      // A coupon that stopped working is dropped so the next try goes through at full price, visibly.
      if (err instanceof ApiError && /coupon/i.test(err.message)) {
        setCoupon(null)
        startNewOrder()
      }
      setOrderError((err as Error).message)
      setPlacing(false)
    }
  }

  const busyLabel = stage === 'paying' ? 'Waiting for payment…' : stage === 'confirming' ? 'Confirming payment…' : 'Placing order…'
  const buttonLabel = placing ? busyLabel : prepaid ? `Pay ${money(total)}` : 'Place order'
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0)
  const cannotPay = placing || !method || codTooLarge || waitingForDelivery || showingForm
  const firstName = customer.name?.split(' ')[0]

  // The address step is done once a saved address is chosen (not while adding or editing one).
  const addressChosen = !showingForm && selected !== null

  return (
    <div className="container page checkout">
      <CheckoutHead itemCount={itemCount} subtotal={subtotal} />

      <CheckoutSteps current={addressChosen ? 3 : 2} />

      <form
        className="checkout-layout"
        onSubmit={submit}
        noValidate
        onFocus={(e) => setTyping(isTextField(e.target))}
        onBlur={() => setTyping(false)}
      >
        <div className="checkout-form">
          <div className="checkout__account">
            {customer.picture
              ? <img src={customer.picture} alt="" className="checkout__avatar" referrerPolicy="no-referrer" />
              : <span className="checkout__section-icon" aria-hidden><UserIcon size={18} /></span>}
            <span className="checkout__account-text">
              Ordering as <strong>{customer.name || customer.email}</strong>
              <small>{customer.email}: your order confirmation goes here</small>
            </span>
            <button type="button" className="text-button" onClick={() => signOut()}>Not you?</button>
          </div>

          <fieldset className="form-section">
            <legend><span className="checkout__section-icon" aria-hidden><PinIcon size={18} /></span>Delivery address</legend>
            {addresses.error && !addressesExpired ? (
              <div className="notice notice--warn" role="alert">
                Couldn't load your addresses. <button type="button" className="text-button" onClick={addresses.reload}>Try again</button>
              </div>
            ) : !addresses.data ? (
              <p className="form-section__hint">Loading your addresses…</p>
            ) : showingForm ? (
              <>
                <p className="form-section__hint">
                  {noAddresses
                    ? `Welcome${firstName ? `, ${firstName}` : ''}! Where should we deliver? We'll save this address to your account, so next time it's ready.`
                    : editor?.address ? 'Update this address. Changes are saved to your account.' : 'Add another address to your account.'}
                </p>
                <AddressForm
                  key={editor?.address?.address_id ?? 'new'}
                  token={token}
                  address={editor?.address ?? null}
                  defaultName={customer.name ?? ''}
                  isFirst={noAddresses}
                  onSaved={addressSaved}
                  onCancel={noAddresses ? undefined : () => setEditor(null)}
                />
              </>
            ) : (
              <>
                <div className="address-list" role="radiogroup" aria-label="Deliver to">
                  {saved.map((a) => (
                    <AddressCard
                      key={a.address_id}
                      address={a}
                      checked={a.address_id === selected?.address_id}
                      onChoose={() => chooseAddress(a.address_id)}
                      onEdit={() => setEditor({ address: a })}
                    />
                  ))}
                </div>
                <button type="button" className="address-add" onClick={() => setEditor({ address: null })}>
                  <PlusIcon size={18} /> Add a new address
                </button>
              </>
            )}
            {pinReady && (
              <div className={`delivery-check${shipping.error ? ' delivery-check--error' : ''}`} role="status">
                <TruckIcon size={18} />
                {shipping.error ? (
                  <span>
                    {shipping.error.message}{' '}
                    <button type="button" className="text-button" onClick={shipping.reload}>Try again</button>
                  </span>
                ) : shippingQuote ? (
                  <span>
                    Delivery to <strong>{shippingQuote.pincode}</strong>: <strong>{shippingQuote.shipping_fee ? money(shippingQuote.shipping_fee) : 'Free'}</strong>
                    {shippingQuote.free_shipping_reason === 'zone' && ' (free delivery to your area)'}
                    {shippingQuote.free_shipping_reason === 'min_order' && shippingQuote.free_shipping_threshold !== null
                      && ` (free delivery on orders of ${money(shippingQuote.free_shipping_threshold)} or more)`}
                    {shippingQuote.delivery_date
                      ? <>, arrives by <strong>{arrivalDay(shippingQuote.delivery_date)}</strong></>
                      : shippingQuote.estimated_delivery_days ? `, arrives in about ${plural(shippingQuote.estimated_delivery_days, 'day')}` : ''}
                  </span>
                ) : (
                  <span>Checking delivery to {pincode}…</span>
                )}
              </div>
            )}
            <div className="field">
              <label htmlFor="field-notes">Delivery instructions (optional)</label>
              <textarea id="field-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Call before delivery" />
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend><span className="checkout__section-icon" aria-hidden><CardIcon size={18} /></span>Payment</legend>
            {paymentOptions.error ? (
              <div className="notice notice--warn" role="alert">
                Couldn't load the payment options. <button type="button" className="text-button" onClick={paymentOptions.reload}>Try again</button>
              </div>
            ) : !paymentOptions.data ? (
              <p className="form-section__hint">Loading payment options…</p>
            ) : (
              <div className="payment-options" role="radiogroup" aria-label="Payment method">
                {methods.includes('PREPAID') && (
                  <label className={`payment-option${prepaid ? ' is-on' : ''}`}>
                    <input type="radio" name="payment" checked={prepaid} onChange={() => chooseMethod('PREPAID')} />
                    <CardIcon />
                    <div>
                      <strong>Pay online</strong>
                      <p>UPI, cards, net banking or wallets, securely through Razorpay.</p>
                    </div>
                  </label>
                )}
                {methods.includes('COD') && (
                  <label className={`payment-option${method === 'COD' ? ' is-on' : ''}`}>
                    <input type="radio" name="payment" checked={method === 'COD'} onChange={() => chooseMethod('COD')} />
                    <CashIcon />
                    <div>
                      <strong>Cash on delivery</strong>
                      <p>Pay in cash when your order arrives.</p>
                    </div>
                  </label>
                )}
                {codTooLarge && (
                  <p className="field__error">
                    Cash on delivery is available for orders up to {money(maxCod)}.
                    {methods.includes('PREPAID') ? ' Please pay online instead.' : ''}
                  </p>
                )}
              </div>
            )}
          </fieldset>
        </div>

        <aside className="summary" aria-label="Order summary">
          <h2><BagIcon size={20} /> Your order <span className="summary__count">{plural(itemCount, 'item')}</span></h2>
          <SummaryItems items={items.filter((i) => !i.unavailable)} freeItems={freeItems} />
          <OfferNudges nudges={offerPreview?.nudges ?? []} />

          <div className="coupon" ref={couponBox}>
            {coupon ? (
              <div className="coupon__applied coupon__applied--win" role="status">
                <span className="coupon__badge" aria-hidden><GiftIcon size={20} /></span>
                <span className="coupon__win">
                  <strong>{coupon.code} applied!</strong>
                  <span>{discount > 0 ? <>You save <b>{money(discount)}</b> on this order</> : coupon.description ?? 'Coupon added to your order'}</span>
                </span>
                <button type="button" className="text-button" onClick={() => { setCoupon(null); setCouponInput('') }}>Remove</button>
              </div>
            ) : (
              <div className="coupon__form">
                <label htmlFor="coupon-code" className="visually-hidden">Coupon code</label>
                <input
                  id="coupon-code"
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(e) }}
                  autoCapitalize="characters"
                />
                <button type="button" className="text-button" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()}>
                  {checkingCoupon ? 'Checking…' : 'Apply'}
                </button>
              </div>
            )}
            {couponError && <p className="field__error" role="alert">{couponError}</p>}
          </div>

          <dl className="summary__rows">
            <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
            {discount > 0 && <div className="summary__discount"><dt>Coupon discount</dt><dd>−{money(discount)}</dd></div>}
            <div>
              <dt>Delivery</dt>
              <dd className={shippingFee === null ? 'summary__pending' : undefined}>
                {shippingFee !== null ? (shippingFee ? money(shippingFee) : 'Free')
                  : !pinReady ? 'Choose an address'
                  : shipping.error ? 'Not available' : 'Calculating…'}
              </dd>
            </div>
            {codFee > 0 && <div><dt>Cash on delivery fee</dt><dd>{money(codFee)}</dd></div>}
            <div className="summary__total">
              <dt>{prepaid ? 'To pay now' : 'To pay on delivery'}{shippingFee === null && <small> plus delivery</small>}</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          <p className="summary__tax">Including {money(taxIncluded(Math.max(0, subtotal - discount)))} in taxes</p>
          {!!shippingQuote?.amount_left_for_free_shipping && (
            <p className="free-delivery-nudge" role="status">
              <TruckIcon size={16} /> Add <strong>{money(shippingQuote.amount_left_for_free_shipping)}</strong> more for FREE delivery
            </p>
          )}

          {confetti}
          {orderError && <p className="notice notice--warn" role="alert">{orderError}</p>}
          <BrandButton ref={payButton} type="submit" aria-busy={placing || undefined} disabled={cannotPay} className="summary__cta">
            {buttonLabel}
          </BrandButton>
          <p className="summary__note">
            {prepaid
              ? <>You'll pay {money(total)} in Razorpay's secure window. Your order is confirmed once the payment goes through. </>
              : <>By placing the order you agree to pay {money(total)} in cash on delivery. </>}
            <Link to="/cart">Edit bag</Link>
          </p>
          {prepaid && <p className="checkout__secure"><LockIcon size={14} /> Payments are processed securely by Razorpay</p>}
        </aside>

        <ActionBar target={payButton} paused={typing}>
          <div className="action-bar__total">
            <span>{prepaid ? 'To pay now' : 'To pay on delivery'} · {shippingFee === null ? 'plus delivery' : plural(itemCount, 'item')}</span>
            <strong className="price">{money(total)}</strong>
          </div>
          <BrandButton type="submit" aria-busy={placing || undefined} disabled={cannotPay}>
            {placing ? busyLabel : prepaid ? 'Pay now' : 'Place order'}
          </BrandButton>
        </ActionBar>
      </form>
    </div>
  )
}

function AddressCard({ address: a, checked, onChoose, onEdit }: {
  address: SavedAddress
  checked: boolean
  onChoose: () => void
  onEdit: () => void
}) {
  const type = ADDRESS_TYPES.find((t) => t.id === a.address_type) ?? ADDRESS_TYPES[2]
  const Icon = type.icon
  return (
    <div className={`address-card${checked ? ' is-on' : ''}`}>
      <label className="address-card__choose">
        <input type="radio" name="delivery-address" checked={checked} onChange={onChoose} />
        <span className="address-card__body">
          <span className="address-card__head">
            <Icon size={16} />
            <strong>{type.label}</strong>
            {a.is_default && <span className="address-card__badge">Default</span>}
          </span>
          <span className="address-card__name">{a.full_name} · {a.mobile_number}</span>
          <span className="address-card__lines">
            {[a.House_number_building_street, a.Area_or_locality, a.Landmark && `Near ${a.Landmark}`, a.City_or_town, `${a.State} ${a.PIN_code}`, a.Country ?? 'India']
              .filter(Boolean)
              .join(', ')}
          </span>
        </span>
      </label>
      <button type="button" className="text-button address-card__edit" onClick={onEdit} aria-label={`Edit ${type.label} address`}>
        <EditIcon /> Edit
      </button>
    </div>
  )
}

// "Sat, 18 Oct" from a YYYY-MM-DD day (read as a local day, not UTC midnight).
function arrivalDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}
