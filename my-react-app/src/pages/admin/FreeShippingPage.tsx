import { useState, type FormEvent } from 'react'
import { ErrorState, Loading } from '../../components/ui'
import {
  checkFreeShipping, createFreeShippingRange, deleteFreeShippingRange, getFreeShippingRanges, getFreeShippingThreshold,
  setFreeShippingStatus, updateFreeShippingRange, updateFreeShippingThreshold, type FreeShippingInput, type FreeShippingRange,
  type FreeShippingThreshold, deleteFreeShippingThreshold,
} from '../../lib/adminApi'
import { money, plural } from '../../lib/format'
import { COUNTRIES, DEFAULT_COUNTRY, STATES_BY_COUNTRY, matchState } from '../../lib/addresses'
import type { CountryName } from '../../lib/types'
import { useAdminAccess, useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { ChevronDownIcon, DeleteIcon, EditIcon, FreeShippingIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Modal, Switch, Toast } from './AdminUi'

type PopupState = { mode: 'create' } | { mode: 'edit'; range: FreeShippingRange } | null
type ToastState = { message: string; kind: 'success' | 'error' } | null

const PINCODE = /^[1-9]\d{5}$/

// "500001" for a single PIN code, "500001 – 500100" for a range.
const rangeText = (r: Pick<FreeShippingRange, 'start_pincode' | 'end_pincode'>) =>
  r.start_pincode === r.end_pincode ? r.start_pincode : `${r.start_pincode} – ${r.end_pincode}`

/**
 * PIN code ranges with free delivery, and a cart value above which delivery is free everywhere.
 * Inside a range that is switched on, or once the cart (after the coupon) reaches that value, the
 * checkout charges 0; otherwise it charges Shiprocket's rate. The delivery date shows either way.
 */
export function FreeShippingPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('free_shipping')
  // Free delivery above an order value is the owner's alone, whatever a manager's tick boxes say.
  const { isOwner } = useAdminAccess()
  const ranges = useFetch((signal) => getFreeShippingRanges(signal), 'admin-free-shipping')
  const [popup, setPopup] = useState<PopupState>(null)
  const [toast, setToast] = useState<ToastState>(null)
  // Status changes made here, shown straight away without reloading the list.
  const [overrides, setOverrides] = useState<Record<string, FreeShippingRange | 'deleted'>>({})

  const rows = (ranges.data ?? [])
    .map((r) => overrides[r.freeshipping_id] ?? r)
    .filter((r): r is FreeShippingRange => r !== 'deleted')
  const on = rows.filter((r) => r.status).length

  const toggle = async (r: FreeShippingRange, status: boolean) => {
    try {
      const res = await setFreeShippingStatus(r.freeshipping_id, status)
      setOverrides((o) => ({ ...o, [r.freeshipping_id]: res.free_shipping }))
      setToast({ message: `Free shipping to ${r.location_name} is ${status ? 'switched on' : 'switched off'}.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const remove = async (r: FreeShippingRange) => {
    try {
      await deleteFreeShippingRange(r.freeshipping_id)
      setOverrides((o) => ({ ...o, [r.freeshipping_id]: 'deleted' }))
      setToast({ message: `${r.location_name} was removed.`, kind: 'success' })
      setPopup(null)
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const saved = (message: string) => {
    setPopup(null)
    setOverrides({})
    setToast({ message, kind: 'success' })
    ranges.reload()
  }

  return (
    <>
      <AdminPageHead
        title="Free shipping"
        subtitle={ranges.data && rows.length
          ? `${plural(rows.length, 'area')}, ${on} switched on. Other orders pay Shiprocket's delivery charge.`
          : isOwner ? 'Free delivery by PIN code area, or above an order value. Other orders pay Shiprocket\'s delivery charge.'
          : 'PIN code areas where delivery is free. Other orders pay Shiprocket\'s delivery charge.'}
        actions={can.create ? <button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add area</button> : undefined}
      />

      {isOwner && <ThresholdPanel onToast={setToast} />}

      {ranges.loading && !ranges.data ? (
        <Loading />
      ) : ranges.error ? (
        <ErrorState message={ranges.error.message} onRetry={ranges.reload} />
      ) : rows.length === 0 ? (
        <div className="panel empty-panel">
          <span className="empty-panel__icon"><FreeShippingIcon size={28} /></span>
          <h2>Add your first free delivery area</h2>
          <p>Give a PIN code range, like 500001 to 500100 for Hyderabad. Orders delivered there pay nothing for shipping, and still see the expected delivery date.</p>
          {can.create && <button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add area</button>}
        </div>
      ) : (
        <>
          <PincodeCheck />
          <div className="panel panel--flush">
            <div className="table-wrap">
              <table className="table table--cards">
                <thead>
                  <tr>
                    <th>Area</th><th>PIN codes</th><th>Free shipping</th>
                    <th className="table__actions"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.freeshipping_id} className={r.status ? undefined : 'is-muted'}>
                      <td className="cell-main">
                        <span className="table__strong">{r.location_name}</span>
                        <span className="table__sub">{r.state}, {r.country}</span>
                      </td>
                      <td data-label="PIN codes">{rangeText(r)}</td>
                      <td data-label="Free shipping">
                        <div className="switch-row">
                          <Switch checked={r.status} onChange={(v) => toggle(r, v)} label={`Free shipping to ${r.location_name}`} disabled={!can.edit} />
                          <span>{r.status ? 'On' : 'Off'}</span>
                        </div>
                      </td>
                      <td className="table__actions">
                        {can.edit && (
                          <button className="admin-icon-button" onClick={() => setPopup({ mode: 'edit', range: r })} aria-label={`Edit ${r.location_name}`} title="Edit">
                            <EditIcon />
                          </button>
                        )}
                        {can.delete && <ConfirmButton label={`Remove ${r.location_name}`} icon={<DeleteIcon />} onConfirm={() => remove(r)} confirm={{
                          title: `Remove ${r.location_name}?`,
                          message: <p>Deliveries to {rangeText(r)} will be charged Shiprocket's rate again. To pause it instead, switch it off.</p>,
                          confirmLabel: 'Remove area',
                        }} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {popup && (
        <RangePopup
          key={popup.mode === 'edit' ? popup.range.freeshipping_id : 'new'}
          range={popup.mode === 'edit' ? popup.range : null}
          onClose={() => setPopup(null)}
          onSaved={saved}
          onError={(message) => setToast({ message, kind: 'error' })}
        />
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

/**
 * "Free delivery on orders of ₹X or more", to any PIN code: a folder with its on/off switch on the
 * outside; open it to change or delete the amount. The store owner's alone: managers never see it
 * (the backend refuses them too).
 */
function ThresholdPanel({ onToast }: { onToast: (t: ToastState) => void }) {
  const loaded = useFetch((signal) => getFreeShippingThreshold(signal), 'admin-free-shipping-threshold')
  // What was saved or deleted here, shown without loading it again.
  const [saved, setSaved] = useState<FreeShippingThreshold | null>(null)
  const [open, setOpen] = useState(false)
  // The amount being typed; null: not touched, so it shows the saved one.
  const [draft, setDraft] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const current = saved ?? loaded.data
  if (!current) {
    return (
      <section className="panel threshold-panel">
        {loaded.error ? <ErrorState message={loaded.error.message} onRetry={loaded.reload} /> : <Loading />}
      </section>
    )
  }
  const amount = current.amount
  const text = draft ?? (amount !== null ? String(amount) : '')
  const changed = draft !== null && Number(draft) !== amount

  const store = async (enabled: boolean, value: number) => {
    setSaving(true)
    try {
      const res = await updateFreeShippingThreshold({ enabled, amount: value })
      setSaved(res.threshold)
      setDraft(null)
      onToast({
        message: res.threshold.enabled
          ? `Orders of ${money(res.threshold.amount)} or more now get free delivery.`
          : 'Free delivery above an order value is switched off.',
        kind: 'success',
      })
      return true
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
      return false
    } finally {
      setSaving(false)
    }
  }

  const toggle = (enabled: boolean) => {
    // Nothing to switch on yet: open the folder to ask for the amount first.
    if (amount === null) return setOpen(true)
    store(enabled, amount)
  }

  // Saving an amount also switches it on: that's why it was typed.
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(text)
    if (!text || !Number.isFinite(value) || value <= 0) return setProblem('Enter the order value, like 999')
    if (value > 1000000) return setProblem('Enter an amount up to ₹10,00,000')
    if (await store(true, value)) setOpen(false)
  }

  const remove = async () => {
    try {
      const res = await deleteFreeShippingThreshold()
      setSaved(res.threshold)
      setDraft(null)
      setProblem(null)
      setOpen(false)
      onToast({ message: 'Free delivery above an order value was deleted.', kind: 'success' })
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  return (
    <section className={`panel threshold-panel${current.enabled ? '' : ' is-muted'}`}>
      <div className="threshold-panel__bar">
        <button type="button" className="threshold-panel__toggle" aria-expanded={open} aria-controls="threshold-body" onClick={() => setOpen((o) => !o)}>
          <span className="threshold-panel__icon"><FreeShippingIcon size={20} /></span>
          <span className="threshold-panel__title">
            <strong>Free delivery above an order value</strong>
            <small>
              {amount === null ? 'Not set up yet. Open to add an amount.'
                : current.enabled ? `Orders of ${money(amount)} or more ship free, to any PIN code.`
                : `Off. ${money(amount)} is kept, but not applied.`}
            </small>
          </span>
          <ChevronDownIcon className="threshold-panel__chevron" />
        </button>
        <div className="switch-row">
          <Switch checked={current.enabled} onChange={toggle} label="Free delivery above an order value" disabled={saving} />
          <span>{current.enabled ? 'On' : 'Off'}</span>
        </div>
      </div>

      {open && (
        <div id="threshold-body" className="threshold-panel__body">
          <p className="admin-hint admin-hint--tight">
            Any PIN code gets free delivery once the bag, after the coupon, is worth this much. Checkout shows
            customers how much more to add. Only you see this setting: managers don't.
          </p>
          <form className="threshold-panel__form" onSubmit={submit} noValidate>
            <div className="admin-field">
              <label htmlFor="fs-threshold" className="admin-label">Minimum order value</label>
              <div className="settings-prefix">
                <span aria-hidden>₹</span>
                <input id="fs-threshold" className="admin-input" inputMode="decimal" maxLength={10} placeholder="999" value={text}
                  autoFocus aria-invalid={!!problem}
                  onChange={(e) => { setDraft(e.target.value.replace(/[^\d.]/g, '')); setProblem(null) }} />
              </div>
            </div>
            <button type="submit" className="admin-button" disabled={saving || (current.enabled && !changed)}>
              {saving ? 'Saving…' : current.enabled ? 'Save' : 'Save and switch on'}
            </button>
            {amount !== null && (
              <ConfirmButton
                label="Delete free delivery above an order value"
                icon={<><DeleteIcon size={16} /> Delete</>}
                className="admin-button admin-button--danger-ghost"
                disabled={saving}
                onConfirm={remove}
                confirm={{
                  title: 'Delete free delivery above an order value?',
                  message: <p>Orders outside your free areas will pay Shiprocket's delivery charge again, whatever their value. To pause it instead, switch it off.</p>,
                  confirmLabel: 'Delete',
                }}
              />
            )}
          </form>
          {problem && <p className="field__error" role="alert">{problem}</p>}
        </div>
      )}
    </section>
  )
}

/** Try a PIN code against the saved areas, with the same rule the checkout uses. */
function PincodeCheck() {
  const [pincode, setPincode] = useState('')
  const [result, setResult] = useState<{ pincode: string; free: boolean; area: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!PINCODE.test(pincode)) return setError('Enter a 6-digit PIN code')
    setError(null)
    setChecking(true)
    try {
      const res = await checkFreeShipping(pincode)
      setResult({ pincode: res.pincode, free: res.free_shipping, area: res.location_name })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <form className="toolbar pin-check" onSubmit={submit} noValidate>
      <label htmlFor="pin-check" className="visually-hidden">Check a PIN code</label>
      <input id="pin-check" className="admin-input" inputMode="numeric" maxLength={6} placeholder="Check a PIN code" value={pincode}
        onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '')); setResult(null); setError(null) }} />
      <button type="submit" className="admin-button admin-button--ghost" disabled={checking}>{checking ? 'Checking…' : 'Check'}</button>
      {error ? (
        <span className="field__error" role="alert">{error}</span>
      ) : result && (
        <span role="status">
          {result.free
            ? <><strong>{result.pincode}</strong> gets free shipping ({result.area}).</>
            : <><strong>{result.pincode}</strong> pays Shiprocket's delivery charge.</>}
        </span>
      )}
    </form>
  )
}

function RangePopup({ range, onClose, onSaved, onError }: {
  range: FreeShippingRange | null
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<FreeShippingInput>(() => ({
    location_name: range?.location_name ?? '',
    country: range?.country ?? DEFAULT_COUNTRY,
    // A range saved with the state typed in another spelling is picked again from the list.
    state: matchState(range?.country ?? DEFAULT_COUNTRY, range?.state),
    start_pincode: range?.start_pincode ?? '',
    end_pincode: range?.end_pincode ?? '',
    status: range?.status ?? true,
  }))
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const change = (changes: Partial<FreeShippingInput>) => {
    setForm((f) => ({ ...f, ...changes }))
    setProblem(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const input = { ...form, location_name: form.location_name.trim() }
    // A single PIN code: the end can be left empty.
    if (!input.end_pincode) input.end_pincode = input.start_pincode
    if (!input.location_name) return setProblem('Enter the area name')
    if (!input.state) return setProblem('Choose the state')
    if (!PINCODE.test(input.start_pincode) || !PINCODE.test(input.end_pincode)) return setProblem('PIN codes have 6 digits and don’t start with 0')
    if (input.start_pincode > input.end_pincode) return setProblem('The first PIN code must not be after the last one')
    setSaving(true)
    try {
      if (range) await updateFreeShippingRange(range.freeshipping_id, input)
      else await createFreeShippingRange(input)
      onSaved(`${input.location_name} was ${range ? 'saved' : 'added'}.`)
    } catch (err) {
      setSaving(false)
      onError((err as Error).message)
    }
  }

  return (
    <Modal
      open
      title={range ? `Edit ${range.location_name}` : 'New free delivery area'}
      subtitle="Both PIN codes are included. For one PIN code, leave the last one empty."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="free-shipping-form" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : range ? 'Save changes' : 'Add area'}
          </button>
        </>
      }
    >
      <form id="free-shipping-form" onSubmit={submit} noValidate>
        <div className="admin-field">
          <label htmlFor="fs-country" className="admin-label">Country</label>
          <select id="fs-country" className="admin-input" value={form.country}
            onChange={(e) => {
              const country = e.target.value as CountryName
              // The states follow the country; one the new country doesn't have is cleared.
              change({ country, state: matchState(country, form.state) })
            }}>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field-pair">
          <div className="admin-field">
            <label htmlFor="fs-name" className="admin-label">Area name</label>
            <input id="fs-name" className="admin-input" maxLength={100} autoFocus value={form.location_name}
              placeholder="e.g. Hyderabad" onChange={(e) => change({ location_name: e.target.value })} />
          </div>
          <div className="admin-field">
            <label htmlFor="fs-state" className="admin-label">State</label>
            <select id="fs-state" className="admin-input" value={form.state} onChange={(e) => change({ state: e.target.value })}>
              <option value="">Choose…</option>
              {STATES_BY_COUNTRY[form.country].map((st) => <option key={st}>{st}</option>)}
            </select>
          </div>
        </div>
        <div className="field-pair">
          <div className="admin-field">
            <label htmlFor="fs-start" className="admin-label">First PIN code</label>
            <input id="fs-start" className="admin-input" inputMode="numeric" maxLength={6} value={form.start_pincode}
              placeholder="500001" onChange={(e) => change({ start_pincode: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div className="admin-field">
            <label htmlFor="fs-end" className="admin-label">Last PIN code</label>
            <input id="fs-end" className="admin-input" inputMode="numeric" maxLength={6} value={form.end_pincode}
              placeholder={form.start_pincode || '500100'} onChange={(e) => change({ end_pincode: e.target.value.replace(/\D/g, '') })} />
          </div>
        </div>
        <div className="switch-row">
          <Switch checked={form.status} onChange={(status) => change({ status })} label="Free shipping is on" />
          <span>{form.status ? 'On: delivery here is free' : 'Off: delivery here is charged Shiprocket’s rate'}</span>
        </div>
        {problem && <p className="field__error" role="alert">{problem}</p>}
      </form>
    </Modal>
  )
}
