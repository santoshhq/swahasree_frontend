import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SearchIcon } from '../../components/Icons'
import { StatusPill } from '../../components/StatusPill'
import { ErrorState, Loading } from '../../components/ui'
import { getAdminCustomers, getAdminOrders, type AdminCustomer } from '../../lib/adminApi'
import { money, orderDate, plural } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { AdminPageHead, Modal } from './AdminUi'
import { panel } from '../../lib/panelPath'

// Customers per page; the admin can pick another size, which stays in the address (?size=).
const PAGE_SIZES = [10, 20, 40, 50]
// Orders per page inside the "Orders" popup.
const ORDERS_PAGE = 10

export function CustomersPage() {
  // A customer's orders come from the orders list, so opening them needs the orders section.
  const canSeeOrders = useCan('orders').view
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const size = PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : PAGE_SIZES[0]
  // The customer whose orders are open in the popup; orders load only then.
  const [viewing, setViewing] = useState<AdminCustomer | null>(null)

  const customers = useFetch(
    (signal) => getAdminCustomers({ search: q || undefined, skip: (page - 1) * size, limit: size }, signal),
    `admin-customers|${params.toString()}`,
  )

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }
  const rows = customers.data?.customers ?? []
  const total = customers.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const goToPage = (n: number) => {
    set({ page: n > 1 ? String(n) : null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <AdminPageHead title="Customers" subtitle="Everyone who has signed in or ordered. Open a customer's orders when you need them." />

      <div className="toolbar">
        {/* Keyed by the search in the address, so the box shows it after back/forward or a shared link. */}
        <CustomerSearch key={q} initial={q} onSearch={(term) => set({ q: term || null })} />
      </div>

      {customers.loading && !customers.data ? (
        <Loading />
      ) : customers.error ? (
        <ErrorState message={customers.error.message} onRetry={customers.reload} />
      ) : rows.length === 0 ? (
        <div className="panel panel__empty">
          {q ? `No customers match “${q}”.` : 'No customers yet. They will show up here once they sign in or place an order.'}
        </div>
      ) : (
        <div className="panel panel--flush">
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Customer</th><th>Mobile</th><th className="hide-sm">Joined</th><th>Last order</th>
                  <th className="num">Orders</th><th className="num">Spent</th>
                  <th className="table__actions"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.customer_id}>
                    <td className="cell-main">
                      <span className="table__strong">{c.name || 'No name yet'}</span>
                      <span className="table__sub">{c.email_id}</span>
                    </td>
                    <td data-label="Mobile">{c.mobile_number || <span className="muted">Not given</span>}</td>
                    <td className="hide-sm" data-label="Joined">{c.joined_at ? orderDate(c.joined_at) : <span className="muted">—</span>}</td>
                    <td data-label="Last order">{c.last_order_at ? orderDate(c.last_order_at) : <span className="muted">No orders</span>}</td>
                    <td className="num" data-label="Orders">{c.total_orders}</td>
                    <td className="num" data-label="Spent">{money(c.total_spent)}</td>
                    <td className="table__actions">
                      {canSeeOrders && (
                        <button type="button" className="admin-button admin-button--ghost" disabled={c.total_orders === 0}
                          onClick={() => setViewing(c)} title={c.total_orders === 0 ? 'No orders yet' : undefined}>
                          View orders
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="orders-pager">
          <p className="orders-pager__showing">
            Showing {(page - 1) * size + 1}–{(page - 1) * size + rows.length} of {plural(total, 'customer')}
          </p>
          <nav className="admin-pager" aria-label="Pages">
            <button className="admin-button admin-button--ghost" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="admin-button admin-button--ghost" disabled={page >= pages} onClick={() => goToPage(page + 1)}>Next</button>
          </nav>
          <label className="orders-pager__size">
            <span>Customers per page</span>
            <select className="admin-input" value={size} onChange={(e) => set({ size: e.target.value === String(PAGE_SIZES[0]) ? null : e.target.value })}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Keyed by customer, so each one opens on its first page of orders. */}
      {viewing && <CustomerOrders key={viewing.customer_id} customer={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

// Suggestions start at the third letter, after a short pause in typing.
const MIN_LETTERS = 3
const DELAY_MS = 200
const SUGGESTIONS = 6

type Results = { query: string; customers: AdminCustomer[] }

/**
 * The customers search with a type-ahead list (the same combobox pattern as the shop's SearchBox):
 * the arrow keys move through the list, Enter picks the highlighted customer or searches for the text,
 * Escape closes the list. Picking a customer narrows the list to their email.
 */
function CustomerSearch({ initial, onSearch }: { initial: string; onSearch: (term: string) => void }) {
  const [text, setText] = useState(initial)
  const [results, setResults] = useState<Results | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const term = text.trim().replace(/\s+/g, ' ')
  const ready = term.length >= MIN_LETTERS

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      getAdminCustomers({ search: term, skip: 0, limit: SUGGESTIONS }, controller.signal)
        .then((r) => {
          setResults({ query: term, customers: r.customers })
          setActive(-1)
        })
        // No suggestions is fine: pressing Enter still searches.
        .catch(() => {})
    }, DELAY_MS)
    // Typing on cancels the wait and any request still in flight, so an old answer never wins.
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [term, ready])

  // The last answer is only shown for the exact text it was for (matches can be anywhere in a name or email).
  const current = ready && results !== null && results.query === term
  const suggestions = current ? results.customers : []
  const showList = open && current
  // The suggestions, then the "See all results" row.
  const rows = suggestions.length + 1

  const close = () => {
    setOpen(false)
    setActive(-1)
  }
  const searchFor = (value: string) => {
    close()
    inputRef.current?.blur()
    setText(value)
    onSearch(value)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (showList && active >= 0 && active < suggestions.length) searchFor(suggestions[active].email_id)
    else searchFor(term)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && showList) {
      event.preventDefault()
      close()
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && ready) {
      event.preventDefault()
      if (!showList) {
        setOpen(true)
        return
      }
      // Positions run from -1 (back in the input) to the last row, and wrap around.
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => ((i + 1 + step + rows + 1) % (rows + 1)) - 1)
    }
  }

  const rowId = (i: number) => `${listId}-row-${i}`

  return (
    <form className="admin-search admin-search--inline admin-search--suggest" onSubmit={submit} role="search">
      <SearchIcon size={18} />
      <label htmlFor="customer-search" className="visually-hidden">Search customers</label>
      <input
        ref={inputRef}
        id="customer-search"
        placeholder="Name, email or mobile number"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? rowId(active) : undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      {initial && <button type="button" className="text-button" onClick={() => searchFor('')}>Clear</button>}

      {showList && (
        // preventDefault on mousedown keeps focus in the input, so a click on a row isn't lost to the input's blur.
        <ul id={listId} role="listbox" aria-label="Suggestions" className="search-suggest" onMouseDown={(e) => e.preventDefault()}>
          {suggestions.map((c, i) => (
            <li
              key={c.customer_id}
              id={rowId(i)}
              role="option"
              aria-selected={i === active}
              className="search-suggest__item search-suggest__item--plain"
              onClick={() => searchFor(c.email_id)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search-suggest__text">
                <span className="search-suggest__name"><Highlight text={c.name || 'No name yet'} term={term} /></span>
                <span className="search-suggest__meta">
                  <Highlight text={c.email_id} term={term} />
                  {c.mobile_number && <> · <Highlight text={c.mobile_number} term={term} /></>}
                </span>
              </span>
              <span className="search-suggest__meta">{plural(c.total_orders, 'order')}</span>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="search-suggest__empty" role="presentation">No customers match “{term}”.</li>
          )}
          <li
            id={rowId(suggestions.length)}
            role="option"
            aria-selected={active === suggestions.length}
            className="search-suggest__all"
            onClick={() => searchFor(term)}
            onMouseEnter={() => setActive(suggestions.length)}
          >
            <SearchIcon size={16} />
            <span>See all results for “{term}”</span>
          </li>
        </ul>
      )}
    </form>
  )
}

// Bolds the first place the typed text appears, the same "anywhere, any case" rule the server matches on.
export function Highlight({ text, term }: { text: string; term: string }) {
  const start = text.toLowerCase().indexOf(term.toLowerCase())
  if (start < 0) return <>{text}</>
  const end = start + term.length
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

/** One customer's orders in this store, newest first, loaded when the popup opens. */
function CustomerOrders({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const orders = useFetch(
    (signal) => getAdminOrders({ email_id: customer.email_id, skip: (page - 1) * ORDERS_PAGE, limit: ORDERS_PAGE }, signal),
    `customer-orders|${customer.email_id}|${page}`,
  )
  const rows = orders.data?.orders ?? []
  const total = orders.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE))

  return (
    <Modal
      open
      onClose={onClose}
      title={`${customer.name || customer.email_id}'s orders`}
      subtitle={`${plural(customer.total_orders, 'order')} · ${money(customer.total_spent)} spent`}
      footer={pages > 1 ? (
        <nav className="admin-pager" aria-label="Order pages">
          <button className="admin-button admin-button--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="admin-button admin-button--ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      ) : undefined}
    >
      {orders.loading && !orders.data ? (
        <Loading />
      ) : orders.error ? (
        <ErrorState message={orders.error.message} onRetry={orders.reload} />
      ) : rows.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table table--clickable table--cards">
            <thead>
              <tr><th>Order</th><th>Placed</th><th>Status</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.order_id}>
                  <td className="cell-main"><Link to={panel(`/admin/orders/${o.order_id}`)} className="table__strong row-link">{o.order_number}</Link></td>
                  <td data-label="Placed">{orderDate(o.created_at)}</td>
                  <td className="cell-aside"><StatusPill status={o.status} /></td>
                  <td className="num" data-label="Total">{money(o.pricing.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
