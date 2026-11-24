import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ErrorState, Loading } from '../../components/ui'
import { deleteCoupon, getCoupons, updateCoupon, type Coupon } from '../../lib/adminApi'
import { discountText, money, orderDate, plural } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { DeleteIcon, EditIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Switch, Toast } from './AdminUi'
import { panel } from '../../lib/panelPath'

const STATE_LABELS: Record<Coupon['state'], string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  redeemed: 'Used',
  disabled: 'Off',
}

export function CouponsPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('coupons')
  const [params, setParams] = useSearchParams()
  const usage = params.get('usage') ?? ''
  const arrivedWith = (useLocation().state as { toast?: string } | null)?.toast
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(arrivedWith ? { message: arrivedWith, kind: 'success' } : null)
  const [overrides, setOverrides] = useState<Record<string, Coupon | 'deleted'>>({})
  const coupons = useFetch((signal) => getCoupons({ usage_type: usage || undefined, skip: 0, limit: 100 }, signal), `admin-coupons|${usage}`)

  const rows = (coupons.data ?? [])
    .filter((c) => overrides[c.coupon_id] !== 'deleted')
    .map((c) => (overrides[c.coupon_id] as Coupon | undefined) ?? c)

  const toggle = async (c: Coupon, status: boolean) => {
    try {
      const res = await updateCoupon(c.coupon_id, { status })
      setOverrides((o) => ({ ...o, [c.coupon_id]: res.coupon }))
      setToast({ message: `${c.code} is ${status ? 'switched on' : 'switched off'}.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const remove = async (c: Coupon) => {
    try {
      await deleteCoupon(c.coupon_id)
      setOverrides((o) => ({ ...o, [c.coupon_id]: 'deleted' }))
      setToast({ message: `${c.code} was deleted.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  return (
    <>
      <AdminPageHead
        title="Coupons"
        subtitle="Discount codes shoppers enter at checkout."
        actions={can.create ? <Link to={panel('/admin/coupons/new')} className="admin-button">Create coupon</Link> : undefined}
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Usage type">
          {[['', 'All'], ['multi_use', 'Reusable'], ['single_use', 'One-time']].map(([value, label]) => (
            <button key={value} aria-pressed={usage === value} onClick={() => setParams(value ? { usage: value } : {})}>{label}</button>
          ))}
        </div>
      </div>

      {coupons.loading && !coupons.data ? (
        <Loading />
      ) : coupons.error ? (
        <ErrorState message={coupons.error.message} onRetry={coupons.reload} />
      ) : rows.length === 0 ? (
        <div className="panel panel__empty">No coupons yet.{can.create && <> <Link to={panel('/admin/coupons/new')}>Create your first coupon</Link>.</>}</div>
      ) : (
        <div className="panel panel--flush">
          <div className="table-wrap">
            <table className="table table--cards">
              <thead><tr><th>Code</th><th>Discount</th><th>Type</th><th>Used</th><th>State</th><th>On</th><th className="table__actions"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.coupon_id} className={c.status ? '' : 'is-muted'}>
                    <td className="cell-main">
                      {can.edit ? <Link to={panel(`/admin/coupons/${c.coupon_id}/edit`)} className="coupon-code">{c.code}</Link> : <span className="coupon-code">{c.code}</span>}
                      {c.description && <span className="table__sub">{c.description}</span>}
                    </td>
                    <td data-label="Discount">
                      {discountText(c)}
                      {(c.min_subtotal || c.applies_to !== 'all') && (
                        <span className="table__sub">
                          {c.applies_to !== 'all' && `Only ${
                            c.applies_to === 'products' ? plural(c.product_ids.length, 'product')
                            : c.applies_to === 'sub_categories' ? plural((c.sub_categories ?? []).length, 'sub-category', 'sub-categories')
                            : plural(c.category_ids.length, 'category', 'categories')}`}
                          {c.applies_to !== 'all' && c.min_subtotal ? ', ' : ''}
                          {c.min_subtotal ? `min ${money(c.min_subtotal)}` : ''}
                        </span>
                      )}
                    </td>
                    <td data-label="Type">{c.usage_type === 'single_use' ? 'One-time' : 'Reusable'}</td>
                    <td data-label="Used">
                      {c.usage_type === 'single_use' && c.redeemed_by ? (
                        <>{c.redeemed_by.order_number}<span className="table__sub">{orderDate(c.redeemed_by.redeemed_at)}</span></>
                      ) : (
                        `${c.used_count} ${c.used_count === 1 ? 'order' : 'orders'}`
                      )}
                    </td>
                    <td className="cell-aside"><span className={`coupon-state coupon-state--${c.state}`}>{STATE_LABELS[c.state]}</span></td>
                    <td data-label="On"><Switch checked={c.status} onChange={(v) => toggle(c, v)} label={`Switch ${c.code} on`} disabled={!can.edit} /></td>
                    <td className="table__actions">
                      {can.edit && <Link to={panel(`/admin/coupons/${c.coupon_id}/edit`)} className="admin-icon-button" aria-label={`Edit ${c.code}`} title="Edit"><EditIcon /></Link>}
                      {can.delete && <ConfirmButton label={`Delete ${c.code}`} icon={<DeleteIcon />} onConfirm={() => remove(c)} confirm={{
                        title: `Delete coupon ${c.code}?`,
                        message: <p>Shoppers can't use this code any more. To pause it instead, switch it off. This can't be undone.</p>,
                        confirmLabel: 'Delete coupon',
                      }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}
