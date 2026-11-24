import { useState, type FormEvent } from 'react'
import { bookCourier, getShipmentLabel, getSuggestedBox, type AdminOrder, type ShipmentBox } from '../../lib/adminApi'
import { LockIcon } from '../../components/Icons'
import { awaitsPayment, trackingUrl } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { Panel } from './AdminUi'

type ToastFn = (toast: { message: string; kind: 'success' | 'error' }) => void

// Orders the courier can be booked for (same as the backend): confirmed, or packed when a
// booking stopped halfway.
const BOOKABLE = ['confirmed', 'packed']
const FIELDS: { key: keyof ShipmentBox; label: string; step: string }[] = [
  { key: 'length_cm', label: 'Length (cm)', step: '0.1' },
  { key: 'breadth_cm', label: 'Breadth (cm)', step: '0.1' },
  { key: 'height_cm', label: 'Height (cm)', step: '0.1' },
  { key: 'weight_kg', label: 'Weight (kg)', step: '0.01' },
]

/**
 * Shipping with Shiprocket. Once the parcel is packed, one button creates the Shiprocket order,
 * books the courier, schedules the pickup and makes the label. With shipping handed over to Shiprocket
 * (courierDrivesStatus, the default) the courier's updates then move the order to shipped, out for
 * delivery and delivered by themselves; otherwise the admin does.
 */
export function ShipmentPanel({ order, onUpdated, onToast, courierDrivesStatus = true }: {
  order: AdminOrder
  onUpdated: (order: AdminOrder) => void
  onToast: ToastFn
  courierDrivesStatus?: boolean
}) {
  const shipment = order.shipment ?? null
  const booked = !!shipment?.pickup_scheduled_at
  // Booking a courier (and fetching its label) changes the order: managers need "edit" on orders.
  const canEdit = useCan('orders').edit
  const canBook = canEdit && !booked && BOOKABLE.includes(order.status)
  const tracking = order.tracking

  // Not paid yet: the courier can't be booked until it is, so the button shows locked.
  if (awaitsPayment(order) && canEdit) {
    return (
      <Panel title="Shipping">
        <p className="admin-hint">Book the courier once the order is paid online or switched to cash on delivery.</p>
        <button type="button" className="admin-button shipment-book" disabled title="Locked until the order is paid">
          <LockIcon size={16} /> Packed: book courier
        </button>
      </Panel>
    )
  }

  if (!booked && !canBook && !tracking?.awb && !shipment?.cancel_failed) return null

  return (
    <Panel title="Shipping">
      {shipment?.cancel_failed && (
        <p className="admin-callout">
          The order was cancelled here, but Shiprocket couldn't cancel its shipment. Cancel order {shipment.sr_order_id} in
          the <a href="https://app.shiprocket.in/" target="_blank" rel="noreferrer">Shiprocket panel</a> so the courier
          charge goes back to your wallet.
        </p>
      )}
      {shipment?.cancelled_at && <p className="admin-hint">The Shiprocket shipment was cancelled.</p>}

      {booked && shipment ? (
        <Booked order={order} onUpdated={onUpdated} onToast={onToast} canEdit={canEdit} courierDrivesStatus={courierDrivesStatus} />
      ) : canBook ? (
        <BookCourier order={order} onUpdated={onUpdated} onToast={onToast} />
      ) : null}

      {tracking?.awb && booked && (
        <a className="admin-button admin-button--ghost shipment-track" href={trackingUrl(tracking.awb)} target="_blank" rel="noreferrer">Track parcel</a>
      )}
    </Panel>
  )
}

function Booked({ order, onUpdated, onToast, canEdit, courierDrivesStatus }: {
  order: AdminOrder
  onUpdated: (order: AdminOrder) => void
  onToast: ToastFn
  canEdit: boolean
  courierDrivesStatus: boolean
}) {
  const shipment = order.shipment!
  const tracking = order.tracking
  const [fetching, setFetching] = useState(false)

  // The label may not have been ready at booking time; fetch it now.
  const fetchLabel = async () => {
    setFetching(true)
    try {
      const { label_url } = await getShipmentLabel(order.order_id)
      onUpdated({ ...order, shipment: { ...shipment, label_url } })
      window.open(label_url, '_blank', 'noopener')
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="shipment-info">
      <p className="shipment-info__ok">Courier booked, pickup scheduled</p>
      <dl className="shipment-info__facts">
        <div><dt>Courier</dt><dd>{tracking?.courier_name ?? shipment.courier_name ?? '—'}</dd></div>
        <div><dt>AWB</dt><dd>{shipment.awb}</dd></div>
        {shipment.pickup_date && <div><dt>Pickup</dt><dd>{shipment.pickup_date}</dd></div>}
        {tracking?.status && <div><dt>Latest</dt><dd>{tracking.status}{tracking.status_at && tracking.status !== 'Pickup scheduled' ? `, ${tracking.status_at}` : ''}</dd></div>}
        {tracking?.etd && <div><dt>Expected</dt><dd>{tracking.etd}</dd></div>}
        {shipment.box && <div><dt>Box</dt><dd>{shipment.box.length_cm} × {shipment.box.breadth_cm} × {shipment.box.height_cm} cm, {shipment.box.weight_kg} kg</dd></div>}
      </dl>
      {shipment.label_url ? (
        <a className="admin-button" href={shipment.label_url} target="_blank" rel="noreferrer">Print label</a>
      ) : canEdit ? (
        <button type="button" className="admin-button" onClick={fetchLabel} disabled={fetching}>{fetching ? 'Getting label…' : 'Get label'}</button>
      ) : null}
      <p className="admin-hint admin-hint--tight">
        Stick the label on the parcel and hand it to the courier at pickup.{' '}
        {courierDrivesStatus ? 'Shiprocket then moves the order on by itself.' : 'Then mark the order shipped, and delivered when it arrives.'}
      </p>
    </div>
  )
}

function BookCourier({ order, onUpdated, onToast }: { order: AdminOrder; onUpdated: (order: AdminOrder) => void; onToast: ToastFn }) {
  const suggested = useFetch((signal) => getSuggestedBox(order.order_id, signal), `suggested-box|${order.order_id}`)
  const [box, setBox] = useState<Record<keyof ShipmentBox, string> | null>(null)
  const [busy, setBusy] = useState(false)
  const halfway = order.shipment?.awb

  // The suggestion fills the fields once; after that they're the admin's.
  const values = box ?? (suggested.data
    ? Object.fromEntries(FIELDS.map((f) => [f.key, String(suggested.data?.[f.key] ?? '')])) as Record<keyof ShipmentBox, string>
    : null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!values) return
    const numbers = Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])) as ShipmentBox
    if (FIELDS.some((f) => !(numbers[f.key] > 0))) {
      onToast({ message: 'Enter the box size and weight, all above zero.', kind: 'error' })
      return
    }
    setBusy(true)
    try {
      const res = await bookCourier(order.order_id, numbers)
      onUpdated(res.order)
      onToast({ message: `Courier booked for ${order.order_number}. Print the label and keep the parcel ready for pickup.`, kind: 'success' })
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {halfway ? (
        <p className="admin-callout">The courier is booked (AWB {order.shipment?.awb}) but the pickup isn't scheduled yet. Press the button again to finish; the courier won't be booked twice.</p>
      ) : (
        <p className="admin-hint">Pack the order, enter the box, and book. This books the courier (charged to your Shiprocket wallet), schedules the pickup and makes the label.</p>
      )}
      {suggested.error ? (
        <p className="admin-hint">Couldn't load a suggested size. <button type="button" className="settings-link" onClick={suggested.reload}>Try again</button></p>
      ) : (
        <div className="shipment-box">
          {FIELDS.map((f) => (
            <label key={f.key} className="admin-field">
              <span className="admin-label">{f.label}</span>
              <input className="admin-input" type="number" inputMode="decimal" min="0" step={f.step} required disabled={!values || busy || !!halfway}
                value={values?.[f.key] ?? ''}
                onChange={(e) => setBox({ ...(values as Record<keyof ShipmentBox, string>), [f.key]: e.target.value })} />
            </label>
          ))}
        </div>
      )}
      <button type="submit" className="admin-button shipment-book" disabled={!values || busy}>
        {busy ? 'Booking courier…' : halfway ? 'Finish booking' : 'Packed: book courier'}
      </button>
    </form>
  )
}
