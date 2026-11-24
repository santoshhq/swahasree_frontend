import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { SearchIcon } from '../../components/Icons'
import { ErrorState, Loading } from '../../components/ui'
import { createCategory, deleteCategory, getAdminCategories, updateCategory, type AdminCategory } from '../../lib/adminApi'
import { plural } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { DeleteIcon, EditIcon, TagIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Modal, Toast } from './AdminUi'
import { panel } from '../../lib/panelPath'
import { RANGE_TILES, type RangeTileKey } from '../../lib/rangeTiles'

type PopupState = { mode: 'create' } | { mode: 'edit'; category: AdminCategory } | null
type ToastState = { message: string; kind: 'success' | 'error' } | null

const CHIPS_SHOWN = 4

export function CategoriesPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('categories')
  const categories = useFetch((signal) => getAdminCategories(signal), 'admin-cats-page')
  const [search, setSearch] = useState('')
  const [popup, setPopup] = useState<PopupState>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const all = categories.data ?? []
  const q = search.trim().toLowerCase()
  const rows = q
    ? all.filter((c) => c.category_name.toLowerCase().includes(q) || c.sub_categories?.some((s) => s.name.toLowerCase().includes(q)))
    : all
  const totalSubs = all.reduce((n, c) => n + (c.sub_categories?.length ?? 0), 0)
  const totalProducts = all.reduce((n, c) => n + (c.product_count ?? 0), 0)

  const remove = async (c: AdminCategory) => {
    try {
      await deleteCategory(c.category_id)
      setToast({ message: `${c.category_name} was deleted.`, kind: 'success' })
      setPopup(null)
      categories.reload()
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  return (
    <>
      <AdminPageHead
        title="Categories"
        subtitle={categories.data ? `${plural(all.length, 'category', 'categories')}, ${plural(totalSubs, 'sub-category', 'sub-categories')}, ${plural(totalProducts, 'product')}` : 'How products are grouped in the store menu.'}
        actions={can.create ? <button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add category</button> : undefined}
      />

      {categories.loading && !categories.data ? (
        <Loading />
      ) : categories.error ? (
        <ErrorState message={categories.error.message} onRetry={categories.reload} />
      ) : all.length === 0 ? (
        <div className="panel empty-panel">
          <span className="empty-panel__icon"><TagIcon size={28} /></span>
          <h2>{can.create ? 'Create your first category' : 'No categories yet'}</h2>
          <p>Categories appear in the store's menu bar. Add sub-categories to split big ones, like Rice and Dals under Grains & Pulses.</p>
          {can.create && <button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add category</button>}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="admin-search admin-search--inline">
              <SearchIcon size={18} />
              <label htmlFor="category-search" className="visually-hidden">Search categories</label>
              <input id="category-search" placeholder="Search categories and sub-categories" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="panel panel--flush">
            <div className="table-wrap">
              <table className="table category-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="hide-sm">Sub-categories</th>
                    <th className="num">Products</th>
                    <th className="table__actions"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const subs = c.sub_categories ?? []
                    const count = c.product_count ?? 0
                    const unsorted = c.unsorted_product_count ?? 0
                    return (
                      <tr key={c.category_id}>
                        <td>
                          <button className="category-name" onClick={() => setPopup({ mode: 'edit', category: c })} disabled={!can.edit}>
                            <span className="category-name__avatar" aria-hidden>{c.category_name.charAt(0).toUpperCase()}</span>
                            <span>
                              <span className="category-name__title">{c.category_name}</span>
                              <span className="table__sub">
                                {subs.length ? plural(subs.length, 'sub-category', 'sub-categories') : 'No sub-categories'}
                                {c.range_tile && <> · Home page: {RANGE_TILES.find((t) => t.key === c.range_tile)?.label}</>}
                              </span>
                            </span>
                          </button>
                          {unsorted > 0 && (
                            <Link to={panel(`/admin/products?category=${c.category_id}`)} className="needs-attention">
                              {plural(unsorted, 'product')} {unsorted === 1 ? 'needs' : 'need'} a sub-category
                            </Link>
                          )}
                        </td>
                        <td className="hide-sm">
                          {subs.length ? (
                            <ul className="sub-chips">
                              {subs.slice(0, CHIPS_SHOWN).map((s) => (
                                <li key={s.name}>{s.name}<span className="sub-chips__count">{s.product_count ?? 0}</span></li>
                              ))}
                              {subs.length > CHIPS_SHOWN && <li className="sub-chips__more">+{subs.length - CHIPS_SHOWN} more</li>}
                            </ul>
                          ) : (
                            <span className="muted">None</span>
                          )}
                        </td>
                        <td className="num">
                          {count ? <Link to={panel(`/admin/products?category=${c.category_id}`)} className="table__strong">{count}</Link> : <span className="muted">0</span>}
                        </td>
                        <td className="table__actions">
                          {can.edit && (
                            <button className="admin-icon-button" onClick={() => setPopup({ mode: 'edit', category: c })} aria-label={`Edit ${c.category_name}`} title="Edit">
                              <EditIcon />
                            </button>
                          )}
                          {!can.delete ? null : count > 0 ? (
                            <button className="admin-icon-button" disabled aria-label={`${c.category_name} can't be deleted while it has products`}
                              title={`Has ${plural(count, 'product')}. Move or delete them first.`}>
                              <DeleteIcon />
                            </button>
                          ) : (
                            <ConfirmButton label={`Delete ${c.category_name}`} icon={<DeleteIcon />} onConfirm={() => remove(c)} confirm={{
                              title: `Delete ${c.category_name}?`,
                              message: <p>The category and its sub-categories are removed from the store. This can't be undone.</p>,
                              confirmLabel: 'Delete category',
                            }} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={4} className="panel__empty">No category or sub-category matches “{search}”.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {popup && (
        <CategoryPopup
          key={popup.mode === 'edit' ? popup.category.category_id : 'new'}
          state={popup}
          categories={all}
          onClose={() => setPopup(null)}
          onSaved={(message) => { setPopup(null); setToast({ message, kind: 'success' }); categories.reload() }}
          onError={(message) => setToast({ message, kind: 'error' })}
          onDelete={remove}
        />
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

type SubRow = { key: string; original: string | null; name: string; count: number }

function CategoryPopup({ state, categories, onClose, onSaved, onError, onDelete }: {
  state: Exclude<PopupState, null>
  // Every category, to show which home page pictures are already linked to another one.
  categories: AdminCategory[]
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
  onDelete: (c: AdminCategory) => Promise<void>
}) {
  const category = state.mode === 'edit' ? state.category : null
  const canDelete = useCan('categories').delete
  const [name, setName] = useState(category?.category_name ?? '')
  const [rows, setRows] = useState<SubRow[]>(
    () => (category?.sub_categories ?? []).map((s) => ({ key: s.name, original: s.name, name: s.name, count: s.product_count ?? 0 })),
  )
  const [newSub, setNewSub] = useState('')
  const [rangeTile, setRangeTile] = useState<RangeTileKey | null>(category?.range_tile ?? null)
  // The category each picture is linked to now, other than this one.
  const tileOwner = (key: RangeTileKey) => categories.find((c) => c.range_tile === key && c.category_id !== category?.category_id)
  const movedFrom = rangeTile ? tileOwner(rangeTile) : undefined
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const addSub = () => {
    const value = newSub.trim()
    if (!value) return
    if (rows.some((r) => r.name.trim().toLowerCase() === value.toLowerCase())) {
      setProblem(`"${value}" is already in the list`)
      return
    }
    setRows((r) => [...r, { key: `${value}-${Date.now()}`, original: null, name: value, count: 0 }])
    setNewSub('')
    setProblem(null)
  }
  const onNewSubKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSub()
    }
  }

  // What will happen to products once this is saved, shown before the admin commits.
  const originals = category?.sub_categories ?? []
  const removedWithProducts = originals.filter((s) => (s.product_count ?? 0) > 0 && !rows.some((r) => r.original === s.name))
  const renamed = rows.filter((r) => r.original && r.name.trim() && r.name.trim() !== r.original)
  const productCount = category?.product_count ?? 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = rows.map((r) => r.name.trim())
    if (!name.trim()) return setProblem('Enter a category name')
    if (trimmed.some((n) => !n)) return setProblem('Sub-category names can’t be empty')
    const lower = trimmed.map((n) => n.toLowerCase())
    const dup = trimmed.find((n, i) => lower.indexOf(n.toLowerCase()) !== i)
    if (dup) return setProblem(`"${dup}" is in the list twice`)
    setProblem(null)
    setSaving(true)
    try {
      if (!category) {
        await createCategory(name.trim(), trimmed, rangeTile)
        onSaved(`${name.trim()} was created.`)
      } else {
        const renames = Object.fromEntries(renamed.map((r) => [r.original as string, r.name.trim()]))
        const res = await updateCategory(category.category_id, name.trim(), trimmed, renames, rangeTile)
        onSaved(`${name.trim()} was saved.${res.products_moved ? ` ${plural(res.products_moved, 'product')} moved to the renamed sub-categories.` : ''}`)
      }
    } catch (err) {
      setSaving(false)
      onError((err as Error).message)
    }
  }

  return (
    <Modal
      open
      title={category ? `Edit ${category.category_name}` : 'New category'}
      subtitle={category ? `${plural(productCount, 'product')} in this category` : 'It appears in the store menu once it has products.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="category-form" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} noValidate>
        <div className="admin-field">
          <label htmlFor="cat-name" className="admin-label">Category name</label>
          <input id="cat-name" className="admin-input" maxLength={100} value={name} autoFocus
            onChange={(e) => { setName(e.target.value); setProblem(null) }} placeholder="e.g. Grains & Pulses" />
        </div>

        <section className="modal-section" aria-labelledby="subs-title">
          <div className="modal-section__head">
            <h3 id="subs-title">Sub-categories</h3>
            <span className="muted">{rows.length ? plural(rows.length, 'sub-category', 'sub-categories') : 'Optional'}</span>
          </div>
          <p className="admin-hint">
            When a category has sub-categories, every product in it must be filed under one of them.
          </p>

          {rows.length > 0 && (
            <ul className="sub-editor">
              {rows.map((r, i) => (
                <li key={r.key} className="sub-editor__row">
                  <label className="visually-hidden" htmlFor={`sub-${i}`}>Sub-category {i + 1}</label>
                  <input id={`sub-${i}`} className="admin-input" maxLength={100} value={r.name}
                    onChange={(e) => { const v = e.target.value; setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, name: v } : x))); setProblem(null) }} />
                  <span className={`sub-editor__count${r.count ? '' : ' is-empty'}`} title="Products in this sub-category">
                    {r.original ? plural(r.count, 'product') : 'New'}
                  </span>
                  {r.original ? (
                    <ConfirmButton label={`Remove ${r.original}`} icon={<DeleteIcon />}
                      onConfirm={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      confirm={{
                        title: `Remove ${r.original}?`,
                        message: <p>{r.count > 0
                          ? `${r.original} has ${plural(r.count, 'product')}. They'll need a new sub-category the next time they're edited. `
                          : ''}The sub-category is removed when you save the category.</p>,
                        confirmLabel: 'Remove sub-category',
                      }} />
                  ) : (
                    <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label={`Remove ${r.name || 'sub-category'}`} title="Remove"
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                      <DeleteIcon />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="sub-editor__add">
            <label className="visually-hidden" htmlFor="new-sub">New sub-category</label>
            <input id="new-sub" className="admin-input" maxLength={100} value={newSub} placeholder="Add a sub-category, e.g. Rice"
              onChange={(e) => setNewSub(e.target.value)} onKeyDown={onNewSubKey} />
            <button type="button" className="admin-button admin-button--ghost" onClick={addSub} disabled={!newSub.trim()}>Add</button>
          </div>

          {renamed.length > 0 && (
            <p className="modal-note">
              Renaming moves the products along: {renamed.map((r) => `${r.original} → ${r.name.trim()}`).join(', ')}.
            </p>
          )}
          {removedWithProducts.length > 0 && (
            <p className="modal-note modal-note--warn">
              {removedWithProducts.map((s) => `${s.name} (${plural(s.product_count ?? 0, 'product')})`).join(', ')}{' '}
              {removedWithProducts.length === 1 ? 'still has' : 'still have'} products. They'll need a new sub-category the next time they're edited.
            </p>
          )}
        </section>

        <section className="modal-section" aria-labelledby="tile-title">
          <div className="modal-section__head">
            <h3 id="tile-title">Home page picture</h3>
            <span className="muted">Optional</span>
          </div>
          <p className="admin-hint">
            Choose the picture under the home page banner that opens this category. A picture with no category shows “No products found”.
          </p>
          <div className="tile-picker" role="radiogroup" aria-labelledby="tile-title">
            <label className={`tile-picker__option tile-picker__option--none${rangeTile === null ? ' is-selected' : ''}`}>
              <input type="radio" name="range-tile" className="visually-hidden" checked={rangeTile === null} onChange={() => setRangeTile(null)} />
              <span className="tile-picker__none" aria-hidden>—</span>
              <span className="tile-picker__label">None</span>
            </label>
            {RANGE_TILES.map((t) => {
              const owner = tileOwner(t.key)
              return (
                <label key={t.key} className={`tile-picker__option${rangeTile === t.key ? ' is-selected' : ''}`}>
                  <input type="radio" name="range-tile" className="visually-hidden" checked={rangeTile === t.key} onChange={() => setRangeTile(t.key)} />
                  <img src={t.icon} alt="" width={64} height={64} />
                  <span className="tile-picker__label">{t.label}</span>
                  {owner && <span className="tile-picker__owner">Now: {owner.category_name}</span>}
                </label>
              )
            })}
          </div>
          {movedFrom && (
            <p className="modal-note">
              This picture opens {movedFrom.category_name} now. Saving moves it to {name.trim() || 'this category'}.
            </p>
          )}
        </section>

        {problem && <p className="field__error" role="alert">{problem}</p>}
      </form>

      {category && canDelete && (
        <section className="danger-zone" aria-labelledby="danger-title">
          <h3 id="danger-title">Delete category</h3>
          {productCount > 0 ? (
            <p>
              {category.category_name} has {plural(productCount, 'product')}. Move them to another category or delete them first.{' '}
              <Link to={panel(`/admin/products?category=${category.category_id}`)}>View its products</Link>
            </p>
          ) : (
            <>
              <p>It has no products, so it can be deleted. This can't be undone.</p>
              <ConfirmButton label="Delete category" className="admin-button admin-button--danger-ghost" onConfirm={() => onDelete(category)} confirm={{
                title: `Delete ${category.category_name}?`,
                message: <p>The category and its sub-categories are removed from the store. This can't be undone.</p>,
                confirmLabel: 'Delete category',
              }} />
            </>
          )}
        </section>
      )}
    </Modal>
  )
}
