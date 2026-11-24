import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorState, Loading } from '../../components/ui'
import {
  deleteEnquiries, deleteEnquiry, ENQUIRIES_CHANGED_EVENT, getAdminEnquiries, markEnquiryRead,
  type AdminEnquiry, type EnquiryStatus,
} from '../../lib/adminApi'
import { orderDate, plural } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { AdminPageHead, ConfirmButton, Toast } from './AdminUi'
import { ChevronDownIcon, DeleteIcon, EnquiriesIcon, MailIcon, PhoneIcon } from './AdminIcons'

// Enquiries per page.
const PAGE = 10
const TABS: [EnquiryStatus, string][] = [['all', 'All'], ['unread', 'Unread'], ['read', 'Read']]

const EMPTY: Record<EnquiryStatus, string> = {
  all: 'No enquiries yet. They appear here as soon as someone sends the Bulk orders form.',
  unread: 'No unread enquiries. You’re all caught up.',
  read: 'No enquiries marked as read yet.',
}

// The menu's red number is asked again after anything here changes it.
const badgeChanged = () => window.dispatchEvent(new Event(ENQUIRIES_CHANGED_EVENT))

// The backend sends UTC without a timezone suffix (as orderDate in lib/format.ts reads it).
const parseUtc = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)

/** The day it came in: "Today, 3:45 pm", "Yesterday, 9:10 am", or "19 Oct 2026" for anything older. */
function dayLabel(iso: string): string {
  const date = parseUtc(iso)
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

/** Page buttons: the first, the last, and two either side of the current one, with "…" between. */
function pageNumbers(page: number, pages: number): (number | '…')[] {
  const out: (number | '…')[] = []
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) out.push(n)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  return out
}

export function EnquiriesPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('enquiries')
  const [params, setParams] = useSearchParams()
  const status: EnquiryStatus = TABS.some(([s]) => s === params.get('filter')) ? (params.get('filter') as EnquiryStatus) : 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const enquiries = useFetch(
    (signal) => getAdminEnquiries({ status, page, limit: PAGE }, signal),
    `admin-enquiries|${status}|${page}`,
  )
  // Ticked enquiries, only ever on the page on screen: a new page or tab starts with none.
  const listKey = `${status}|${page}`
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: listKey, ids: new Set() })
  // Enquiries opened on this page (several can be open at once); a new page or tab starts closed.
  const [expanded, setExpanded] = useState<{ key: string; ids: Set<string> }>({ key: listKey, ids: new Set() })
  // Opened since the list loaded: shown as read straight away, without reloading the list
  // (so an enquiry opened in the Unread tab doesn't vanish while it's being read).
  const [justRead, setJustRead] = useState<{ data: unknown; ids: Set<string> }>({ data: null, ids: new Set() })
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)

  const readNow = justRead.data === enquiries.data ? justRead.ids : new Set<string>()
  const rows = (enquiries.data?.data ?? []).map((e) => (readNow.has(e.enqury_id) ? { ...e, is_opened: true } : e))
  const loadedCounts = enquiries.data?.counts
  // The tab numbers, moved along for the enquiries read since loading.
  const counts = loadedCounts && { ...loadedCounts, unread: loadedCounts.unread - readNow.size, read: loadedCounts.read + readNow.size }
  const isOpen = (id: string) => expanded.key === listKey && expanded.ids.has(id)
  const total = enquiries.data?.pagination.total_enquiries ?? 0
  const pages = enquiries.data?.pagination.total_pages ?? 0
  const selected = selection.key === listKey ? new Set([...selection.ids].filter((id) => rows.some((e) => e.enqury_id === id))) : new Set<string>()

  const go = (changes: { filter?: EnquiryStatus; page?: number }, replace = false) => {
    const next = new URLSearchParams(params)
    const f = changes.filter ?? status
    const p = changes.page ?? (changes.filter ? 1 : page)
    if (f !== 'all') next.set('filter', f)
    else next.delete('filter')
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    setParams(next, { replace })
  }

  // A page past the end (the last one emptied by a delete, or an old link): show the last page there is.
  useEffect(() => {
    if (enquiries.data && page > Math.max(1, pages)) go({ page: Math.max(1, pages) }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiries.data, page, pages])

  const goToPage = (n: number) => {
    go({ page: n })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggle = (id: string) => {
    const ids = new Set(selected)
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    setSelection({ key: listKey, ids })
  }
  const allChecked = rows.length > 0 && rows.every((e) => selected.has(e.enqury_id))
  const clearSelection = () => setSelection({ key: listKey, ids: new Set() })

  // Opening an unread enquiry marks it as opened, for the owner and for managers allowed to edit
  // enquiries (view-only managers can read it, but it stays unread for the others).
  const toggleOpen = async (e: AdminEnquiry) => {
    const ids = new Set(expanded.key === listKey ? expanded.ids : [])
    const opening = !ids.has(e.enqury_id)
    if (opening) ids.add(e.enqury_id)
    else ids.delete(e.enqury_id)
    setExpanded({ key: listKey, ids })
    if (!opening || e.is_opened || !can.edit) return
    const data = enquiries.data
    setJustRead({ data, ids: new Set(readNow).add(e.enqury_id) })
    try {
      await markEnquiryRead(e.enqury_id)
      badgeChanged()
    } catch (err) {
      // Not saved: show it as unread again.
      setJustRead((r) => {
        if (r.data !== data) return r
        const back = new Set(r.ids)
        back.delete(e.enqury_id)
        return { data, ids: back }
      })
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  // After a delete the page is loaded again, so the tab numbers and pages stay right.

  const remove = async (e: AdminEnquiry) => {
    try {
      await deleteEnquiry(e.enqury_id)
      setToast({ message: `${e.name}'s enquiry was deleted.`, kind: 'success' })
      enquiries.reload()
      badgeChanged()
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const removeSelected = async () => {
    try {
      const res = await deleteEnquiries([...selected])
      clearSelection()
      setToast({ message: `${plural(res.deleted_count, 'enquiry', 'enquiries')} deleted.`, kind: 'success' })
      enquiries.reload()
      badgeChanged()
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  return (
    <>
      <AdminPageHead
        title="Bulk order enquiries"
        subtitle="Requests sent from the shop's Bulk orders page. Open one to see the details; it's marked as read."
      />

      <div className="toolbar enquiry-toolbar">
        <div className="segmented" role="group" aria-label="Filter enquiries">
          {TABS.map(([value, label]) => (
            <button key={value} aria-pressed={status === value} onClick={() => go({ filter: value })}>
              {label}
              {counts && <span className={`enquiry-tab__count${value === 'unread' && counts.unread > 0 ? ' is-unread' : ''}`}>{counts[value]}</span>}
            </button>
          ))}
        </div>

        {can.delete && rows.length > 0 && (
          <div className="enquiry-select">
            <label className="enquiry-select__all">
              <input type="checkbox" checked={allChecked}
                onChange={() => setSelection({ key: listKey, ids: allChecked ? new Set() : new Set(rows.map((e) => e.enqury_id)) })} />
              <span>{selected.size > 0 ? `${selected.size} selected` : 'Select all on this page'}</span>
            </label>
            {selected.size > 0 && (
              <>
                <ConfirmButton
                  label={`Delete ${selected.size} selected`}
                  confirm={{
                    title: `Delete ${plural(selected.size, 'enquiry', 'enquiries')}?`,
                    message: <p>{selected.size === 1 ? 'The enquiry is' : `All ${selected.size} enquiries are`} removed for good. This can't be undone.</p>,
                    confirmLabel: selected.size === 1 ? 'Delete enquiry' : `Delete ${selected.size} enquiries`,
                  }}
                  className="admin-button admin-button--danger-ghost"
                  onConfirm={removeSelected}
                />
                <button className="text-button" onClick={clearSelection}>Clear</button>
              </>
            )}
          </div>
        )}
      </div>

      {enquiries.loading && !enquiries.data ? (
        <Loading />
      ) : enquiries.error ? (
        <ErrorState message={enquiries.error.message} onRetry={enquiries.reload} />
      ) : rows.length === 0 ? (
        <div className="panel empty-panel">
          <span className="empty-panel__icon"><EnquiriesIcon size={26} /></span>
          <p>{EMPTY[status]}</p>
        </div>
      ) : (
        <ul className={`enquiry-list${enquiries.loading ? ' is-loading' : ''}`} aria-busy={enquiries.loading || undefined}>
          {rows.map((e) => {
            const open = isOpen(e.enqury_id)
            const bodyId = `enquiry-${e.enqury_id}`
            return (
              <li key={e.enqury_id} className={`enquiry-card${e.is_opened ? '' : ' is-unread'}${open ? ' is-open' : ''}${selected.has(e.enqury_id) ? ' is-selected' : ''}`}>
                <div className="enquiry-card__head">
                  {can.delete && (
                    <input type="checkbox" className="enquiry-card__check" aria-label={`Select ${e.name}'s enquiry`}
                      checked={selected.has(e.enqury_id)} onChange={() => toggle(e.enqury_id)} />
                  )}
                  <button type="button" className="enquiry-card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => toggleOpen(e)}>
                    <span className="enquiry-card__avatar" aria-hidden>{initials(e.name)}</span>
                    <span className="enquiry-card__who">
                      <strong className="enquiry-card__name">{e.name}</strong>
                      <time className="enquiry-card__day" dateTime={e.created_at} title={orderDate(e.created_at)}>{dayLabel(e.created_at)}</time>
                    </span>
                    <span className={`enquiry-card__status${e.is_opened ? '' : ' is-unread'}`}>{e.is_opened ? 'Read' : 'New'}</span>
                    <span className="enquiry-card__chevron"><ChevronDownIcon /></span>
                    <span className="visually-hidden">{open ? 'Close enquiry' : 'Open enquiry'}</span>
                  </button>
                </div>

                {open && (
                  <div id={bodyId} className="enquiry-card__body">
                    <div className="enquiry-card__contact">
                      <span className="enquiry-card__subject">{e.subject}</span>
                      <a href={`mailto:${e.email_id}`}><MailIcon size={16} />{e.email_id}</a>
                      <a href={`tel:${e.mobile_number}`}><PhoneIcon size={16} />{e.mobile_number}</a>
                    </div>

                    <p className={`enquiry-card__message${e.comments ? '' : ' is-empty'}`}>{e.comments || 'No message added.'}</p>

                    <div className="enquiry-card__actions">
                      <span className="enquiry-card__received">Received {orderDate(e.created_at)}</span>
                      {can.delete && (
                        <ConfirmButton
                          label={`Delete ${e.name}'s enquiry`}
                          icon={<DeleteIcon />}
                          confirm={{
                            title: 'Delete this enquiry?',
                            message: <p>{e.name}'s enquiry is removed for good. This can't be undone.</p>,
                            confirmLabel: 'Delete enquiry',
                          }}
                          onConfirm={() => remove(e)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {total > 0 && rows.length > 0 && (
        <div className="orders-pager">
          <p className="orders-pager__showing">
            Showing {(page - 1) * PAGE + 1}–{(page - 1) * PAGE + rows.length} of {plural(total, 'enquiry', 'enquiries')}
          </p>
          {pages > 1 && (
            <nav className="admin-pager enquiry-pager" aria-label="Pages">
              <button className="admin-button admin-button--ghost" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
              {pageNumbers(page, pages).map((n, i) => n === '…' ? (
                <span key={`gap-${i}`} className="enquiry-pager__gap" aria-hidden>…</span>
              ) : (
                <button key={n} className={`enquiry-pager__num${n === page ? ' is-current' : ''}`}
                  aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => goToPage(n)}>
                  {n}
                </button>
              ))}
              <button className="admin-button admin-button--ghost" disabled={page >= pages} onClick={() => goToPage(page + 1)}>Next</button>
            </nav>
          )}
        </div>
      )}

      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}
