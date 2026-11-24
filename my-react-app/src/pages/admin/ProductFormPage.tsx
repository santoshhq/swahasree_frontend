import { useEffect, useRef, useState, type DragEvent, type FormEvent, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FlavorLevelOptions } from '../../components/FlavorOptions'
import { ErrorState, Loading } from '../../components/ui'
import { createProduct, getAdminCategories, getAdminProduct, updateProduct, type AdminCategory, type AdminProduct, type AdminVariant } from '../../lib/adminApi'
import { getAdminSession } from '../../lib/adminSession'
import { useFetch } from '../../lib/useFetch'
import { enabledFlavors, FLAVOR_FIELDS, FLAVOR_LABELS, flavorLevelOrDefault } from '../../lib/flavor'
import { AlertIcon, CloseIcon, DeleteIcon, EyeIcon, EyeOffIcon, ImageIcon, PlusIcon, SpinnerIcon, UploadIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, ConfirmDialog, Panel, Switch } from './AdminUi'
import { panel } from '../../lib/panelPath'

// Same limits the backend enforces in products_router.py.
const MAX_IMAGES = 10
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// A size is a number and a unit ("500 g"), or any text for sizes like "1 dozen".
const UNITS = ['g', 'kg', 'ml', 'L'] as const
type Unit = (typeof UNITS)[number] | 'custom'

const sizeName = (amount: string, unit: Unit) => (unit === 'custom' || !amount ? '' : `${amount} ${unit}`)

// "500 g", "1.5kg", "1 l" → amount and unit; anything else is kept as a custom name.
function parseSize(name: string): { amount: string; unit: Unit } {
  const m = name.trim().match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)$/i)
  if (!m) return { amount: '', unit: 'custom' }
  const unit = UNITS.find((u) => u.toLowerCase() === m[2].toLowerCase())!
  return { amount: m[1], unit }
}

// The backend's weight for an item it knows nothing about (shipping_service.py DEFAULT_ITEM_WEIGHT_KG).
const DEFAULT_WEIGHT_KG = 0.5

// Delivery is charged by weight, worked out from the size itself: 500 g -> 0.5 kg, 1 L -> about 1 kg
// (couriers round small parcels up anyway). A custom size ("1 dozen") keeps the weight saved before,
// or the default.
function shippingWeight(r: VariantRow): number {
  const amount = Number(r.amount)
  if (r.unit !== 'custom' && amount > 0) {
    const kg = r.unit === 'g' || r.unit === 'ml' ? amount / 1000 : amount
    return Math.max(0.01, Math.round(kg * 1000) / 1000)
  }
  return r.saved_weight_kg && r.saved_weight_kg > 0 ? r.saved_weight_kg : DEFAULT_WEIGHT_KG
}

type VariantRow = {
  key: string
  variant_name: string
  amount: string
  unit: Unit
  price: string
  stock_qty: string
  status: boolean
  // Not shown in the form; kept from the saved size so an edit doesn't lose them.
  saved_weight_kg: number | null
  dimensions: AdminVariant['dimensions'] | null
}

type NewImage = { key: string; file: File; preview: string }

const newRow = (): VariantRow => ({
  key: crypto.randomUUID?.() ?? String(Math.random()),
  variant_name: '', amount: '', unit: 'g', price: '', stock_qty: '', status: true, saved_weight_kg: null, dimensions: null,
})

function rowsFrom(product: AdminProduct): VariantRow[] {
  return product.variants.map((v) => ({
    key: v.variant_name,
    variant_name: v.variant_name,
    ...parseSize(v.variant_name),
    price: String(v.price),
    stock_qty: String(v.stock_qty ?? 0),
    status: v.status !== false,
    saved_weight_kg: v.weight_kg ?? null,
    dimensions: v.dimensions ?? null,
  }))
}

// Wrapper: on /edit, load the product first, then show the form filled in.
export function ProductFormPage() {
  const { productId } = useParams()
  const categories = useFetch((signal) => getAdminCategories(signal), 'admin-cats')
  const product = useFetch(
    (signal) => (productId ? getAdminProduct(productId, signal) : Promise.resolve(null)),
    `admin-product|${productId ?? 'new'}`,
  )

  if (categories.loading || product.loading) return <Loading />
  if (categories.error) return <ErrorState message={categories.error.message} onRetry={categories.reload} />
  if (product.error) return <ErrorState message={product.error.message} onRetry={product.reload} />
  if (!categories.data?.length) {
    return (
      <>
        <AdminPageHead title="Add product" />
        <div className="panel panel__empty">
          Products live in categories, so create one first. <Link to={panel('/admin/categories')}>Create a category</Link>
        </div>
      </>
    )
  }
  return <ProductForm key={productId ?? 'new'} categories={categories.data} product={product.data ?? null} />
}


// What's wrong with the form, field by field, so each message shows under its own field.
type RowErrors = { size?: string; price?: string; stock?: string }
type FormErrors = {
  name?: string
  category?: string
  subCategory?: string
  sizes?: string
  photos?: string
  minimum?: string
  rows: Record<string, RowErrors>
}

const errorCount = (e: FormErrors) =>
  [e.name, e.category, e.subCategory, e.sizes, e.photos, e.minimum].filter(Boolean).length +
  Object.values(e.rows).reduce((n, r) => n + Object.values(r).filter(Boolean).length, 0)

function ProductForm({ categories, product }: { categories: AdminCategory[]; product: AdminProduct | null }) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const editing = !!product
  const needsApproval = getAdminSession()?.role === 'manager'
  const [name, setName] = useState(product?.product_name ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? (categories.length === 1 ? categories[0].category_id : ''))
  const [subCategory, setSubCategory] = useState(product?.sub_category ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [levels, setLevels] = useState(() => ({
    spicy_level: flavorLevelOrDefault(product?.spicy_level),
    oil_level: flavorLevelOrDefault(product?.oil_level),
    salt_level: flavorLevelOrDefault(product?.salt_level),
  }))
  const [customization, setCustomization] = useState(product?.customization ?? {
    spicy_level: false, oil_level: false, salt_level: false, min_weight_kg: null,
  })
  const [minimum, setMinimum] = useState(String(customization.min_weight_kg ?? ''))
  const hasCustomization = enabledFlavors(customization).length > 0
  const [visible, setVisible] = useState(product?.status ?? true)
  const [rows, setRows] = useState<VariantRow[]>(() => (product ? rowsFrom(product) : [newRow()]))
  const [keptImages, setKeptImages] = useState<string[]>(product?.product_imgs ?? [])
  const [newImages, setNewImages] = useState<NewImage[]>([])
  const [dragging, setDragging] = useState(false)
  // Files turned away when they were picked (wrong type, too big, too many).
  const [photoProblems, setPhotoProblems] = useState<string[]>([])
  // Messages show once the first save has been tried, then follow every change.
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // A new size's first field takes the focus once it's on screen.
  const [focusRow, setFocusRow] = useState<string | null>(null)
  // Where the admin was going when asked "Discard your changes?".
  const [leaveTo, setLeaveTo] = useState<string | null>(null)

  const category = categories.find((c) => c.category_id === categoryId)
  const subOptions = category?.sub_categories?.map((s) => s.name) ?? []
  const photoCount = keptImages.length + newImages.length

  // Unsaved changes: the form as it is now against the form as it opened.
  const snapshot = JSON.stringify([name, categoryId, subCategory, description, levels, customization, minimum, visible, rows, keptImages, newImages.map((i) => i.key)])
  const [initialSnapshot] = useState(snapshot)
  const dirty = snapshot !== initialSnapshot

  useEffect(() => {
    if (!dirty || saving) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])

  useEffect(() => {
    if (!focusRow) return
    document.getElementById(`size-${focusRow}`)?.focus()
  }, [focusRow])

  // Free the preview URLs when the form goes away (removing a single photo frees its own).
  const latestImages = useRef(newImages)
  useEffect(() => {
    latestImages.current = newImages
  }, [newImages])
  useEffect(() => () => latestImages.current.forEach((img) => URL.revokeObjectURL(img.preview)), [])

  const updateRow = (key: string, changes: Partial<VariantRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)))

  const addRow = () => {
    const row = newRow()
    setRows((rs) => [...rs, row])
    setFocusRow(row.key)
  }

  const removeRow = (key: string) => setRows((rs) => rs.filter((x) => x.key !== key))

  const addFiles = (files: FileList | File[]) => {
    const problems: string[] = []
    const accepted: NewImage[] = []
    let room = MAX_IMAGES - photoCount
    for (const file of Array.from(files)) {
      if (!IMAGE_TYPES.includes(file.type)) problems.push(`${file.name} isn't a JPEG, PNG or WebP image.`)
      else if (file.size > MAX_IMAGE_BYTES) problems.push(`${file.name} is larger than 5 MB.`)
      else if (room <= 0) problems.push(`${file.name} wasn't added: a product can have at most ${MAX_IMAGES} photos.`)
      else {
        accepted.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file) })
        room -= 1
      }
    }
    setNewImages((imgs) => [...imgs, ...accepted])
    setPhotoProblems(problems)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const validate = (): FormErrors => {
    const errors: FormErrors = { rows: {} }
    if (!name.trim()) errors.name = 'Enter the product name.'
    if (!categoryId) errors.category = 'Choose a category.'
    // Same rule as the backend: a category with sub-categories needs one of them chosen.
    else if (subOptions.length && !subOptions.includes(subCategory)) {
      errors.subCategory = subCategory
        ? `"${subCategory}" is no longer a sub-category of ${category?.category_name}. Choose one of its current sub-categories.`
        : `Choose a sub-category for ${category?.category_name}.`
    }
    if (!rows.length) errors.sizes = 'Add at least one size.'
    const names = new Set<string>()
    rows.forEach((r) => {
      const row: RowErrors = {}
      const size = r.variant_name.trim().toLowerCase()
      if (!size) row.size = r.unit === 'custom' ? 'Enter the size, e.g. 1 dozen.' : 'Enter the size, e.g. 500.'
      else if (names.has(size)) row.size = 'Another size already has this name.'
      names.add(size)
      if (!(Number(r.price) > 0)) row.price = 'Enter a price above ₹0.'
      if (r.stock_qty === '' || !Number.isInteger(Number(r.stock_qty)) || Number(r.stock_qty) < 0) row.stock = 'Enter a whole number, 0 or more.'
      if (Object.keys(row).length) errors.rows[r.key] = row
    })
    if (photoCount === 0) errors.photos = 'Add at least one photo.'
    if (hasCustomization && (!/^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(minimum) || !(Number(minimum) > 0 && Number.isFinite(Number(minimum))))) {
      errors.minimum = 'Enter a positive minimum in kg, with up to three decimal places.'
    }
    return errors
  }

  const errors: FormErrors = submitted ? validate() : { rows: {} }
  const problems = errorCount(errors)

  // The first field that needs fixing, brought into view with the focus on it.
  const focusFirstProblem = () =>
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      if (!field) return
      field.focus({ preventScroll: true })
      ;(field.closest('.pf-field, .pf-variant, .panel') ?? field).scrollIntoView({ block: 'center', behavior: 'smooth' })
    })

  const variantPayload = () =>
    rows.map((r) => ({
      variant_name: r.variant_name.trim(),
      price: Number(r.price),
      stock_qty: Number(r.stock_qty),
      weight_kg: shippingWeight(r),
      status: r.status,
      dimensions: r.dimensions,
    }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSubmitted(true)
    setServerError(null)
    if (errorCount(validate())) {
      focusFirstProblem()
      return
    }
    const form = new FormData()
    form.set('product_name', name.trim())
    form.set('category_id', categoryId)
    form.set('description', description.trim())
    for (const field of FLAVOR_FIELDS) {
      if (levels[field] !== product?.[field]) form.set(field, levels[field])
    }
    form.set('customization', JSON.stringify({ ...customization, min_weight_kg: hasCustomization ? Number(minimum) : null }))
    form.set('status', String(visible))
    newImages.forEach((img) => form.append(editing ? 'new_images' : 'images', img.file))

    if (!editing) {
      if (subCategory) form.set('sub_category', subCategory)
      form.set('variants', JSON.stringify(variantPayload()))
    } else {
      // Only send the sub-category when it changed, so an untouched product isn't rewritten.
      if (subCategory !== (product.sub_category ?? '') || categoryId !== product.category_id) form.set('sub_category', subCategory)
      // Sizes are matched by name: every current row is (re)saved, and names that disappeared are removed.
      const current = new Set(rows.map((r) => r.variant_name.trim()))
      form.set('add_variants', JSON.stringify(variantPayload()))
      form.set('remove_variants', JSON.stringify(product.variants.map((v) => v.variant_name).filter((n) => !current.has(n))))
      const removed = (product.product_imgs ?? []).filter((u) => !keptImages.includes(u))
      if (removed.length) form.set('remove_images', JSON.stringify(removed))
    }

    setSaving(true)
    try {
      if (editing) {
        await updateProduct(product.product_id, form)
        navigate(panel('/admin/products'), { state: { toast: `${name.trim()} was updated.` } })
      } else {
        await createProduct(form)
        navigate(panel('/admin/products'), { state: { toast: `${name.trim()} was added to your store.` } })
      }
    } catch (err) {
      setServerError((err as Error).message)
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Leaving by a link on this page with unsaved changes asks first. (Closing or reloading the tab
  // gets the browser's own question, from the beforeunload handler above.)
  const guardLeave = (to: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!dirty || saving) return
    e.preventDefault()
    setLeaveTo(to)
  }

  const productsPath = panel('/admin/products')
  const categoriesPath = panel('/admin/categories')
  const savingLabel = newImages.length ? `Uploading ${newImages.length === 1 ? '1 photo' : `${newImages.length} photos`}…` : 'Saving…'

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="product-form">
      <nav className="pf-crumbs" aria-label="Breadcrumb">
        <Link to={productsPath} onClick={guardLeave(productsPath)}>Products</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{editing ? product.product_name : 'Add product'}</span>
      </nav>
      <AdminPageHead
        title={editing ? `Edit ${product.product_name}` : 'Add product'}
        subtitle={needsApproval ? 'Your submission will be reviewed by an admin before it appears in the store.' : editing ? 'Changes show in the store as soon as you save.' : 'Name it, set its sizes and prices, and add photos.'}
        stickyActions
        actions={
          <>
            <Link to={productsPath} className="admin-button admin-button--ghost" onClick={guardLeave(productsPath)}>Cancel</Link>
            <button type="submit" className="admin-button pf-submit" disabled={saving} aria-busy={saving || undefined}>
              {saving && <SpinnerIcon size={16} className="admin-spin" />}
              {saving ? savingLabel : needsApproval ? 'Submit for approval' : editing ? 'Save changes' : 'Add product'}
            </button>
          </>
        }
      />

      {serverError ? (
        <div className="pf-alert" role="alert">
          <AlertIcon size={20} />
          <div>
            <strong>{editing ? "Your changes weren't saved" : "The product wasn't added"}</strong>
            <p>{serverError}</p>
          </div>
        </div>
      ) : problems > 0 && (
        <div className="pf-alert" role="alert">
          <AlertIcon size={20} />
          <div>
            <strong>{problems === 1 ? '1 thing needs' : `${problems} things need`} fixing</strong>
            <p>Check the highlighted fields below, then {editing ? 'save again' : 'add the product again'}.</p>
          </div>
        </div>
      )}

      <fieldset className="pf-columns" disabled={saving}>
        <legend className="visually-hidden">Product</legend>
        <div className="pf-main">
          <Panel title="Product details">
            <div className="pf-field">
              <div className="pf-field__top">
                <label htmlFor="p-name" className="admin-label">Product name</label>
                <span className="pf-counter" aria-hidden>{name.length}/200</span>
              </div>
              <input id="p-name" className="admin-input" maxLength={200} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sona Masoori Rice" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'p-name-error' : undefined} />
              <FieldError id="p-name-error" message={errors.name} />
            </div>
            <div className="pf-field">
              <label htmlFor="p-desc" className="admin-label">Description <span className="pf-optional">(optional)</span></label>
              <textarea id="p-desc" className="admin-input pf-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Where it's from, how it's grown or made, what's in it and how to store it." />
            </div>
          </Panel>

          <Panel title="Flavour and customization">
            {FLAVOR_FIELDS.map((field) => (
              <div className="pf-field pf-flavor" key={field}>
                <FlavorLevelOptions field={field} value={levels[field]}
                  onChange={(level) => setLevels((current) => ({ ...current, [field]: level }))} />
                <div className="switch-row">
                  <Switch checked={customization[field]} label={`Allow ${FLAVOR_LABELS[field].toLowerCase()} customization`}
                    onChange={(on) => setCustomization((current) => ({ ...current, [field]: on }))} />
                  <span>Allow customization</span>
                </div>
              </div>
            ))}
            {hasCustomization && (
              <div className="pf-field">
                <label htmlFor="p-customization-minimum" className="admin-label">Minimum quantity for customization (kg)</label>
                <input id="p-customization-minimum" className="admin-input" inputMode="decimal" placeholder="1.5" value={minimum}
                  onChange={(e) => setMinimum(e.target.value)} aria-invalid={!!errors.minimum}
                  aria-describedby={errors.minimum ? 'p-customization-error' : 'p-customization-hint'} />
                <FieldError id="p-customization-error" message={errors.minimum} />
                <p className="admin-hint" id="p-customization-hint">All pack sizes of this product count toward the minimum.</p>
              </div>
            )}
          </Panel>

          <Panel title="Sizes & pricing" actions={
            <button type="button" className="admin-button admin-button--ghost pf-add" onClick={addRow}>
              <PlusIcon size={16} /> Add size
            </button>
          }>
            <p className="admin-hint">Each size has its own price and stock. Turn off <em>For sale</em> to pause a size without deleting it.</p>
            <div className="pf-variants-wrap">
              <div className="pf-variants">
                <div className="pf-variants__head" aria-hidden>
                  <span>Size</span><span>Price</span><span>Stock</span><span>For sale</span><span />
                </div>
                {rows.map((r, i) => {
                  const rowErrors = errors.rows[r.key] ?? {}
                  const title = r.variant_name.trim() || `Size ${i + 1}`
                  const saved = product?.variants.some((v) => v.variant_name === r.key)
                  const onlyOne = rows.length === 1
                  return (
                    <fieldset key={r.key} className={`pf-variant${r.status ? '' : ' is-paused'}`}>
                      <legend className="visually-hidden">Size {i + 1}</legend>
                      <p className="pf-variant__title" aria-hidden>{title}</p>

                      <div className="pf-cell pf-cell--size">
                        <label className="pf-cell__label" htmlFor={`size-${r.key}`}>Size</label>
                        <div className="size-input">
                          {r.unit === 'custom' ? (
                            <input id={`size-${r.key}`} className="admin-input" value={r.variant_name} placeholder="1 dozen"
                              aria-invalid={!!rowErrors.size} aria-describedby={rowErrors.size ? `size-${r.key}-error` : undefined}
                              onChange={(e) => updateRow(r.key, { variant_name: e.target.value })} />
                          ) : (
                            <input id={`size-${r.key}`} className="admin-input" inputMode="decimal" value={r.amount} placeholder="500"
                              aria-invalid={!!rowErrors.size} aria-describedby={rowErrors.size ? `size-${r.key}-error` : undefined}
                              onChange={(e) => {
                                const amount = e.target.value.replace(/[^\d.]/g, '')
                                updateRow(r.key, { amount, variant_name: sizeName(amount, r.unit) })
                              }} />
                          )}
                          <select className="admin-input size-input__unit" aria-label={`Unit for size ${i + 1}`} value={r.unit}
                            onChange={(e) => {
                              const unit = e.target.value as Unit
                              // Switching to custom keeps what was there as editable text.
                              updateRow(r.key, unit === 'custom' ? { unit } : { unit, variant_name: sizeName(r.amount, unit) })
                            }}>
                            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <FieldError id={`size-${r.key}-error`} message={rowErrors.size} />
                      </div>

                      <div className="pf-cell pf-cell--price">
                        <label className="pf-cell__label" htmlFor={`price-${r.key}`}>Price</label>
                        <div className="pf-affix">
                          <span className="pf-affix__text" aria-hidden>₹</span>
                          <input id={`price-${r.key}`} className="admin-input" inputMode="decimal" value={r.price} placeholder="120"
                            aria-label={`Price of ${title} in rupees`}
                            aria-invalid={!!rowErrors.price} aria-describedby={rowErrors.price ? `price-${r.key}-error` : undefined}
                            onChange={(e) => updateRow(r.key, { price: e.target.value.replace(/[^\d.]/g, '') })} />
                        </div>
                        <FieldError id={`price-${r.key}-error`} message={rowErrors.price} />
                      </div>

                      <div className="pf-cell pf-cell--stock">
                        <label className="pf-cell__label" htmlFor={`stock-${r.key}`}>Stock</label>
                        <input id={`stock-${r.key}`} className="admin-input" inputMode="numeric" value={r.stock_qty} placeholder="50"
                          aria-label={`Stock of ${title}`}
                          aria-invalid={!!rowErrors.stock} aria-describedby={rowErrors.stock ? `stock-${r.key}-error` : undefined}
                          onChange={(e) => updateRow(r.key, { stock_qty: e.target.value.replace(/\D/g, '') })} />
                        <FieldError id={`stock-${r.key}-error`} message={rowErrors.stock} />
                      </div>

                      <div className="pf-cell pf-cell--sale">
                        <span className="pf-cell__label" aria-hidden>For sale</span>
                        <div className="pf-sale">
                          <Switch checked={r.status} onChange={(v) => updateRow(r.key, { status: v })} label={`Sell ${title}`} />
                          <span className="pf-sale__state" aria-hidden>{r.status ? 'On sale' : 'Paused'}</span>
                        </div>
                      </div>

                      <div className="pf-cell pf-cell--remove">
                        {saved ? (
                          <ConfirmButton label={onlyOne ? 'A product needs at least one size' : `Remove ${r.key}`} icon={<DeleteIcon />} disabled={onlyOne}
                            className="admin-icon-button admin-icon-button--danger"
                            onConfirm={() => removeRow(r.key)}
                            confirm={{
                              title: `Remove the ${r.key} size?`,
                              message: <p>Shoppers can't buy this size once you save the product.</p>,
                              confirmLabel: 'Remove size',
                            }} />
                        ) : (
                          <button type="button" className="admin-icon-button admin-icon-button--danger" disabled={onlyOne}
                            onClick={() => removeRow(r.key)} aria-label={`Remove ${title}`}
                            title={onlyOne ? 'A product needs at least one size' : 'Remove size'}>
                            <DeleteIcon />
                          </button>
                        )}
                      </div>
                    </fieldset>
                  )
                })}
              </div>
            </div>
            <FieldError id="p-sizes-error" message={errors.sizes} />
          </Panel>

          <Panel title="Photos" actions={<span className="pf-count">{photoCount} of {MAX_IMAGES}</span>}>
            <div
              className={`pf-photos${dragging ? ' is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (photoCount < MAX_IMAGES) setDragging(true) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
              onDrop={onDrop}
            >
              {photoCount === 0 ? (
                <label className={`pf-drop${errors.photos ? ' is-invalid' : ''}`}>
                  <span className="pf-drop__icon"><UploadIcon size={24} /></span>
                  <span className="pf-drop__title">Drag product photos here</span>
                  <span className="pf-drop__or">or</span>
                  <span className="admin-button admin-button--ghost pf-drop__browse">Browse files</span>
                  <span className="pf-drop__meta">JPEG, PNG or WebP · up to 5 MB each · up to {MAX_IMAGES} photos</span>
                  <PhotoInput onFiles={addFiles} invalid={!!errors.photos} />
                </label>
              ) : (
                <>
                  <p className="admin-hint">The first photo is the cover shoppers see on product cards and at the top of the product page.</p>
                  <ul className="pf-thumbs">
                    {keptImages.map((url, i) => (
                      <li key={url} className="pf-thumb">
                        <img src={url} alt={`Photo ${i + 1}`} />
                        {i === 0 && <span className="pf-thumb__badge">Cover</span>}
                        <ConfirmButton label={`Remove photo ${i + 1}`} icon={<CloseIcon size={16} />} className="pf-thumb__remove"
                          onConfirm={() => setKeptImages((k) => k.filter((u) => u !== url))}
                          confirm={{
                            title: `Remove photo ${i + 1}?`,
                            message: <p>The photo is deleted from the product when you save it.{i === 0 ? ' The next photo becomes the cover.' : ''}</p>,
                            confirmLabel: 'Remove photo',
                          }} />
                      </li>
                    ))}
                    {newImages.map((img, i) => (
                      <li key={img.key} className="pf-thumb">
                        <img src={img.preview} alt={img.file.name} />
                        {keptImages.length === 0 && i === 0 && <span className="pf-thumb__badge">Cover</span>}
                        {/* Uploaded together with the product when it's saved, not before. */}
                        <span className="pf-thumb__badge pf-thumb__badge--new">Not saved yet</span>
                        <button type="button" className="pf-thumb__remove" aria-label={`Remove ${img.file.name}`} title="Remove photo"
                          onClick={() => { URL.revokeObjectURL(img.preview); setNewImages((n) => n.filter((x) => x.key !== img.key)) }}>
                          <CloseIcon size={16} />
                        </button>
                      </li>
                    ))}
                    {photoCount < MAX_IMAGES && (
                      <li>
                        <label className="pf-drop pf-drop--tile">
                          <ImageIcon size={22} />
                          <span className="pf-drop__title">Add photos</span>
                          <span className="pf-drop__meta">or drop them here</span>
                          <PhotoInput onFiles={addFiles} />
                        </label>
                      </li>
                    )}
                  </ul>
                  {photoCount >= MAX_IMAGES && <p className="admin-hint admin-hint--tight">That's the most photos a product can have. Remove one to add another.</p>}
                </>
              )}
            </div>
            <FieldError id="p-photos-error" message={errors.photos} />
            {photoProblems.length > 0 && (
              <ul className="pf-problems" role="alert">
                {photoProblems.map((m) => <li key={m}><AlertIcon size={16} />{m}</li>)}
              </ul>
            )}
          </Panel>
        </div>

        <div className="pf-side">
          <Panel title="Visibility">
            <div className={`pf-visibility${visible ? ' is-on' : ''}`}>
              <span className="pf-visibility__icon" aria-hidden>{visible ? <EyeIcon /> : <EyeOffIcon />}</span>
              <div className="pf-visibility__text">
                <p className="pf-visibility__state">{visible ? 'Shown in the store' : 'Hidden from the store'}</p>
                <p className="pf-visibility__hint">{needsApproval ? 'This visibility applies after admin approval.' : visible ? 'Shoppers can find and buy it.' : 'Only the admin panel shows it until you turn this on.'}</p>
              </div>
              <Switch checked={visible} onChange={setVisible} label="Show in the store" />
            </div>
          </Panel>

          <Panel title="Organisation">
            <div className="pf-field">
              <label htmlFor="p-cat" className="admin-label">Category</label>
              <select id="p-cat" className="admin-input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubCategory('') }}
                aria-invalid={!!errors.category} aria-describedby={errors.category ? 'p-cat-error' : undefined}>
                <option value="">Choose a category</option>
                {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
              <FieldError id="p-cat-error" message={errors.category} />
            </div>
            <div className="pf-field">
              <label htmlFor="p-sub" className="admin-label">Sub-category</label>
              <select id="p-sub" className="admin-input" value={subOptions.includes(subCategory) ? subCategory : ''}
                onChange={(e) => setSubCategory(e.target.value)} disabled={!subOptions.length} required={subOptions.length > 0}
                aria-invalid={!!errors.subCategory}
                aria-describedby={errors.subCategory ? 'p-sub-error' : subOptions.length ? 'p-sub-hint' : undefined}>
                <option value="" disabled={subOptions.length > 0}>
                  {!categoryId ? 'Choose a category first' : subOptions.length ? 'Choose a sub-category' : 'This category has no sub-categories'}
                </option>
                {subOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
              {errors.subCategory
                ? <FieldError id="p-sub-error" message={errors.subCategory} />
                : subOptions.length > 0 && <p id="p-sub-hint" className="admin-hint admin-hint--tight">Required: {category?.category_name} is split into sub-categories.</p>}
            </div>
            <Link to={categoriesPath} className="pf-manage" onClick={guardLeave(categoriesPath)}>Manage categories</Link>
          </Panel>
        </div>
      </fieldset>

      <ConfirmDialog
        open={leaveTo !== null}
        title="Discard your changes?"
        message={<p>{editing ? "Your changes to this product haven't" : "This product hasn't"} been saved. If you leave now, what you've entered is lost.</p>}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => { if (leaveTo) navigate(leaveTo) }}
        onCancel={() => setLeaveTo(null)}
      />
    </form>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="pf-error"><AlertIcon size={14} />{message}</p>
}

// The hidden file picker inside a drop area; picking the same file again still counts.
function PhotoInput({ onFiles, invalid }: { onFiles: (files: FileList) => void; invalid?: boolean }) {
  return (
    <input type="file" accept={IMAGE_TYPES.join(',')} multiple className="visually-hidden"
      aria-invalid={invalid || undefined} aria-describedby={invalid ? 'p-photos-error' : undefined}
      onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }} />
  )
}
