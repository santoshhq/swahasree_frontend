import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { Funnel, X } from 'lucide-react'
import { isShownInStore } from '../lib/api'
import { money } from '../lib/format'
import type { ListingQuery, Product, ProductPage, SortOption, Variant } from '../lib/types'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { useFetch } from '../lib/useFetch'
import { useMediaQuery } from '../lib/useMediaQuery'
import { ProductCard } from './ProductCard'
import { EmptyState, ErrorState, Loading } from './ui'

const PAGE_SIZE = 24
const MULTI_FILTERS = ['category', 'stock', 'size'] as const

type FacetKey = typeof MULTI_FILTERS[number]
type FilterDraft = { min: string; max: string; category: string[]; stock: string[]; size: string[] }
type FacetOption = { value: string; label: string; count: number }
type PriceRange = { min: number; max: number }
type ListingItem = { product: Product; variants?: Variant[] }

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  price_low_to_high: 'Price: low to high',
  price_high_to_low: 'Price: high to low',
  name: 'Name: A to Z',
}

const emptyDraft = (): FilterDraft => ({ min: '', max: '', category: [], stock: [], size: [] })
const paramsToDraft = (params: URLSearchParams): FilterDraft => ({
  min: params.get('min') ?? '',
  max: params.get('max') ?? '',
  category: params.getAll('category'),
  stock: params.getAll('stock'),
  size: params.getAll('size'),
})

function matchingProducts(products: Product[], filters: FilterDraft) {
  return products.filter((product) =>
    (!filters.category.length || filters.category.includes(product.category_id)) &&
    (!filters.stock.length || filters.stock.includes(product.in_stock ? 'in' : 'out')) &&
    (!filters.size.length || product.variants.some((variant) => filters.size.includes(variant.variant_name)))
  )
}

function FilterContents({
  products,
  filters,
  onChange,
}: {
  products: Product[]
  filters: FilterDraft
  onChange: (key: FacetKey, value: string, checked: boolean) => void
}) {
  const categories = useMemo(() => {
    const values = new Map<string, FacetOption>()
    for (const product of products) {
      const current = values.get(product.category_id)
      values.set(product.category_id, {
        value: product.category_id,
        label: product.category_name,
        count: (current?.count ?? 0) + 1,
      })
    }
    return [...values.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [products])

  const sizes = useMemo(() => {
    const values = new Map<string, FacetOption>()
    for (const product of products) {
      for (const variantName of new Set(product.variants.map((variant) => variant.variant_name))) {
        const current = values.get(variantName)
        values.set(variantName, {
          value: variantName,
          label: variantName,
          count: (current?.count ?? 0) + 1,
        })
      }
    }
    return [...values.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  }, [products])

  const availability: FacetOption[] = [
    { value: 'in', label: 'In stock', count: products.filter((product) => product.in_stock).length },
    { value: 'out', label: 'Out of stock', count: products.filter((product) => !product.in_stock).length },
  ]

  return (
    <>
      <fieldset className="listing-filter-section">
        <legend>Availability</legend>
        {availability.map((option) => (
          <label className="listing-filter-option" key={option.value}>
            <input type="checkbox" checked={filters.stock.includes(option.value)} onChange={(event) => onChange('stock', option.value, event.target.checked)} />
            <span>{option.label}</span><small>{option.count}</small>
          </label>
        ))}
      </fieldset>
      {categories.length > 1 && (
        <fieldset className="listing-filter-section">
          <legend>Categories</legend>
          {categories.map((option) => (
            <label className="listing-filter-option" key={option.value}>
              <input type="checkbox" checked={filters.category.includes(option.value)} onChange={(event) => onChange('category', option.value, event.target.checked)} />
              <span>{option.label}</span><small>{option.count}</small>
            </label>
          ))}
        </fieldset>
      )}
      {sizes.length > 0 && (
        <fieldset className="listing-filter-section">
          <legend>Size / quantity</legend>
          {sizes.map((option) => (
            <label className="listing-filter-option" key={option.value}>
              <input type="checkbox" checked={filters.size.includes(option.value)} onChange={(event) => onChange('size', option.value, event.target.checked)} />
              <span>{option.label}</span><small>{option.count}</small>
            </label>
          ))}
        </fieldset>
      )}
    </>
  )
}

function PriceRangeFilter({
  bounds,
  value,
  onChange,
  onReset,
  active,
  count,
}: {
  bounds: PriceRange
  // null means the whole range, so a category change naturally starts wide open.
  value: PriceRange | null
  onChange: (next: PriceRange) => void
  onReset: () => void
  active: boolean
  count: number
}) {
  const hintId = useId()
  const range = value
    ? {
        min: Math.max(bounds.min, Math.min(value.min, bounds.max)),
        max: Math.min(bounds.max, Math.max(value.max, bounds.min)),
      }
    : bounds
  // A single-priced selection still needs a legal (min < max) range for the two inputs.
  const sliderMax = Math.max(bounds.max, bounds.min + 1)
  const span = sliderMax - bounds.min
  const startPercent = ((range.min - bounds.min) / span) * 100
  const endPercent = ((range.max - bounds.min) / span) * 100
  const disabled = bounds.min >= bounds.max

  return (
    <fieldset className="listing-filter-section listing-price-filter" aria-describedby={hintId}>
      <legend>Price range</legend>
      <div className="listing-price-filter__head">
        <p className="listing-price-filter__values" aria-live="polite">
          <span>{money(range.min)}</span>
          <span className="listing-price-filter__dash" aria-hidden>–</span>
          <span>{money(range.max)}</span>
        </p>
        <button type="button" className="listing-price-filter__reset" onClick={onReset} disabled={!active}>Reset</button>
      </div>
      <div
        className="listing-price-range"
        style={{ '--range-start': `${startPercent}%`, '--range-end': `${endPercent}%` } as CSSProperties}
      >
        <input
          className="listing-price-range__slider listing-price-range__slider--min"
          type="range"
          min={bounds.min}
          max={sliderMax}
          step={1}
          value={range.min}
          disabled={disabled}
          aria-label="Minimum price"
          aria-valuetext={money(range.min)}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), range.max)
            onChange({ min: next, max: range.max })
          }}
        />
        <input
          className="listing-price-range__slider listing-price-range__slider--max"
          type="range"
          min={bounds.min}
          max={sliderMax}
          step={1}
          value={range.max}
          disabled={disabled}
          aria-label="Maximum price"
          aria-valuetext={money(range.max)}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), range.min)
            onChange({ min: range.min, max: next })
          }}
        />
      </div>
      <p id={hintId} className="listing-filter-price__hint">
        Only sizes inside this range stay on the cards. Use the arrow keys for fine steps.
      </p>
      <p className="listing-price-filter__count" aria-live="polite">
        Showing {count} {count === 1 ? 'product' : 'products'}
      </p>
    </fieldset>
  )
}

function PriceFilter({
  initialMin,
  initialMax,
  priceCeiling,
  onChange,
  onApply,
  mobile = false,
}: {
  initialMin: string
  initialMax: string
  priceCeiling: number
  onChange?: (min: string, max: string) => void
  onApply?: (min: string, max: string) => void
  mobile?: boolean
}) {
  const [values, setValues] = useState(() => ({ min: initialMin, max: initialMax }))
  const rangeMin = Math.min(Number(values.min) || 0, priceCeiling)
  const rangeMax = Math.max(rangeMin, Math.min(Number(values.max) || priceCeiling, priceCeiling))
  const rangeMinPercent = (rangeMin / priceCeiling) * 100
  const rangeMaxPercent = (rangeMax / priceCeiling) * 100
  const setValue = (key: 'min' | 'max', value: string) => {
    const next = { ...values, [key]: value }
    setValues(next)
    onChange?.(next.min, next.max)
  }
  return (
    <form
      className="listing-filter-price"
      onSubmit={(event) => {
        event.preventDefault()
        if (!mobile) onApply?.(values.min, values.max)
      }}
    >
      <fieldset className="listing-filter-section">
        <legend>Price</legend>
        <p className="listing-filter-price__hint">Set a minimum and maximum price.</p>
        <div className="listing-price-range" style={{ '--range-start': `${rangeMinPercent}%`, '--range-end': `${rangeMaxPercent}%` } as CSSProperties}>
          <input className="listing-price-range__slider listing-price-range__slider--min" type="range" min="0" max={priceCeiling} step="1" value={rangeMin} aria-label="Minimum price slider" onChange={(event) => {
            const value = Math.min(Number(event.target.value), rangeMax)
            setValue('min', value ? String(value) : '')
          }} />
          <input className="listing-price-range__slider listing-price-range__slider--max" type="range" min="0" max={priceCeiling} step="1" value={rangeMax} aria-label="Maximum price slider" onChange={(event) => {
            const value = Math.max(Number(event.target.value), rangeMin)
            setValue('max', value < priceCeiling ? String(value) : '')
          }} />
        </div>
        <div className="listing-filter-price__inputs">
          <label><span>Minimum</span><span className="listing-filter-price__field"><span aria-hidden>₹</span><input inputMode="numeric" aria-label="Minimum price" placeholder="0" value={values.min} onChange={(event) => setValue('min', event.target.value.replace(/[^\d]/g, ''))} /></span></label>
          <span className="listing-filter-price__dash" aria-hidden>–</span>
          <label><span>Maximum</span><span className="listing-filter-price__field"><span aria-hidden>₹</span><input inputMode="numeric" aria-label="Maximum price" placeholder={`${priceCeiling}+`} value={values.max} onChange={(event) => setValue('max', event.target.value.replace(/[^\d]/g, ''))} /></span></label>
        </div>
        {!mobile && <button type="submit" className="listing-filter-price__apply">Apply price</button>}
      </fieldset>
    </form>
  )
}

/** Shared listing filters: server-backed URL filters plus page-local product facets. */
export function ProductListing({
  load,
  cacheKey,
  emptyTitle = 'Nothing here yet',
}: {
  load: (q: ListingQuery, signal: AbortSignal) => Promise<ProductPage>
  cacheKey: string
  emptyTitle?: string
}) {
  const [params, setParams] = useSearchParams()
  const sort = (params.get('sort') as SortOption | null) ?? 'newest'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const search = params.get('search') ?? ''
  const appliedFilters = useMemo(() => paramsToDraft(params), [params])
  const serverFilterParams = new URLSearchParams()
  for (const key of ['search', 'sort', 'min', 'max', 'page']) {
    const value = params.get(key)
    if (value) serverFilterParams.set(key, value)
  }
  const q: ListingQuery = {
    sort,
    search: search || undefined,
    min_price: appliedFilters.min ? Number(appliedFilters.min) : undefined,
    max_price: appliedFilters.max ? Number(appliedFilters.max) : undefined,
    skip: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  }
  const result = useFetch((signal) => load(q, signal), `${cacheKey}|${serverFilterParams.toString()}`)

  const updateParams = (mutate: (next: URLSearchParams) => void, resetPage = true) => {
    const next = new URLSearchParams(params)
    mutate(next)
    if (resetPage) next.delete('page')
    setParams(next)
  }
  const updatePrice = (minValue: string, maxValue: string) => updateParams((next) => {
    if (minValue) next.set('min', minValue)
    else next.delete('min')
    if (maxValue) next.set('max', maxValue)
    else next.delete('max')
  })
  const commitFilters = (filters: FilterDraft) => updateParams((next) => {
    for (const key of ['min', 'max', ...MULTI_FILTERS]) next.delete(key)
    if (filters.min.trim()) next.set('min', filters.min.trim())
    if (filters.max.trim()) next.set('max', filters.max.trim())
    for (const key of MULTI_FILTERS) for (const value of filters[key]) next.append(key, value)
  })
  const commitFacets = (filters: FilterDraft) => updateParams((next) => {
    for (const key of MULTI_FILTERS) next.delete(key)
    for (const key of MULTI_FILTERS) for (const value of filters[key]) next.append(key, value)
  })
  const toggleFilter = (source: FilterDraft, key: FacetKey, value: string, checked: boolean) => {
    const current = source[key]
    const values = checked ? [...new Set([...current, value])] : current.filter((item) => item !== value)
    return { ...source, [key]: values }
  }

  const [filterOpen, setFilterOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(emptyDraft)
  // Remounts the mobile price fields when the draft is reset from outside them (Clear all).
  const [priceSession, setPriceSession] = useState(0)
  // Desktop-only, variant-aware price range. It stays out of the URL and the server query, so the
  // API never drops a product whose cheapest size is below the chosen range (see below).
  // Storing the selection alongside the draft resets it when the category changes, without an effect.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const selectionKey = `${cacheKey}|${[...appliedFilters.category].sort().join(',')}`
  const [priceState, setPriceState] = useState<{ selection: string; draft: PriceRange | null }>({ selection: selectionKey, draft: null })
  // A different category or category facet starts the slider wide open, and the old draft is dropped
  // (not just hidden), so switching back does not bring the previous range along.
  if (priceState.selection !== selectionKey) {
    setPriceState({ selection: selectionKey, draft: null })
  }
  const priceDraft = priceState.selection === selectionKey ? priceState.draft : null
  const setPriceDraft = (draft: PriceRange | null) => setPriceState({ selection: selectionKey, draft })
  const debouncedPriceDraft = useDebouncedValue(priceDraft, 250)
  const appliedPriceRange = isDesktop && priceDraft !== null ? debouncedPriceDraft : null
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const focusReturnRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!filterOpen) return
    const previousOverflow = document.body.style.overflow
    const returnFocusTo = focusReturnRef.current
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false)
      if (event.key === 'Tab') {
        const focusable = document.querySelectorAll<HTMLElement>('.listing-filter-drawer button, .listing-filter-drawer input')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusTo?.focus()
    }
  }, [filterOpen])

  const openFilters = (event: MouseEvent<HTMLButtonElement>) => {
    focusReturnRef.current = event.currentTarget
    setDraft(paramsToDraft(params))
    setPriceSession((session) => session + 1)
    setFilterOpen(true)
  }
  const setDraftPrice = (min: string, max: string) => setDraft((current) => ({ ...current, min, max }))
  const changeDraftFacet = (key: FacetKey, value: string, checked: boolean) => setDraft((current) => toggleFilter(current, key, value, checked))
  const applyMobileFilters = () => {
    commitFilters(draft)
    setFilterOpen(false)
  }
  const clearAll = () => {
    const cleared = emptyDraft()
    setDraft(cleared)
    setPriceSession((session) => session + 1)
    setPriceDraft(null)
    commitFilters(cleared)
  }
  const setDesktopFacet = (key: FacetKey, value: string, checked: boolean) => commitFacets(toggleFilter(appliedFilters, key, value, checked))

  const data = result.data
  const pageProducts = useMemo(() => data ? data.products.filter(isShownInStore) : [], [data])
  const priceBounds = useMemo<PriceRange>(() => {
    let low = Number.POSITIVE_INFINITY
    let high = Number.NEGATIVE_INFINITY
    for (const product of pageProducts) {
      for (const variant of product.variants) {
        low = Math.min(low, variant.price)
        high = Math.max(high, variant.price)
      }
    }
    if (!Number.isFinite(low) || !Number.isFinite(high)) return { min: 0, max: 0 }
    // Slider steps are whole rupees; widening to the rupee keeps every variant inside the full range.
    return { min: Math.floor(low), max: Math.ceil(high) }
  }, [pageProducts])
  const activePriceRange = useMemo(() => {
    if (!appliedPriceRange) return null
    return {
      min: Math.max(priceBounds.min, Math.min(appliedPriceRange.min, priceBounds.max)),
      max: Math.min(priceBounds.max, Math.max(appliedPriceRange.max, priceBounds.min)),
    }
  }, [appliedPriceRange, priceBounds])
  const priceActive = Boolean(activePriceRange && (activePriceRange.min > priceBounds.min || activePriceRange.max < priceBounds.max))
  const filteredProducts = useMemo<ListingItem[]>(() => {
    const matched = matchingProducts(pageProducts, appliedFilters)
    // No price range: hand every variant back untouched, exactly as the card always did.
    if (!priceActive || !activePriceRange) return matched.map((product) => ({ product }))
    return matched.flatMap((product) => {
      const variants = product.variants
        .filter((variant) => variant.price >= activePriceRange.min && variant.price <= activePriceRange.max)
        // Cheapest first, so the card's default size and displayed price are inside the range.
        .sort((a, b) => a.price - b.price)
      return variants.length ? [{ product, variants }] : []
    })
  }, [pageProducts, appliedFilters, priceActive, activePriceRange])
  const priceCeiling = Math.max(1, ...pageProducts.flatMap((product) => [product.min_price ?? 0, ...product.variants.map((variant) => variant.price)]))
  const activeFacetCount = MULTI_FILTERS.reduce((count, key) => count + appliedFilters[key].length, 0) + Number(Boolean(appliedFilters.min || appliedFilters.max)) + Number(priceActive)
  const pages = data ? Math.ceil(data.total / PAGE_SIZE) : 0
  const categories = new Map(pageProducts.map((product) => [product.category_id, product.category_name]))
  const selectedChips: { key: string; label: string; remove: () => void }[] = []
  for (const categoryId of appliedFilters.category) selectedChips.push({
    key: `category:${categoryId}`,
    label: categories.get(categoryId) ?? categoryId,
    remove: () => setDesktopFacet('category', categoryId, false),
  })
  for (const stock of appliedFilters.stock) selectedChips.push({
    key: `stock:${stock}`,
    label: stock === 'in' ? 'In stock' : 'Out of stock',
    remove: () => setDesktopFacet('stock', stock, false),
  })
  for (const size of appliedFilters.size) selectedChips.push({
    key: `size:${size}`,
    label: size,
    remove: () => setDesktopFacet('size', size, false),
  })
  if (appliedFilters.min || appliedFilters.max) selectedChips.push({
    key: 'price',
    label: `${appliedFilters.min ? money(Number(appliedFilters.min)) : '₹0'} – ${appliedFilters.max ? money(Number(appliedFilters.max)) : 'Any price'}`,
    remove: () => updatePrice('', ''),
  })
  if (priceActive && activePriceRange) selectedChips.push({
    key: 'price-range',
    label: `${money(activePriceRange.min)} – ${money(activePriceRange.max)}`,
    remove: () => setPriceDraft(null),
  })
  const countLabel = activeFacetCount
    ? `${filteredProducts.length} ${filteredProducts.length === 1 ? 'product' : 'products'} on this page${data ? ` · ${data.total} total` : ''}`
    : `${data?.total ?? 0} ${(data?.total ?? 0) === 1 ? 'product' : 'products'}${search ? ` for “${search}”` : ''}`

  const filterPanel = (mobile: boolean) => (
    <div className={`listing-filter-content${mobile ? ' listing-filter-content--drawer' : ''}`}>
      <div className="listing-filter-content__heading"><h2>{mobile ? 'Filter' : 'Filters'}</h2>{activeFacetCount > 0 && <button type="button" onClick={clearAll}>Clear all</button>}</div>
      {mobile ? (
        <PriceFilter
          key={`mobile-${priceSession}`}
          initialMin={draft.min}
          initialMax={draft.max}
          priceCeiling={priceCeiling}
          onChange={setDraftPrice}
          mobile
        />
      ) : (
        <PriceRangeFilter
          bounds={priceBounds}
          value={priceDraft}
          onChange={setPriceDraft}
          onReset={() => setPriceDraft(null)}
          active={priceActive}
          count={filteredProducts.length}
        />
      )}
      <FilterContents products={pageProducts} filters={mobile ? draft : appliedFilters} onChange={mobile ? changeDraftFacet : setDesktopFacet} />
      <p className="listing-filter-footnote">Availability, category and size counts reflect products on this page.</p>
    </div>
  )

  return (
    <div className="listing-layout">
      <aside className="listing-sidebar" aria-label="Product filters">{filterPanel(false)}</aside>
      <div className="listing">
        <div className="listing__controls">
          <button type="button" className="mobile-filter-trigger" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={openFilters}>
            <Funnel size={18} strokeWidth={1.9} aria-hidden /><span>Filter</span>
            {activeFacetCount > 0 && <span className="mobile-filter-count" aria-label={`${activeFacetCount} active filters`}>{activeFacetCount}</span>}
          </button>
          <p className="listing__count" aria-live="polite">{data ? countLabel : ' '}</p>
          <label className="sort">
            <span>Sort</span>
            <select value={sort} onChange={(event) => updateParams((next) => {
              if (event.target.value === 'newest') next.delete('sort')
              else next.set('sort', event.target.value)
            })}>
              {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {selectedChips.length > 0 && (
          <div className="listing-applied" aria-label="Applied filters">
            <div className="listing-applied__chips">
              {selectedChips.map((chip) => <button type="button" className="listing-applied__chip" key={chip.key} onClick={chip.remove}>{chip.label}<X size={14} aria-hidden /></button>)}
            </div>
            <button type="button" className="listing-applied__clear" onClick={() => clearAll()}>Clear all</button>
          </div>
        )}

        {filterOpen && createPortal(
          <div className="listing-filter-overlay" role="presentation">
            <button type="button" className="listing-filter-scrim" aria-label="Close filters" onClick={() => setFilterOpen(false)} />
            <section className="listing-filter-drawer" role="dialog" aria-modal="true" aria-labelledby="listing-filter-title">
              <header className="listing-filter-drawer__head">
                <h2 id="listing-filter-title">Filter</h2>
                <button ref={closeButtonRef} type="button" className="listing-filter-drawer__close" aria-label="Close filters" onClick={() => setFilterOpen(false)}><X size={20} aria-hidden /></button>
              </header>
              <div className="listing-filter-drawer__body">{filterPanel(true)}</div>
              <footer className="listing-filter-drawer__actions">
                <button type="button" className="listing-filter-action listing-filter-action--apply" onClick={applyMobileFilters}>Apply</button>
                <button type="button" className="listing-filter-action listing-filter-action--clear" onClick={() => clearAll()}>Clear all</button>
              </footer>
            </section>
          </div>,
          document.body,
        )}

        {result.loading && !data ? <Loading label="Loading products…" /> : result.error ? <ErrorState message={result.error.message} onRetry={result.reload} /> : data && filteredProducts.length === 0 ? (
          <EmptyState title={search || activeFacetCount ? 'No products match' : emptyTitle}>
            {(search || activeFacetCount) && <button className="text-button" onClick={() => clearAll()}>Clear filters</button>}
          </EmptyState>
        ) : data ? (
          <>
            <div className={`product-grid${result.loading ? ' is-refreshing' : ''}`}>
              {filteredProducts.map((item) => <ProductCard key={item.product.product_id} product={item.product} variants={item.variants} />)}
            </div>
            {pages > 1 && <nav className="pagination" aria-label="Pages">
              <button className="text-button" disabled={page <= 1} onClick={() => updateParams((next) => next.set('page', String(page - 1)), false)}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button className="text-button" disabled={page >= pages} onClick={() => updateParams((next) => next.set('page', String(page + 1)), false)}>Next</button>
            </nav>}
          </>
        ) : null}
      </div>
    </div>
  )
}
