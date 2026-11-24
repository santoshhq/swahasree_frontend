import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { SearchIcon } from '../../components/Icons'
import { StatusPill } from '../../components/StatusPill'
import { ErrorState, Loading } from '../../components/ui'
import { getAdminOrders, type AdminOrder } from '../../lib/adminApi'
import { ORDER_STEPS, STATUS_LABELS, isPrepaid, money, orderDate, paymentStatusLabel } from '../../lib/format'
import type { OrderStatus } from '../../lib/types'
import { downloadFile, fetchAllOrders, ordersCsv } from '../../lib/orderCsv'
import { useFetch } from '../../lib/useFetch'
import { DownloadIcon, SpinnerIcon } from './AdminIcons'
import { AdminPageHead, Toast } from './AdminUi'
import { Highlight } from './CustomersPage'
import { panel } from '../../lib/panelPath'

// Orders per page; the admin can pick another size, which stays in the address (?size=).
const PAGE_SIZES = [10, 20, 40, 50]
// "Awaiting payment" last: online orders the customer hasn't paid for yet, hidden from "all".
const TABS: (OrderStatus | 'all')[] = ['all', ...ORDER_STEPS, 'cancelled', 'returned', 'payment_pending']

// A day as the date input writes it (YYYY-MM-DD), in the admin's own time zone.
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function shortDay(iso: string, withYear = false): string {
  return parseDay(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

// "on 3 Oct", "from 1 Oct to 7 Oct 2026", "since 1 Oct", "until 7 Oct".
function rangeText(from: string, to: string): string {
  if (from && to) return from === to ? `on ${shortDay(from, true)}` : `from ${shortDay(from)} to ${shortDay(to, true)}`
  if (from) return `since ${shortDay(from, true)}`
  if (to) return `until ${shortDay(to, true)}`
  return ''
}

// orders_2026-10-01_to_2026-10-07.csv; an open end is "until" / today, and a status tab is added at the end.
function csvName(from: string, to: string, today: string, status?: OrderStatus): string {
  const range = from ? `${from}_to_${to || today}` : `until_${to}`
  return `orders_${range}${status ? `_${status}` : ''}.csv`
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as OrderStatus | null) ?? undefined
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const size = PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : PAGE_SIZES[0]
  // The date range is in the address too (?from=&to=), so a refresh or a shared link keeps it.
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  // Read once when the page opens: the latest day the date pickers allow.
  const [today] = useState(() => isoDay(new Date()))
  const dates = rangeText(from, to)
  // The CSV download: how far it has got (null when not running), and what went wrong.
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // One box searches part of the order number, or the customer's name, email or mobile number.
  const matching = {
    status,
    search: q || undefined,
    start_date: from || undefined,
    end_date: to || undefined,
  }
  const filters = { ...matching, skip: (page - 1) * size, limit: size }
  const orders = useFetch((signal) => getAdminOrders(filters, signal), `admin-orders|${params.toString()}`)

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }
  // Every order in the date range (and the status tab and search, as on screen), not just this page.
  const downloadCsv = async () => {
    if (exporting) return
    setExportError(null)
    setExporting({ done: 0, total: orders.data?.total ?? 0 })
    try {
      const all = await fetchAllOrders(matching, (done, total) => setExporting({ done, total }))
      downloadFile(csvName(from, to, today, status), ordersCsv(all))
    } catch (err) {
      setExportError(`The CSV couldn't be made: ${(err as Error).message}`)
    } finally {
      setExporting(null)
    }
  }

  const rows = orders.data?.orders ?? []
  const total = orders.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const goToPage = (n: number) => {
    set({ page: n > 1 ? String(n) : null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <AdminPageHead title="Orders" subtitle="Confirm new orders and move them along until they're delivered." />

      <div className="tabs" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={(status ?? 'all') === t}
            className="tabs__tab"
            onClick={() => set({ status: t === 'all' ? null : t })}
          >
            {t === 'all' ? 'All' : STATUS_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Search and the date range share one row; on narrow screens the dates wrap under the search. */}
      <div className="toolbar order-filters">
        {/* Keyed by the search in the address, so the box shows it after back/forward or a shared link. */}
        <OrderSearch key={q} initial={q} onSearch={(term) => set({ q: term || null })} />
        <div className="order-filters__dates" role="group" aria-label="Orders placed between">
          {/* A From after To (or a To before From) moves the other end along, so the range stays valid. */}
          <label className="order-date">
            <span>From</span>
            <input type="date" value={from} max={today}
              onChange={(e) => set({ from: e.target.value || null, ...(to && e.target.value > to ? { to: e.target.value } : {}) })} />
          </label>
          <label className="order-date">
            <span>To</span>
            <input type="date" value={to} max={today}
              onChange={(e) => set({ to: e.target.value || null, ...(from && e.target.value && e.target.value < from ? { from: e.target.value } : {}) })} />
          </label>
          {(from || to) && <button type="button" className="text-button" onClick={() => set({ from: null, to: null })}>Clear dates</button>}
          {(from || to) && (
            <button type="button" className="admin-button admin-button--ghost order-filters__csv" onClick={downloadCsv}
              disabled={!!exporting || !orders.data?.total} aria-busy={!!exporting || undefined}
              title={orders.data?.total ? `Download the ${orders.data.total} ${orders.data.total === 1 ? 'order' : 'orders'} placed ${dates} as a CSV` : 'No orders to download'}>
              {exporting ? <SpinnerIcon size={16} className="admin-spin" /> : <DownloadIcon size={16} />}
              {exporting ? `Preparing ${exporting.done} of ${exporting.total}…` : 'Download CSV'}
            </button>
          )}
        </div>
      </div>

      {orders.loading && !orders.data ? (
        <Loading />
      ) : orders.error ? (
        <ErrorState message={orders.error.message} onRetry={orders.reload} />
      ) : rows.length === 0 ? (
        <div className="panel panel__empty">
          {q ? `No orders match “${q}”${dates ? ` ${dates}` : ''}.`
            : status ? `No ${STATUS_LABELS[status].toLowerCase()} orders${dates ? ` ${dates}` : ''}.`
            : dates ? `No orders ${dates}.`
            : 'No orders yet. They will show up here as customers check out.'}
          {dates && <> <button type="button" className="text-button" onClick={() => set({ from: null, to: null })}>Show all dates</button></>}
        </div>
      ) : (
        <div className="panel panel--flush">
          <div className="table-wrap">
            <table className="table table--clickable table--cards">
              <thead>
                <tr><th>Order</th><th>Customer</th><th className="hide-sm">Items</th><th>Placed</th><th>Status</th><th>Payment</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.order_id}>
                    <td className="cell-main"><Link to={panel(`/admin/orders/${o.order_id}`)} className="table__strong row-link">{o.order_number}</Link></td>
                    <td data-label="Customer">{o.customer.full_name}<span className="table__sub hide-sm">{o.customer.email_id}</span></td>
                    <td className="hide-sm">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td data-label="Placed">{orderDate(o.created_at)}</td>
                    <td className="cell-aside"><StatusPill status={o.status} /></td>
                    <td data-label="Payment">{isPrepaid(o) ? 'Online' : 'COD'}<span className="table__sub">{paymentStatusLabel(o)}</span></td>
                    <td className="num" data-label="Total">{money(o.pricing.total)}{o.coupon && <span className="table__sub">{o.coupon.code}</span>}</td>
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
            Showing {(page - 1) * size + 1}–{(page - 1) * size + rows.length} of {total} {total === 1 ? 'order' : 'orders'}{dates && ` placed ${dates}`}
          </p>
          <nav className="admin-pager" aria-label="Pages">
            <button className="admin-button admin-button--ghost" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="admin-button admin-button--ghost" disabled={page >= pages} onClick={() => goToPage(page + 1)}>Next</button>
          </nav>
          <label className="orders-pager__size">
            <span>Orders per page</span>
            {/* A new size starts again from page 1. */}
            <select className="admin-input" value={size} onChange={(e) => set({ size: e.target.value === String(PAGE_SIZES[0]) ? null : e.target.value })}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}

      <Toast message={exportError} kind="error" onDone={() => setExportError(null)} />
    </>
  )
}

// Suggestions start after a few letters, a moment after typing stops.
const MIN_LETTERS = 3
const DELAY_MS = 200
const SUGGESTIONS = 6

type Results = { query: string; orders: AdminOrder[] }

/**
 * The orders search with a type-ahead list, like the customers one: the arrow keys move through the
 * list, Enter opens the highlighted order or searches for the text, Escape closes the list.
 */
function OrderSearch({ initial, onSearch }: { initial: string; onSearch: (term: string) => void }) {
  const navigate = useNavigate()
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
      getAdminOrders({ search: term, skip: 0, limit: SUGGESTIONS }, controller.signal)
        .then((r) => {
          setResults({ query: term, orders: r.orders })
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

  // The last answer is only shown for the exact text it was for.
  const current = ready && results !== null && results.query === term
  const suggestions = current ? results.orders : []
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
  const openOrder = (o: AdminOrder) => {
    close()
    navigate(panel(`/admin/orders/${o.order_id}`))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (showList && active >= 0 && active < suggestions.length) openOrder(suggestions[active])
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
      <label htmlFor="order-search" className="visually-hidden">Search orders</label>
      <input
        ref={inputRef}
        id="order-search"
        placeholder="Order number, customer name, email or mobile"
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
          {suggestions.map((o, i) => (
            <li
              key={o.order_id}
              id={rowId(i)}
              role="option"
              aria-selected={i === active}
              className="search-suggest__item search-suggest__item--plain"
              onClick={() => openOrder(o)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search-suggest__text">
                <span className="search-suggest__name">
                  <Highlight text={o.order_number} term={term} /> · <Highlight text={o.customer.full_name} term={term} />
                </span>
                <span className="search-suggest__meta">
                  <Highlight text={o.customer.email_id} term={term} />
                  {o.customer.mobile_number && <> · <Highlight text={o.customer.mobile_number} term={term} /></>}
                </span>
              </span>
              <span className="search-suggest__meta">{money(o.pricing.total)} · {STATUS_LABELS[o.status]}</span>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="search-suggest__empty" role="presentation">No orders match “{term}”.</li>
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
