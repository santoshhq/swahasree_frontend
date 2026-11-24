import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AddressForm } from '../components/AddressForm'
import { ArrowIcon, CartIcon, ChevronIcon, EditIcon, MailIcon, PinIcon, PlusIcon, TrashIcon, UserIcon } from '../components/Icons'
import { SignInPrompt } from '../components/SignInPrompt'
import { StatusPill } from '../components/StatusPill'
import { BrandLink, EmptyState, ErrorState, Loading, ProductImage } from '../components/ui'
import { ADDRESS_TYPES } from '../lib/addresses'
import { ApiError, deleteAddress, getMe, getMyOrders, setDefaultAddress } from '../lib/api'
import { awaitsPayment, money, orderDate, plural, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../lib/format'
import type { Customer, Order, SavedAddress } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../state/auth'
import { usePageMeta } from '../lib/seo'

const PAGE = 10
// Photos shown on an order row; the rest are summed up as "+N".
const THUMBS = 3

type Section = 'orders' | 'addresses' | 'profile'
const SECTIONS: { id: Section; label: string; icon: typeof CartIcon }[] = [
  { id: 'orders', label: 'Orders', icon: CartIcon },
  { id: 'addresses', label: 'Addresses', icon: PinIcon },
  { id: 'profile', label: 'Profile', icon: UserIcon },
]

function isExpired(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403)
}

export function AccountPage() {
  usePageMeta({ title: 'Your account', noindex: true })
  const { session, signOut } = useAuth()
  // The open section is in the address (?tab=addresses), so a refresh or a shared link keeps it.
  const [params, setParams] = useSearchParams()
  const section: Section = SECTIONS.find((s) => s.id === params.get('tab'))?.id ?? 'orders'
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [skip, setSkip] = useState(0)
  const token = session?.token ?? ''

  // The profile as it is now (addresses change; the copy saved at sign-in doesn't).
  const me = useFetch((signal) => (token ? getMe(token, signal) : Promise.resolve(null)), `me|${token}`)
  const meExpired = isExpired(me.error)
  useEffect(() => {
    if (meExpired) signOut('expired')
  }, [meExpired, signOut])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getMyOrders(token, skip, PAGE, controller.signal)
      .then((page) => {
        setOrders((current) => (skip === 0 ? page.orders : [...current, ...page.orders]))
        setTotal(page.total)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        // The sign-in lasts a day; after that, sign in with Google again.
        if (isExpired(err)) signOut('expired')
        else { setError(err.message); setLoading(false) }
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, skip])

  if (!session) return <SignInPrompt title="Your orders" text="Sign in with the Google account you ordered with to see your orders, addresses and profile." />
  const customer: Customer = me.data ?? session.customer
  const addressCount = me.data ? me.data.addresses.length : null
  const open = (id: Section) => setParams(id === 'orders' ? {} : { tab: id }, { replace: true })

  return (
    <div className="container page account">
      <IdentityBand customer={customer} />

      <div className="account__layout">
        <nav className="account-nav" aria-label="Your account">
          <ul role="tablist" aria-orientation="vertical">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const count = id === 'orders' ? total : id === 'addresses' ? addressCount : null
              return (
                <li key={id} role="presentation">
                  <button
                    id={`tab-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={section === id}
                    aria-controls={`panel-${id}`}
                    className={`account-nav__item${section === id ? ' is-active' : ''}`}
                    onClick={() => open(id)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {count ? <span className="account-nav__count">{count}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="account-nav__help">
            <MailIcon size={16} />
            <span>
              Need help with an order? {SUPPORT_PHONE ? <>Call <a href={`tel:${SUPPORT_PHONE}`}>{SUPPORT_PHONE_DISPLAY}</a></> : <>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></>}
              or write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </span>
          </p>
        </nav>

        <section id={`panel-${section}`} role="tabpanel" aria-labelledby={`tab-${section}`} className="account__panel">
          {section === 'orders' && (
            <>
              <header className="account__panel-head">
                <h2>Your orders</h2>
                {total > 0 && <p>{plural(total, 'order')}, newest first</p>}
              </header>
              {error ? (
                <ErrorState message={error} onRetry={() => setSkip(0)} />
              ) : loading && !orders.length ? (
                <Loading label="Loading your orders…" />
              ) : !orders.length ? (
                <EmptyState title="No orders yet">
                  <p>Your orders will show up here, with their delivery status.</p>
                  <BrandLink to="/shop">Start shopping</BrandLink>
                </EmptyState>
              ) : (
                <>
                  <ul className="order-list">
                    {orders.map((order) => <OrderRow key={order.order_id} order={order} />)}
                  </ul>
                  {orders.length < total && (
                    <div className="load-more">
                      <button className="text-button" disabled={loading} onClick={() => setSkip(orders.length)}>
                        {loading ? 'Loading…' : `Show older orders (${total - orders.length} more)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {section === 'addresses' && (
            me.error && !meExpired ? <ErrorState message={me.error.message} onRetry={me.reload} />
              : !me.data ? <Loading label="Loading your addresses…" />
              : <AddressesPanel token={token} customer={me.data} onChanged={me.reload} />
          )}

          {section === 'profile' && <ProfilePanel customer={customer} orderCount={total} onSignOut={() => signOut()} />}
        </section>
      </div>
    </div>
  )
}

function Avatar({ customer }: { customer: Customer }) {
  const [broken, setBroken] = useState(false)
  const initials = (customer.name || customer.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return customer.picture && !broken ? (
    <img className="account-avatar" src={customer.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  ) : (
    <span className="account-avatar account-avatar--initials" aria-hidden>{initials}</span>
  )
}

// Who is signed in: just the photo and the name (signing out lives in the Profile tab).
function IdentityBand({ customer }: { customer: Customer }) {
  return (
    <header className="account-band">
      <Avatar customer={customer} />
      <h1>{customer.name || 'Your account'}</h1>
    </header>
  )
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.7 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}

// Product photos first, so an order can be recognised without opening it.
function OrderRow({ order }: { order: Order }) {
  // Free items from offers are left out of the pictures and names: they repeat or add to the paid ones.
  const paid = order.items.filter((i) => !i.is_free)
  const shown = paid.slice(0, THUMBS)
  const more = paid.length - shown.length
  const due = awaitsPayment(order)
  return (
    <li className={due ? 'order-list__due' : undefined}>
      <Link to={`/account/orders/${order.order_id}`} className="order-row order-row--thumbs">
        <span className="order-row__thumbs" aria-hidden>
          {shown.map((item) => (
            <span key={`${item.product_id}|${item.variant_name}`} className="order-row__thumb">
              <ProductImage src={item.image} alt="" />
            </span>
          ))}
          {more > 0 && <span className="order-row__thumb order-row__thumb--more">+{more}</span>}
        </span>
        <span className="order-row__main">
          <span className="order-row__number">{order.order_number}</span>
          <span className="order-row__names">{paid.map((i) => i.product_name).join(', ')}</span>
          <span className="order-row__meta">
            {orderDate(order.created_at)}, {plural(order.items.reduce((n, i) => n + i.quantity, 0), 'item')}
          </span>
        </span>
        <StatusPill status={order.status} />
        <span className="order-row__total price">{money(order.pricing.total)}</span>
        <ChevronIcon className="order-row__chevron" />
      </Link>
      {/* Outside the link: a button can't sit inside one. */}
      {due && (
        <div className="order-due">
          <p>Payment pending. Your order is saved until you pay.</p>
          <Link to={`/account/orders/${order.order_id}`} className="account-button order-due__button">
            Complete payment <ArrowIcon size={16} />
          </Link>
        </div>
      )}
    </li>
  )
}

function AddressesPanel({ token, customer, onChanged }: { token: string; customer: Customer; onChanged: () => void }) {
  const { signOut } = useAuth()
  const addresses = customer.addresses
  // null: the list; { address: null }: adding; { address }: editing that one.
  const [editor, setEditor] = useState<{ address: SavedAddress | null } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (addressId: string, action: () => Promise<unknown>) => {
    setWorking(addressId)
    setError(null)
    try {
      await action()
      setConfirmingDelete(null)
      onChanged()
    } catch (err) {
      if (isExpired(err)) signOut('expired')
      else setError((err as Error).message)
    } finally {
      setWorking(null)
    }
  }

  if (editor) {
    return (
      <>
        <header className="account__panel-head">
          <h2>{editor.address ? 'Edit address' : 'Add an address'}</h2>
          <p>{editor.address ? 'Changes apply to your next orders.' : 'Saved to your account and ready at checkout.'}</p>
        </header>
        <div className="account__form">
          <AddressForm
            key={editor.address?.address_id ?? 'new'}
            token={token}
            address={editor.address}
            defaultName={customer.name ?? ''}
            isFirst={!addresses.length}
            onSaved={() => { setEditor(null); onChanged() }}
            onCancel={() => setEditor(null)}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <header className="account__panel-head account__panel-head--action">
        <div>
          <h2>Saved addresses</h2>
          <p>Your default address is selected for you at checkout.</p>
        </div>
        {addresses.length > 0 && (
          <button type="button" className="account-button" onClick={() => setEditor({ address: null })}>
            <PlusIcon size={18} /> Add address
          </button>
        )}
      </header>

      {error && <p className="notice notice--warn" role="alert">{error}</p>}

      {!addresses.length ? (
        <div className="account-empty">
          <span className="account-empty__icon" aria-hidden><PinIcon size={26} /></span>
          <h3>No saved addresses yet</h3>
          <p>Add your home or work address now, and checkout will have it ready.</p>
          <button type="button" className="account-button" onClick={() => setEditor({ address: null })}>
            <PlusIcon size={18} /> Add address
          </button>
        </div>
      ) : (
        <ul className="saved-addresses">
          {addresses.map((a) => {
            const type = ADDRESS_TYPES.find((t) => t.id === a.address_type) ?? ADDRESS_TYPES[2]
            const Icon = type.icon
            const busy = working === a.address_id
            return (
              <li key={a.address_id} className={`saved-address${a.is_default ? ' is-default' : ''}`}>
                <div className="saved-address__head">
                  <span className="saved-address__type"><Icon size={16} /> {type.label}</span>
                  {a.is_default && <span className="saved-address__badge">Default</span>}
                </div>
                <p className="saved-address__name">{a.full_name}</p>
                <p className="saved-address__lines">
                  {a.House_number_building_street}
                  {a.Area_or_locality && <>, {a.Area_or_locality}</>}
                  {a.Landmark && <><br />Near {a.Landmark}</>}
                  <br />{a.City_or_town}, {a.State} {a.PIN_code}, {a.Country ?? 'India'}
                </p>
                <p className="saved-address__phone">
                  {a.mobile_number}{a.alternative_mobilenumber && <>, {a.alternative_mobilenumber}</>}
                </p>

                {confirmingDelete === a.address_id ? (
                  <div className="saved-address__confirm" role="group" aria-label="Confirm delete">
                    <span>Delete this address?</span>
                    <button type="button" className="text-button text-button--danger" disabled={busy}
                      onClick={() => run(a.address_id, () => deleteAddress(token, a.address_id))}>
                      {busy ? 'Deleting…' : 'Delete'}
                    </button>
                    <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmingDelete(null)}>Keep</button>
                  </div>
                ) : (
                  <div className="saved-address__actions">
                    <button type="button" className="text-button" onClick={() => setEditor({ address: a })}>
                      <EditIcon /> Edit
                    </button>
                    {!a.is_default && (
                      <button type="button" className="text-button" disabled={busy}
                        onClick={() => run(a.address_id, () => setDefaultAddress(token, a.address_id))}>
                        {busy ? 'Saving…' : 'Make default'}
                      </button>
                    )}
                    <button type="button" className="text-button saved-address__delete" onClick={() => setConfirmingDelete(a.address_id)}
                      aria-label={`Delete ${type.label} address`}>
                      <TrashIcon size={16} />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function ProfilePanel({ customer, orderCount, onSignOut }: { customer: Customer; orderCount: number; onSignOut: () => void }) {
  return (
    <>
      <header className="account__panel-head">
        <h2>Account details</h2>
        <p>Your name, email and photo come from your Google account. Change them there, and they update here the next time you sign in.</p>
      </header>
      <dl className="account-details">
        <div><dt>Name</dt><dd>{customer.name || 'Not set'}</dd></div>
        <div><dt>Email</dt><dd>{customer.email}</dd></div>
        <div><dt>Sign-in</dt><dd className="account-details__google"><GoogleMark /> Google account</dd></div>
        <div><dt>Orders placed</dt><dd>{orderCount || customer.total_orders || 'None yet'}</dd></div>
        {customer.first_order_at && <div><dt>First order</dt><dd>{orderDate(customer.first_order_at)}</dd></div>}
      </dl>
      <div className="account-signout">
        <div>
          <h3>Sign out</h3>
          <p>Your cart stays on this device. You can sign back in with Google any time.</p>
        </div>
        <button type="button" className="account-button account-button--quiet" onClick={onSignOut}>Sign out</button>
      </div>
    </>
  )
}
