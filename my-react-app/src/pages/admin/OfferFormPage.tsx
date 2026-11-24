import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { GiftIcon } from '../../components/Icons'
import { QuantityStepper } from '../../components/QuantityStepper'
import { ErrorState, Loading } from '../../components/ui'
import {
  createOffer, getAdminCategories, getAdminOffer, getAdminProducts, updateOffer,
  type AdminCategory, type AdminOffer, type AdminProduct, type OfferInput,
} from '../../lib/adminApi'
import { getAdminSession } from '../../lib/adminSession'
import { useFetch } from '../../lib/useFetch'
import { AdminPageHead, Switch } from './AdminUi'
import { DealThumb } from './OfferDeal'
import { buySide, freeSide, type DealSide } from './offerSides'
import { panel } from '../../lib/panelPath'

export function OfferFormPage() {
  const { offerId } = useParams()
  const adminId = getAdminSession()?.adminId ?? ''
  const offer = useFetch((signal) => (offerId ? getAdminOffer(offerId, signal) : Promise.resolve(null)), `offer|${offerId ?? 'new'}`)
  const categories = useFetch((signal) => getAdminCategories(signal), 'admin-cats')
  const products = useFetch((signal) => getAdminProducts(adminId, undefined, 0, 100, signal), 'offer-products')

  if (offer.loading || categories.loading || products.loading) return <Loading />
  const error = offer.error ?? categories.error ?? products.error
  if (error) return <ErrorState message={error.message} onRetry={() => { offer.reload(); categories.reload(); products.reload() }} />
  return <OfferForm key={offerId ?? 'new'} offer={offer.data ?? null} categories={categories.data ?? []} products={products.data ?? []} />
}

// The "Buy" dropdown holds products, categories and sub-categories: "p:<id>", "c:<id>" or
// "s:<category id>:<sub-category name>" (the name goes last, since it may itself hold a ":").
// An older offer made for several at once keeps them as "saved" until something else is picked.
const SAVED = 'saved'
// The "Get" dropdown: the same item, or a product and size as "<product id>|<size>".
const SAME = 'same'

function buyValue(offer: AdminOffer | null): string {
  if (!offer) return ''
  if (offer.applies_to === 'sub_categories') {
    const subs = offer.sub_categories ?? []
    return subs.length === 1 ? `s:${subs[0].category_id}:${subs[0].name}` : SAVED
  }
  const ids = offer.applies_to === 'products' ? offer.product_ids : offer.category_ids
  if (ids.length !== 1) return SAVED
  return `${offer.applies_to === 'products' ? 'p' : 'c'}:${ids[0]}`
}

const clamp = (n: number) => Math.min(50, Math.max(1, n))

/** The offer as a deal: what goes in (buy) and what comes out free, side by side, with its name below. */
function OfferForm({ offer, categories, products }: { offer: AdminOffer | null; categories: AdminCategory[]; products: AdminProduct[] }) {
  const navigate = useNavigate()
  const editing = !!offer
  const [buy, setBuy] = useState(offer?.buy_quantity ?? 2)
  const [buyWhat, setBuyWhat] = useState(buyValue(offer))
  const [get, setGet] = useState(offer?.get_quantity ?? 1)
  const [getWhat, setGetWhat] = useState(
    offer?.offer_type === 'buy_x_get_gift' ? `${offer.gift_product_id}|${offer.gift_variant_name}` : SAME,
  )
  const [title, setTitle] = useState(offer?.title ?? '')
  const [titleTouched, setTitleTouched] = useState(editing)
  const [status, setStatus] = useState(offer?.status ?? true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [kind, id] = buyWhat.split(':')
  const subName = kind === 's' ? buyWhat.slice(`s:${id}:`.length) : ''
  // The offer as it would be saved; the deal pictures and the request both come from it.
  const draft = {
    applies_to: buyWhat === SAVED ? offer!.applies_to
      : kind === 'c' ? 'categories' as const : kind === 's' ? 'sub_categories' as const : 'products' as const,
    product_ids: buyWhat === SAVED ? offer!.product_ids : kind === 'p' ? [id] : [],
    category_ids: buyWhat === SAVED ? offer!.category_ids : kind === 'c' ? [id] : [],
    sub_categories: buyWhat === SAVED ? offer!.sub_categories ?? [] : kind === 's' ? [{ category_id: id, name: subName }] : [],
    offer_type: getWhat === SAME ? 'buy_x_get_x' as const : 'buy_x_get_gift' as const,
    gift_product_id: getWhat === SAME ? null : getWhat.split('|')[0],
    gift_variant_name: getWhat === SAME ? null : getWhat.split('|')[1],
  }
  const buyPicture = buyWhat ? buySide(draft, products, categories) : null
  const freePicture = freeSide(draft, buyPicture, products)
  // A category or sub-category: any product in it counts, so "same item" means same product and size.
  const isCategory = draft.applies_to !== 'products'

  const suggested = `Buy ${buy} Get ${getWhat === SAME ? get : freePicture?.name ?? 'a Gift'} Free`
  const name = titleTouched ? title : suggested

  // The deal in one plain sentence, under the two halves.
  const sentence = !buyPicture
    ? 'Choose what the shopper buys to see the deal.'
    : getWhat === SAME
      ? `Buy ${buy} ${buyPicture.name}${isCategory ? ' (same product and size)' : ''}, get ${get} more free.`
      : `Buy ${buy} ${isCategory ? `from ${buyPicture.name} (any mix)` : buyPicture.name}, get ${get} × ${freePicture?.name ?? 'the gift'} ${freePicture?.detail ?? ''} free.`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!buyWhat) return setError('Choose what the shopper buys.')
    if (name.trim().length < 3) return setError('Give the offer a name of at least 3 letters.')
    const input: OfferInput = {
      ...draft,
      title: name.trim(),
      // Not on this form; an existing offer keeps what it had.
      description: offer?.description ?? null,
      max_rewards_per_order: offer?.max_rewards_per_order ?? null,
      buy_quantity: buy,
      get_quantity: get,
      status,
    }
    setError(null)
    setSaving(true)
    try {
      if (editing) await updateOffer(offer.offer_id, input)
      else await createOffer(input)
      navigate(panel('/admin/offers'), { state: { toast: `${input.title} was ${editing ? 'saved' : 'created'}.` } })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const savedCount = draft.applies_to === 'products' ? draft.product_ids.length
    : draft.applies_to === 'sub_categories' ? draft.sub_categories.length : draft.category_ids.length
  const savedLabel = draft.applies_to === 'products' ? 'products' : draft.applies_to === 'sub_categories' ? 'sub-categories' : 'categories'
  // Only categories that have sub-categories get a line here, each as "Category / Sub-category".
  const subOptions = categories.flatMap((c) => (c.sub_categories ?? []).map((s) => ({
    value: `s:${c.category_id}:${s.name}`,
    label: `${c.category_name} / ${s.name}`,
  })))
  // A sub-category renamed or removed since the offer was saved still shows, so the form isn't blank.
  const missingSub = kind === 's' && !subOptions.some((o) => o.value === buyWhat)

  return (
    <form onSubmit={submit} noValidate className="offer-form">
      <Link to={panel('/admin/offers')} className="admin-back">← All offers</Link>
      <AdminPageHead
        title={editing ? 'Edit offer' : 'New offer'}
        subtitle="Pick what the shopper buys and what they get for free. It applies at checkout by itself."
        stickyActions
        actions={
          <>
            <Link to={panel('/admin/offers')} className="admin-button admin-button--ghost">Cancel</Link>
            <button type="submit" className="admin-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save offer' : 'Create offer'}</button>
          </>
        }
      />

      <div className="deal">
        <DealHalf
          heading="Shopper buys"
          picture={buyPicture}
          quantity={buy}
          onQuantity={(n) => setBuy(clamp(n))}
          empty="Nothing chosen yet"
        >
          <select className="admin-input" aria-label="What the shopper buys" value={buyWhat} onChange={(e) => setBuyWhat(e.target.value)}>
            <option value="">Choose a product, category or sub-category</option>
            {buyWhat === SAVED && <option value={SAVED}>{savedCount} {savedLabel} (as saved)</option>}
            {missingSub && <option value={buyWhat}>{subName} (no longer in its category)</option>}
            <optgroup label="Products">
              {products.map((p) => <option key={p.product_id} value={`p:${p.product_id}`}>{p.product_name}</option>)}
            </optgroup>
            <optgroup label="Categories (any product in it)">
              {categories.map((c) => <option key={c.category_id} value={`c:${c.category_id}`}>{c.category_name}</option>)}
            </optgroup>
            {subOptions.length > 0 && (
              <optgroup label="Sub-categories (any product in it)">
                {subOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            )}
          </select>
        </DealHalf>

        <span className="deal__join" aria-hidden><GiftIcon size={22} /></span>

        <DealHalf
          heading="Gets for free"
          free
          picture={freePicture}
          quantity={get}
          onQuantity={(n) => setGet(clamp(n))}
          empty={getWhat === SAME ? 'The same item as they buy' : 'Choose the free product'}
        >
          <select className="admin-input" aria-label="What they get free" value={getWhat} onChange={(e) => setGetWhat(e.target.value)}>
            <option value={SAME}>More of the same item</option>
            <optgroup label="Or a different product">
              {products.flatMap((p) => p.variants.map((v) => (
                <option key={`${p.product_id}|${v.variant_name}`} value={`${p.product_id}|${v.variant_name}`}>
                  {p.product_name} – {v.variant_name}
                </option>
              )))}
            </optgroup>
          </select>
        </DealHalf>
      </div>

      <p className={`deal__sentence${buyPicture ? '' : ' is-empty'}`} aria-live="polite">{sentence}</p>

      <section className="offer-form__name panel">
        <div className="admin-field">
          <label htmlFor="o-title" className="admin-label">Name shoppers see</label>
          <input id="o-title" className="admin-input" value={name} maxLength={80}
            onChange={(e) => { setTitle(e.target.value); setTitleTouched(true) }} />
          <p className="admin-hint">
            Shown on the product as <span className="tag tag--offer">{name || 'Offer'}</span>
          </p>
          {titleTouched && !editing && name !== suggested && (
            <button type="button" className="text-button" onClick={() => setTitleTouched(false)}>Use “{suggested}” instead</button>
          )}
        </div>
        <div className="switch-row offer-form__switch">
          <Switch checked={status} onChange={setStatus} label="Offer is on" />
          <span>{status ? 'On: shoppers get it' : 'Off: saved, nobody gets it'}</span>
        </div>
      </section>

      {error && <p className="field__error" role="alert">{error}</p>}
    </form>
  )
}

/** One half of the deal: a heading, the picker, then the chosen item's picture with its quantity. */
function DealHalf({ heading, picture, quantity, onQuantity, empty, free = false, children }: {
  heading: string
  picture: DealSide | null
  quantity: number
  onQuantity: (n: number) => void
  empty: string
  free?: boolean
  children: ReactNode
}) {
  return (
    <section className={`deal__half${free ? ' deal__half--free' : ''}`} aria-label={heading}>
      <h2 className="deal__heading">{heading}</h2>
      {children}
      <div className="deal__item">
        <DealThumb side={picture} quantity={quantity} free={free} />
        <span className="deal__name">
          {picture ? <strong>{picture.name}</strong> : <span className="muted">{empty}</span>}
          {picture?.detail && <small>{picture.detail}</small>}
        </span>
        <QuantityStepper value={quantity} onChange={onQuantity} label={heading} />
      </div>
    </section>
  )
}
