import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ErrorState, Loading } from '../../components/ui'
import {
  createCoupon, getAdminCategories, getAdminProducts, getCoupon, updateCoupon,
  type AdminCategory, type AdminProduct, type Coupon, type CouponInput,
} from '../../lib/adminApi'
import { getAdminSession } from '../../lib/adminSession'
import { useFetch } from '../../lib/useFetch'
import { discountText } from '../../lib/format'
import { AdminPageHead, Panel, Switch } from './AdminUi'
import { panel } from '../../lib/panelPath'

// <input type="datetime-local"> has no timezone; the store works in Indian time.
const IST_OFFSET = '+05:30'
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000)
  return ist.toISOString().slice(0, 16)
}
const fromLocalInput = (value: string) => (value ? `${value}:00${IST_OFFSET}` : null)

export function CouponFormPage() {
  const { couponId } = useParams()
  const adminId = getAdminSession()?.adminId ?? ''
  const coupon = useFetch((signal) => (couponId ? getCoupon(couponId, signal) : Promise.resolve(null)), `coupon|${couponId ?? 'new'}`)
  const categories = useFetch((signal) => getAdminCategories(signal), 'admin-cats')
  const products = useFetch((signal) => getAdminProducts(adminId, undefined, 0, 100, signal), 'coupon-products')

  if (coupon.loading || categories.loading || products.loading) return <Loading />
  const error = coupon.error ?? categories.error ?? products.error
  if (error) return <ErrorState message={error.message} onRetry={() => { coupon.reload(); categories.reload(); products.reload() }} />
  return <CouponForm key={couponId ?? 'new'} coupon={coupon.data ?? null} categories={categories.data ?? []} products={products.data ?? []} />
}

function CouponForm({ coupon, categories, products }: { coupon: Coupon | null; categories: AdminCategory[]; products: AdminProduct[] }) {
  const navigate = useNavigate()
  const editing = !!coupon
  const [code, setCode] = useState(coupon?.code ?? '')
  const [description, setDescription] = useState(coupon?.description ?? '')
  const [usageType, setUsageType] = useState<CouponInput['usage_type']>(coupon?.usage_type ?? 'multi_use')
  const [firstOrderOnly, setFirstOrderOnly] = useState(coupon?.first_order_only ?? false)
  const [discountType, setDiscountType] = useState<CouponInput['discount_type']>(coupon?.discount_type ?? 'percentage')
  const [value, setValue] = useState(coupon ? String(coupon.discount_value) : '')
  const [maxDiscount, setMaxDiscount] = useState(coupon?.max_discount_amount ? String(coupon.max_discount_amount) : '')
  const [appliesTo, setAppliesTo] = useState<CouponInput['applies_to']>(coupon?.applies_to ?? 'all')
  const [productIds, setProductIds] = useState<string[]>(coupon?.product_ids ?? [])
  const [categoryIds, setCategoryIds] = useState<string[]>(coupon?.category_ids ?? [])
  // Sub-categories as "<category id>:<name>" (the name last, since it may hold a ":").
  const [subKeys, setSubKeys] = useState<string[]>((coupon?.sub_categories ?? []).map((s) => `${s.category_id}:${s.name}`))
  const [minSubtotal, setMinSubtotal] = useState(coupon?.min_subtotal ? String(coupon.min_subtotal) : '')
  const [minQuantity, setMinQuantity] = useState(coupon?.min_quantity ? String(coupon.min_quantity) : '')
  const [startsAt, setStartsAt] = useState(toLocalInput(coupon?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(coupon?.ends_at ?? null))
  const [status, setStatus] = useState(coupon?.status ?? true)
  const [productSearch, setProductSearch] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const validate = () => {
    const p: string[] = []
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) p.push('Code: 3 to 30 letters, numbers, - or _ (no spaces)')
    const v = Number(value)
    if (!(v > 0)) p.push('Enter the discount amount')
    if (discountType === 'percentage') {
      if (v > 100) p.push('A percentage discount can be at most 100%')
      if (!(Number(maxDiscount) > 0)) p.push('Enter the most this percentage coupon can take off, in ₹')
    }
    if (appliesTo === 'products' && !productIds.length) p.push('Pick at least one product, or apply the coupon to all products')
    if (appliesTo === 'categories' && !categoryIds.length) p.push('Pick at least one category, or apply the coupon to all products')
    if (appliesTo === 'sub_categories' && !subKeys.length) p.push('Pick at least one sub-category, or apply the coupon to all products')
    if (startsAt && endsAt && endsAt <= startsAt) p.push('The end date must be after the start date')
    return p
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problems = validate()
    setErrors(problems)
    if (problems.length) return window.scrollTo({ top: 0, behavior: 'smooth' })
    const input: CouponInput = {
      code,
      description: description.trim() || null,
      usage_type: usageType,
      first_order_only: usageType === 'single_use' && firstOrderOnly,
      discount_type: discountType,
      discount_value: Number(value),
      max_discount_amount: discountType === 'percentage' ? Number(maxDiscount) : null,
      applies_to: appliesTo,
      product_ids: appliesTo === 'products' ? productIds : [],
      category_ids: appliesTo === 'categories' ? categoryIds : [],
      sub_categories: appliesTo === 'sub_categories'
        ? subKeys.map((k) => ({ category_id: k.slice(0, k.indexOf(':')), name: k.slice(k.indexOf(':') + 1) }))
        : [],
      min_subtotal: minSubtotal ? Number(minSubtotal) : null,
      min_quantity: minQuantity ? Number(minQuantity) : null,
      starts_at: fromLocalInput(startsAt),
      ends_at: fromLocalInput(endsAt),
      status,
    }
    setSaving(true)
    try {
      if (editing) await updateCoupon(coupon.coupon_id, input)
      else await createCoupon(input)
      navigate(panel('/admin/coupons'), { state: { toast: `${code} was ${editing ? 'saved' : 'created'}.` } })
    } catch (err) {
      setErrors([(err as Error).message])
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const shownProducts = products.filter((p) => p.product_name.toLowerCase().includes(productSearch.trim().toLowerCase()))
  // Only offered when some category has sub-categories (or the coupon already uses them).
  const withSubs = categories.filter((c) => c.sub_categories?.length)
  const appliesOptions = [
    ['all', 'All products'], ['categories', 'Some categories'],
    ...(withSubs.length || appliesTo === 'sub_categories' ? [['sub_categories', 'Some sub-categories'] as const] : []),
    ['products', 'Some products'],
  ] as const
  // Saved sub-categories the store no longer has, so they can still be unticked.
  const knownSubs = new Set(withSubs.flatMap((c) => c.sub_categories!.map((s) => `${c.category_id}:${s.name}`)))
  const staleSubs = subKeys.filter((k) => !knownSubs.has(k))
  const preview = Number(value) > 0 ? discountText({ discount_type: discountType, discount_value: Number(value), max_discount_amount: Number(maxDiscount) || null }) : null

  return (
    <form onSubmit={submit} noValidate>
      <Link to={panel('/admin/coupons')} className="admin-back">← All coupons</Link>
      <AdminPageHead
        title={editing ? `Edit ${coupon.code}` : 'Create coupon'}
        stickyActions
        actions={
          <>
            <Link to={panel('/admin/coupons')} className="admin-button admin-button--ghost">Cancel</Link>
            <button type="submit" className="admin-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save coupon' : 'Create coupon'}</button>
          </>
        }
      />

      {errors.length > 0 && (
        <div className="admin-errors" role="alert">
          <strong>Please fix {errors.length === 1 ? 'this' : 'these'} first:</strong>
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      <div className="detail-columns">
        <div className="detail-columns__main">
          <Panel title="Code">
            <div className="field-pair">
              <div className="admin-field">
                <label htmlFor="c-code" className="admin-label">Coupon code</label>
                <input id="c-code" className="admin-input coupon-code-input" value={code} maxLength={30} placeholder="WELCOME10"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} />
              </div>
              <div className="admin-field">
                <label htmlFor="c-desc" className="admin-label">Shown to shoppers (optional)</label>
                <input id="c-desc" className="admin-input" value={description} maxLength={300} placeholder="10% off your first order" onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          </Panel>

          <Panel title="Discount">
            <div className="choice-row" role="radiogroup" aria-label="Discount type">
              <label className={`choice${discountType === 'percentage' ? ' is-on' : ''}`}>
                <input type="radio" name="dtype" checked={discountType === 'percentage'} onChange={() => setDiscountType('percentage')} />
                <strong>Percentage</strong><span>e.g. 20% off, up to ₹200</span>
              </label>
              <label className={`choice${discountType === 'fixed_amount' ? ' is-on' : ''}`}>
                <input type="radio" name="dtype" checked={discountType === 'fixed_amount'} onChange={() => setDiscountType('fixed_amount')} />
                <strong>Fixed amount</strong><span>e.g. ₹100 off</span>
              </label>
            </div>
            <div className="field-pair">
              <div className="admin-field">
                <label htmlFor="c-value" className="admin-label">{discountType === 'percentage' ? 'Percent off' : 'Amount off (₹)'}</label>
                <input id="c-value" className="admin-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
              {discountType === 'percentage' && (
                <div className="admin-field">
                  <label htmlFor="c-max" className="admin-label">Most it can take off (₹)</label>
                  <input id="c-max" className="admin-input" inputMode="decimal" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value.replace(/[^\d.]/g, ''))} />
                </div>
              )}
            </div>
            {preview && <p className="admin-hint">Shoppers get: <strong>{preview}</strong></p>}
          </Panel>

          <Panel title="Applies to">
            <div className={`choice-row${appliesOptions.length === 3 ? ' choice-row--3' : ''}`} role="radiogroup" aria-label="Applies to">
              {appliesOptions.map(([v, label]) => (
                <label key={v} className={`choice${appliesTo === v ? ' is-on' : ''}`}>
                  <input type="radio" name="applies" checked={appliesTo === v} onChange={() => setAppliesTo(v)} />
                  <strong>{label}</strong>
                </label>
              ))}
            </div>
            {appliesTo === 'categories' && (
              <ul className="pick-list">
                {categories.map((c) => (
                  <li key={c.category_id}>
                    <label><input type="checkbox" checked={categoryIds.includes(c.category_id)} onChange={() => setCategoryIds((l) => toggleIn(l, c.category_id))} /> {c.category_name}</label>
                  </li>
                ))}
              </ul>
            )}
            {appliesTo === 'sub_categories' && (
              <ul className="pick-list pick-list--scroll">
                {withSubs.flatMap((c) => c.sub_categories!.map((s) => {
                  const key = `${c.category_id}:${s.name}`
                  return (
                    <li key={key}>
                      <label><input type="checkbox" checked={subKeys.includes(key)} onChange={() => setSubKeys((l) => toggleIn(l, key))} /> {s.name}<span className="table__sub">{c.category_name}</span></label>
                    </li>
                  )
                }))}
                {staleSubs.map((key) => (
                  <li key={key}>
                    <label><input type="checkbox" checked onChange={() => setSubKeys((l) => toggleIn(l, key))} /> {key.slice(key.indexOf(':') + 1)}<span className="table__sub">No longer in its category</span></label>
                  </li>
                ))}
              </ul>
            )}
            {appliesTo === 'products' && (
              <>
                <input className="admin-input" placeholder="Search products" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} aria-label="Search products" />
                <ul className="pick-list pick-list--scroll">
                  {shownProducts.map((p) => (
                    <li key={p.product_id}>
                      <label><input type="checkbox" checked={productIds.includes(p.product_id)} onChange={() => setProductIds((l) => toggleIn(l, p.product_id))} /> {p.product_name}<span className="table__sub">{p.category_name}</span></label>
                    </li>
                  ))}
                </ul>
                <p className="admin-hint">{productIds.length} selected</p>
              </>
            )}
            <div className="field-pair">
              <div className="admin-field">
                <label htmlFor="c-min" className="admin-label">Minimum order value (₹, optional)</label>
                <input id="c-min" className="admin-input" inputMode="decimal" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
              <div className="admin-field">
                <label htmlFor="c-minq" className="admin-label">Minimum items (optional)</label>
                <input id="c-minq" className="admin-input" inputMode="numeric" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
          </Panel>
        </div>

        <div className="detail-columns__side">
          <Panel title="Status">
            <div className="switch-row">
              <Switch checked={status} onChange={setStatus} label="Coupon is on" />
              <span>{status ? 'On: shoppers can use it' : 'Off: nobody can use it'}</span>
            </div>
          </Panel>
          <Panel title="Usage">
            <div className="choice-stack" role="radiogroup" aria-label="Usage">
              <label className={`choice${usageType === 'multi_use' ? ' is-on' : ''}`}>
                <input type="radio" name="usage" checked={usageType === 'multi_use'} onChange={() => setUsageType('multi_use')} />
                <strong>Reusable</strong><span>Any number of orders, until you switch it off or delete it</span>
              </label>
              <label className={`choice${usageType === 'single_use' ? ' is-on' : ''}`}>
                <input type="radio" name="usage" checked={usageType === 'single_use'} onChange={() => setUsageType('single_use')} />
                <strong>One-time</strong><span>Works for a single order, then stops</span>
              </label>
            </div>
            {usageType === 'single_use' && (
              <div className="switch-row">
                <Switch checked={firstOrderOnly} onChange={setFirstOrderOnly} label="First order only" />
                <span>First order only</span>
              </div>
            )}
            {editing && <p className="admin-hint">Used in {coupon.used_count} {coupon.used_count === 1 ? 'order' : 'orders'} so far.</p>}
          </Panel>
          <Panel title="Schedule (optional)">
            <div className="admin-field">
              <label htmlFor="c-start" className="admin-label">Starts (Indian time)</label>
              <input id="c-start" type="datetime-local" className="admin-input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="admin-field">
              <label htmlFor="c-end" className="admin-label">Ends (Indian time)</label>
              <input id="c-end" type="datetime-local" className="admin-input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <p className="admin-hint">Leave empty to start now and run until you switch it off.</p>
          </Panel>
        </div>
      </div>
    </form>
  )
}
