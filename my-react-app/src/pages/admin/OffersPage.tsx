import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ErrorState, Loading } from '../../components/ui'
import { deleteOffer, getAdminCategories, getAdminOffers, getAdminProducts, setOfferStatus, type AdminOffer } from '../../lib/adminApi'
import { getAdminSession } from '../../lib/adminSession'
import { offerRule } from '../../lib/offers'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { DeleteIcon, EditIcon, OffersIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Switch, Toast } from './AdminUi'
import { DealMini } from './OfferDeal'
import { buySide, freeSide } from './offerSides'
import { panel } from '../../lib/panelPath'

export function OffersPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('offers')
  const adminId = getAdminSession()?.adminId ?? ''
  const arrivedWith = (useLocation().state as { toast?: string } | null)?.toast
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(arrivedWith ? { message: arrivedWith, kind: 'success' } : null)
  const [overrides, setOverrides] = useState<Record<string, AdminOffer | 'deleted'>>({})
  const offers = useFetch((signal) => getAdminOffers(signal), 'admin-offers')
  // Only for the pictures in each deal; the list still works without them.
  const products = useFetch((signal) => getAdminProducts(adminId, undefined, 0, 100, signal), 'offer-products')
  const categories = useFetch((signal) => getAdminCategories(signal), 'admin-cats')

  const rows = (offers.data ?? [])
    .map((o) => overrides[o.offer_id] ?? o)
    .filter((o): o is AdminOffer => o !== 'deleted')
  const on = rows.filter((o) => o.status).length

  const toggle = async (o: AdminOffer, status: boolean) => {
    try {
      const res = await setOfferStatus(o.offer_id, status)
      setOverrides((m) => ({ ...m, [o.offer_id]: res.offer }))
      setToast({ message: `${o.title} is ${status ? 'on' : 'off'}.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const remove = async (o: AdminOffer) => {
    try {
      await deleteOffer(o.offer_id)
      setOverrides((m) => ({ ...m, [o.offer_id]: 'deleted' }))
      setToast({ message: `${o.title} was deleted.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  return (
    <>
      <AdminPageHead
        title="Offers"
        subtitle={rows.length
          ? `${on} of ${rows.length} on. Shoppers get the free items at checkout by themselves.`
          : 'Buy something, get something free. Offers apply at checkout by themselves.'}
        actions={can.create ? <Link to={panel('/admin/offers/new')} className="admin-button">New offer</Link> : undefined}
      />

      {offers.loading && !offers.data ? (
        <Loading />
      ) : offers.error ? (
        <ErrorState message={offers.error.message} onRetry={offers.reload} />
      ) : rows.length === 0 ? (
        <div className="panel empty-panel">
          <span className="empty-panel__icon"><OffersIcon size={28} /></span>
          <h2>No offers yet</h2>
          <p>Make one like “Buy 2 Honey, get 1 free”. Shoppers see it on the product and get the free item in their order.</p>
          {can.create && <Link to={panel('/admin/offers/new')} className="admin-button">New offer</Link>}
        </div>
      ) : (
        <ul className="offer-list panel">
          {rows.map((o) => {
            const buy = buySide(o, products.data ?? [], categories.data ?? [])
            return (
              <li key={o.offer_id} className={`offer-row${o.status ? '' : ' is-off'}`}>
                <Link to={panel(`/admin/offers/${o.offer_id}/edit`)} className="offer-row__main" aria-disabled={!can.edit || undefined}
                  onClick={(e) => { if (!can.edit) e.preventDefault() }}>
                  <DealMini buy={buy} free={freeSide(o, buy, products.data ?? [])} buyQuantity={o.buy_quantity} getQuantity={o.get_quantity} />
                  <span className="offer-row__text">
                    <strong>{o.title}</strong>
                    <span>{offerRule(o)}{buy ? `, on ${buy.name}` : ''}</span>
                  </span>
                </Link>
                <div className="switch-row offer-row__switch">
                  <Switch checked={o.status} onChange={(v) => toggle(o, v)} label={`${o.title} is on`} disabled={!can.edit} />
                  <span>{o.status ? 'On' : 'Off'}</span>
                </div>
                <div className="offer-row__actions">
                  {can.edit && <Link to={panel(`/admin/offers/${o.offer_id}/edit`)} className="admin-icon-button" aria-label={`Edit ${o.title}`} title="Edit"><EditIcon /></Link>}
                  {can.delete && <ConfirmButton label={`Delete ${o.title}`} icon={<DeleteIcon />} onConfirm={() => remove(o)} confirm={{
                    title: `Delete ${o.title}?`,
                    message: <p>Shoppers stop getting its free items. Past orders keep theirs. To pause it instead, switch it off.</p>,
                    confirmLabel: 'Delete offer',
                  }} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}
