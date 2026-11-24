import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Stars } from '../../components/Stars'
import { ErrorState, Loading } from '../../components/ui'
import {
  getAdminReviews, markReviewsSeen, replyToReview, REVIEWS_SEEN_EVENT, setReviewApproval,
  type AdminReview, type ReviewApproval,
} from '../../lib/adminApi'
import { orderDate } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { AdminPageHead, Modal, Toast } from './AdminUi'

const PAGE = 20
// "Pending approval" first: new reviews stay hidden from shoppers until they're approved here.
const TABS = [
  ['', 'All'],
  ['pending', 'Pending approval'],
  ['waiting', 'Waiting for reply'],
  ['replied', 'Replied'],
  ['rejected', 'Rejected'],
] as const

const FILTERS: Record<string, { approval?: ReviewApproval; replied?: boolean }> = {
  pending: { approval: 'Pending' },
  // Only approved reviews can be replied to, so "waiting" means approved without a reply.
  waiting: { approval: 'Approved', replied: false },
  replied: { approval: 'Approved', replied: true },
  rejected: { approval: 'Reject' },
}

const EMPTY: Record<string, string> = {
  pending: 'No reviews waiting for approval.',
  waiting: 'Every approved review has a reply.',
  replied: 'No replies yet.',
  rejected: 'No rejected reviews.',
}

const APPROVAL_LABELS: Record<ReviewApproval, string> = { Pending: 'Pending approval', Approved: 'Approved', Reject: 'Rejected' }

export function ReviewsPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('reviews')
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const reviews = useFetch(
    (signal) => getAdminReviews({ ...FILTERS[filter], skip: (page - 1) * PAGE, limit: PAGE }, signal),
    `admin-reviews|${filter}|${page}`,
  )
  // Replies saved on this page, shown without reloading the list.
  const [updated, setUpdated] = useState<Record<string, AdminReview>>({})
  const [replyingTo, setReplyingTo] = useState<AdminReview | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)
  // The review whose approval is being saved, so only its buttons wait.
  const [deciding, setDeciding] = useState<string | null>(null)

  const decide = async (review: AdminReview, approval: ReviewApproval) => {
    setDeciding(review.review_id)
    try {
      const res = await setReviewApproval(review.review_id, approval)
      setUpdated((u) => ({ ...u, [review.review_id]: { ...review, ...res.review } }))
      setToast({
        message: approval === 'Approved' ? 'Review approved. Shoppers can now see it, and you can reply.'
          : approval === 'Reject' ? 'Review rejected. It stays hidden from shoppers.'
          : 'Review set back to pending.',
        kind: 'success',
      })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setDeciding(null)
    }
  }

  // Once the list has loaded (with its "New" tags), everything so far counts as seen.
  const loaded = !!reviews.data
  useEffect(() => {
    if (!loaded) return
    markReviewsSeen().then(() => window.dispatchEvent(new Event(REVIEWS_SEEN_EVENT))).catch(() => {})
  }, [loaded])

  const rows = (reviews.data?.reviews ?? []).map((r) => updated[r.review_id] ?? r)
  const total = reviews.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))

  const setPage = (n: number) => {
    const next = new URLSearchParams(params)
    if (n > 1) next.set('page', String(n))
    else next.delete('page')
    setParams(next)
  }

  return (
    <>
      <AdminPageHead title="Reviews" subtitle="Approve reviews to show them on your product pages, then reply to thank shoppers or answer a question." />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter reviews">
          {TABS.map(([value, label]) => (
            <button key={value} aria-pressed={filter === value} onClick={() => setParams(value ? { filter: value } : {})}>{label}</button>
          ))}
        </div>
      </div>

      {reviews.loading && !reviews.data ? (
        <Loading />
      ) : reviews.error ? (
        <ErrorState message={reviews.error.message} onRetry={reviews.reload} />
      ) : rows.length === 0 ? (
        <div className="panel panel__empty">
          {EMPTY[filter] ?? 'No reviews yet. They appear here as soon as shoppers post them.'}
        </div>
      ) : (
        <ul className="admin-reviews">
          {rows.map((r) => {
            const approved = r.admin_approvel === 'Approved'
            const busy = deciding === r.review_id
            return (
            <li key={r.review_id} className={`panel admin-review admin-review--${r.admin_approvel.toLowerCase()}${r.is_new ? ' is-new' : ''}`}>
              <div className="admin-review__head">
                <Stars value={r.rating_score} size={16} />
                <strong className="admin-review__title">{r.review_title}</strong>
                {r.is_new && <span className="admin-review__new">New</span>}
                <span className="admin-review__states">
                  <span className={`admin-review__approval is-${r.admin_approvel.toLowerCase()}`}>{APPROVAL_LABELS[r.admin_approvel]}</span>
                  {approved && <span className={`admin-review__state${r.admin_reply ? ' is-replied' : ''}`}>{r.admin_reply ? 'Replied' : 'Waiting for reply'}</span>}
                </span>
              </div>
              <p className="admin-review__meta">
                {r.product_name ? <Link to={`/product/${r.product_id}`} target="_blank" rel="noreferrer">{r.product_name}</Link> : 'Deleted product'}
                <span aria-hidden> · </span>
                {r.display_name} (<a href={`mailto:${r.email_id}`}>{r.email_id}</a>)
                <span aria-hidden> · </span>
                {orderDate(r.created_at)}
              </p>
              <p className="admin-review__content">{r.review_content}</p>
              {r.images_urls.length > 0 && (
                <div className="admin-review__images">
                  {r.images_urls.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" aria-label={`Open photo ${i + 1}`}><img src={src} alt="" loading="lazy" /></a>
                  ))}
                </div>
              )}
              {r.admin_reply && (
                <div className="admin-review__reply">
                  <span className="admin-review__reply-label">Your reply · {orderDate(r.admin_reply.replied_at)}</span>
                  <p>{r.admin_reply.reply_content}</p>
                </div>
              )}
              {can.edit && <div className="admin-review__actions">
                {r.admin_approvel === 'Pending' && (
                  <>
                    <button className="admin-button" disabled={busy} onClick={() => decide(r, 'Approved')}>{busy ? 'Saving…' : 'Approve'}</button>
                    <button className="admin-button admin-button--danger-ghost" disabled={busy} onClick={() => decide(r, 'Reject')}>Reject</button>
                  </>
                )}
                {approved && (
                  <>
                    <button className={`admin-button${r.admin_reply ? ' admin-button--ghost' : ''}`} disabled={busy} onClick={() => setReplyingTo(r)}>
                      {r.admin_reply ? 'Edit reply' : 'Reply'}
                    </button>
                    <button className="admin-button admin-button--danger-ghost" disabled={busy} onClick={() => decide(r, 'Reject')}>
                      {busy ? 'Saving…' : 'Hide review'}
                    </button>
                  </>
                )}
                {r.admin_approvel === 'Reject' && (
                  <button className="admin-button admin-button--ghost" disabled={busy} onClick={() => decide(r, 'Approved')}>
                    {busy ? 'Saving…' : 'Approve after all'}
                  </button>
                )}
                {!approved && <span className="admin-review__hint">Approve this review to reply to it.</span>}
              </div>}
            </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="admin-pager" aria-label="Pages">
          <button className="admin-button admin-button--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="admin-button admin-button--ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}

      {replyingTo && (
        <ReplyModal
          // key: opening another review starts with that review's reply.
          key={replyingTo.review_id}
          review={replyingTo}
          onClose={() => setReplyingTo(null)}
          onSaved={(r) => {
            setUpdated((u) => ({ ...u, [r.review_id]: r }))
            setReplyingTo(null)
            setToast({ message: 'Reply posted. Shoppers can see it under the review.', kind: 'success' })
          }}
        />
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

function ReplyModal({ review, onClose, onSaved }: { review: AdminReview; onClose: () => void; onSaved: (r: AdminReview) => void }) {
  const [text, setText] = useState(review.admin_reply?.reply_content ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!text.trim()) {
      setError('Write a reply first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await replyToReview(review.review_id, text.trim())
      onSaved({ ...review, ...res.review })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={review.admin_reply ? 'Edit your reply' : 'Reply to review'}
      subtitle={<>{review.display_name} on {review.product_name ?? 'a deleted product'}</>}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="admin-button" onClick={save} disabled={busy}>{busy ? 'Posting…' : 'Post reply'}</button>
        </>
      }
    >
      <blockquote className="admin-review__quote">
        <Stars value={review.rating_score} size={14} />
        <strong>{review.review_title}</strong>
        <p>{review.review_content}</p>
      </blockquote>
      <div className="admin-field">
        <label htmlFor="reply-text" className="admin-label">Your reply (shown publicly under the review)</label>
        <textarea id="reply-text" className="admin-input" rows={5} maxLength={2000} value={text} autoFocus
          onChange={(e) => setText(e.target.value)} aria-invalid={!!error} />
        {error && <p className="field__error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
