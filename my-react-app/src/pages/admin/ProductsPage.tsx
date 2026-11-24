import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { SearchIcon } from '../../components/Icons'
import { ErrorState, Loading, ProductImage } from '../../components/ui'
import {
  bulkDeleteProducts, deleteProduct, getAdminCategories, getAdminProductList, updateProduct,
  type AdminProduct,
} from '../../lib/adminApi'
import { money } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { DeleteIcon, EditIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Switch, Toast } from './AdminUi'
import { panel } from '../../lib/panelPath'

// Products per page; the admin can pick another size, which stays in the address (?size=).
const PAGE_SIZES = [10, 20, 40, 50]
const LOW_STOCK = 5

function priceRange(p: AdminProduct): string {
  const prices = p.variants.map((v) => v.price)
  if (!prices.length) return '-'
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`
}

export function ProductsPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('products')
  const [params, setParams] = useSearchParams()
  const show = params.get('show') ?? 'all' // all | active | hidden
  const categoryId = params.get('category') ?? ''
  // Only used with a category: a sub-category's name means something only inside its own category.
  const subCategory = categoryId ? params.get('sub') ?? '' : ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const size = PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : PAGE_SIZES[0]
  const q = params.get('q') ?? ''
  // What's typed in the search box; it goes into the address (and to the server) after a short pause.
  const [search, setSearch] = useState(q)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // The add/edit form comes back here with a message to show.
  const arrivedWith = (useLocation().state as { toast?: string } | null)?.toast
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(arrivedWith ? { message: arrivedWith, kind: 'success' } : null)
  const [overrides, setOverrides] = useState<Record<string, Partial<AdminProduct> | 'deleted'>>({})

  const categories = useFetch((signal) => getAdminCategories(signal), 'admin-cats')
  const products = useFetch(
    (signal) => getAdminProductList({
      status: show === 'all' ? undefined : show === 'active',
      category_id: categoryId || undefined,
      sub_category: subCategory || undefined,
      search: q || undefined,
      skip: (page - 1) * size,
      limit: size,
    }, signal),
    `admin-products|${params.toString()}`,
  )

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setSelected(new Set())
    setParams(next)
  }

  // Search the whole catalogue 400 ms after the admin stops typing.
  useEffect(() => {
    const value = search.trim()
    if (value === q) return
    const timer = window.setTimeout(() => set({ q: value || null }), 400)
    return () => window.clearTimeout(timer)
    // set() is a new function each render; only the typed text should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q])

  const subCategories = categories.data?.find((c) => c.category_id === categoryId)?.sub_categories ?? []

  const loaded = products.data?.products ?? []
  const total = products.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const goToPage = (n: number) => {
    set({ page: n > 1 ? String(n) : null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  // Changes made on this page show immediately, without reloading the list.
  const rows = loaded
    .filter((p) => overrides[p.product_id] !== 'deleted')
    .map((p) => ({ ...p, ...(overrides[p.product_id] as Partial<AdminProduct> | undefined) }))

  const toggleStatus = async (p: AdminProduct, status: boolean) => {
    setOverrides((o) => ({ ...o, [p.product_id]: { status } }))
    const form = new FormData()
    form.set('status', String(status))
    try {
      await updateProduct(p.product_id, form)
      setToast({ message: `${p.product_name} is now ${status ? 'visible in the store' : 'hidden from the store'}.`, kind: 'success' })
    } catch (err) {
      setOverrides((o) => ({ ...o, [p.product_id]: { status: !status } }))
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const remove = async (p: AdminProduct) => {
    try {
      await deleteProduct(p.product_id)
      setOverrides((o) => ({ ...o, [p.product_id]: 'deleted' }))
      setToast({ message: `${p.product_name} was deleted.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const removeSelected = async () => {
    const ids = [...selected]
    try {
      const res = await bulkDeleteProducts(ids)
      setOverrides((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, 'deleted' as const])) }))
      setSelected(new Set())
      setToast({ message: `${res.deleted_count} ${res.deleted_count === 1 ? 'product' : 'products'} deleted.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const allChecked = rows.length > 0 && rows.every((p) => selected.has(p.product_id))

  return (
    <>
      <AdminPageHead
        title="Products"
        subtitle="Everything in your catalogue. Hidden products stay saved but don't appear in the store."
        actions={can.create ? <Link to={panel('/admin/products/new')} className="admin-button">Add product</Link> : undefined}
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Show">
          {(['all', 'active', 'hidden'] as const).map((s) => (
            <button key={s} aria-pressed={show === s} onClick={() => set({ show: s === 'all' ? null : s })}>
              {s === 'all' ? 'All' : s === 'active' ? 'In store' : 'Hidden'}
            </button>
          ))}
        </div>
        <label className="toolbar__select">
          <span className="visually-hidden">Category</span>
          <select className="admin-input" value={categoryId} onChange={(e) => set({ category: e.target.value || null, sub: null })}>
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
          </select>
        </label>
        {subCategories.length > 0 && (
          <label className="toolbar__select">
            <span className="visually-hidden">Sub-category</span>
            <select className="admin-input" value={subCategory} onChange={(e) => set({ sub: e.target.value || null })}>
              <option value="">All sub-categories</option>
              {subCategories.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}{s.product_count !== undefined ? ` (${s.product_count})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="admin-search admin-search--inline">
          <SearchIcon size={18} />
          <label htmlFor="product-search" className="visually-hidden">Search products</label>
          <input id="product-search" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {can.delete && selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Selected products">
          <span>{selected.size} selected</span>
          <ConfirmButton
            label={`Delete ${selected.size} selected`}
            confirm={{
              title: `Delete ${selected.size} ${selected.size === 1 ? 'product' : 'products'}?`,
              message: <p>{selected.size === 1 ? 'The product and its photos are' : `All ${selected.size} products and their photos are`} deleted and taken out of the store. This can't be undone.</p>,
              confirmLabel: selected.size === 1 ? 'Delete product' : `Delete ${selected.size} products`,
            }}
            className="admin-button admin-button--danger-ghost"
            onConfirm={removeSelected}
          />
          <button className="text-button" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {products.loading && !products.data ? (
        <Loading />
      ) : products.error ? (
        <ErrorState message={products.error.message} onRetry={products.reload} />
      ) : rows.length === 0 ? (
        <div className="panel panel__empty">
          {q ? `No products named “${q}”.` : show !== 'all' || categoryId || subCategory ? 'No products match these filters.' : (
            <>No products yet.{can.create && <> <Link to={panel('/admin/products/new')}>Add your first product</Link>.</>}</>
          )}
        </div>
      ) : (
        <div className="panel panel--flush">
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  {can.delete && (
                    <th className="table__check">
                      <input type="checkbox" aria-label="Select all on this page" checked={allChecked}
                        onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((p) => p.product_id)))} />
                    </th>
                  )}
                  <th>Product</th><th>Sizes</th><th>Price</th><th>Stock</th><th>In store</th><th className="table__actions"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const stock = p.variants.filter((v) => v.status !== false).reduce((n, v) => n + (v.stock_qty ?? 0), 0)
                  const low = p.variants.some((v) => v.status !== false && (v.stock_qty ?? 0) <= LOW_STOCK)
                  return (
                    <tr key={p.product_id} className={p.status ? '' : 'is-muted'}>
                      {can.delete && (
                        <td className="table__check">
                          <input type="checkbox" aria-label={`Select ${p.product_name}`} checked={selected.has(p.product_id)}
                            onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(p.product_id)) n.delete(p.product_id); else n.add(p.product_id); return n })} />
                        </td>
                      )}
                      <td className="cell-main">
                        <div className="product-cell">
                          <ProductImage src={p.product_imgs?.[0]} alt="" className="product-cell__img" />
                          <span>
                            {can.edit
                              ? <Link to={panel(`/admin/products/${p.product_id}/edit`)} className="table__strong">{p.product_name}</Link>
                              : <span className="table__strong">{p.product_name}</span>}
                            <span className="table__sub">{p.category_name}{p.sub_category ? ` / ${p.sub_category}` : ''}</span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Sizes">{p.variants.map((v) => v.variant_name).join(', ')}</td>
                      <td className="nowrap" data-label="Price">{priceRange(p)}</td>
                      <td data-label="Stock"><span className={`stock-badge${stock === 0 ? ' stock-badge--out' : low ? ' stock-badge--low' : ''}`}>{stock === 0 ? 'Out of stock' : `${stock} units`}</span></td>
                      <td data-label="In store"><Switch checked={p.status} onChange={(v) => toggleStatus(p, v)} label={`Show ${p.product_name} in the store`} disabled={!can.edit} /></td>
                      <td className="table__actions">
                        {can.edit && <Link to={panel(`/admin/products/${p.product_id}/edit`)} className="admin-icon-button" aria-label={`Edit ${p.product_name}`} title="Edit"><EditIcon /></Link>}
                        {can.delete && <ConfirmButton label={`Delete ${p.product_name}`} icon={<DeleteIcon />} onConfirm={() => remove(p)} confirm={{
                          title: `Delete ${p.product_name}?`,
                          message: <p>The product and its photos are deleted and taken out of the store. To hide it for a while instead, switch it off. This can't be undone.</p>,
                          confirmLabel: 'Delete product',
                        }} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="orders-pager">
          <p className="orders-pager__showing">
            Showing {(page - 1) * size + 1}–{(page - 1) * size + loaded.length} of {total} {total === 1 ? 'product' : 'products'}
          </p>
          <nav className="admin-pager" aria-label="Pages">
            <button className="admin-button admin-button--ghost" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="admin-button admin-button--ghost" disabled={page >= pages} onClick={() => goToPage(page + 1)}>Next</button>
          </nav>
          <label className="orders-pager__size">
            <span>Products per page</span>
            {/* A new size starts again from page 1. */}
            <select className="admin-input" value={size} onChange={(e) => set({ size: e.target.value === String(PAGE_SIZES[0]) ? null : e.target.value })}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}
