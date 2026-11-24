import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { SearchIcon } from '../../components/Icons'
import { ErrorState, Loading, ProductImage } from '../../components/ui'
import { deleteBlog, getAdminBlogs, setBlogStatus, type AdminBlogSummary } from '../../lib/adminApi'
import { useCan } from '../../lib/adminAccess'
import { BLOG_CATEGORIES, blogDate, blogPath, editorName, type BlogCategory, type BlogStatus } from '../../lib/blog'
import { panel } from '../../lib/panelPath'
import { useFetch } from '../../lib/useFetch'
import { BlogIcon, DeleteIcon, EditIcon, ExternalLinkIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Switch, Toast } from './AdminUi'

const PAGE_SIZE = 20
const TABS: [BlogStatus | 'all', string][] = [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts']]

export function BlogsPage() {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('blogs')
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find(([v]) => v === params.get('status'))?.[0] ?? 'all') as BlogStatus | 'all'
  const category = (BLOG_CATEGORIES as readonly string[]).includes(params.get('category') ?? '') ? params.get('category') as BlogCategory : ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const q = params.get('q') ?? ''
  // What's typed in the search box; it goes into the address (and to the server) after a short pause.
  const [search, setSearch] = useState(q)
  // The form comes back here with a message to show.
  const arrivedWith = (useLocation().state as { toast?: string } | null)?.toast
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(arrivedWith ? { message: arrivedWith, kind: 'success' } : null)
  const [overrides, setOverrides] = useState<Record<string, AdminBlogSummary>>({})

  const blogs = useFetch(
    (signal) => getAdminBlogs({
      status: tab === 'all' ? undefined : tab,
      category: category || undefined,
      search: q || undefined,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }, signal),
    `admin-blogs|${params.toString()}`,
  )

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  // Search 400 ms after the admin stops typing.
  useEffect(() => {
    const value = search.trim()
    if (value === q) return
    const timer = window.setTimeout(() => set({ q: value || null }), 400)
    return () => window.clearTimeout(timer)
    // set() is a new function each render; only the typed text should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q])

  const total = blogs.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const counts = blogs.data?.counts
  const rows = (blogs.data?.blogs ?? []).map((b) => overrides[b.blog_id] ?? b)
  const goToPage = (n: number) => {
    set({ page: n > 1 ? String(n) : null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggle = async (b: AdminBlogSummary, published: boolean) => {
    try {
      const res = await setBlogStatus(b.blog_id, published ? 'published' : 'draft')
      setOverrides((o) => ({ ...o, [b.blog_id]: res.blog }))
      setToast({ message: published ? `${b.title} is live on your blog.` : `${b.title} was moved to drafts.`, kind: 'success' })
      // The tab numbers change too.
      blogs.reload()
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const remove = async (b: AdminBlogSummary) => {
    try {
      await deleteBlog(b.blog_id)
      setToast({ message: `${b.title} was deleted.`, kind: 'success' })
      blogs.reload()
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const newPost = can.create ? <Link to={panel('/admin/blogs/new')} className="admin-button">New blog post</Link> : undefined
  const filtered = tab !== 'all' || !!category || !!q

  return (
    <>
      <AdminPageHead
        title="Blog"
        subtitle="Articles for the shop's blog page. Drafts stay here until you publish them."
        actions={newPost}
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter posts">
          {TABS.map(([value, label]) => (
            <button key={value} aria-pressed={tab === value} onClick={() => set({ status: value === 'all' ? null : value })}>
              {label}
              {counts && <span className="enquiry-tab__count">{counts[value]}</span>}
            </button>
          ))}
        </div>
        <label className="toolbar__select">
          <span className="visually-hidden">Category</span>
          <select className="admin-input" value={category} onChange={(e) => set({ category: e.target.value || null })}>
            <option value="">All categories</option>
            {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="admin-search admin-search--inline">
          <SearchIcon size={18} />
          <label htmlFor="blog-search" className="visually-hidden">Search posts</label>
          <input id="blog-search" placeholder="Search by title, slug or tag" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {blogs.loading && !blogs.data ? (
        <Loading />
      ) : blogs.error ? (
        <ErrorState message={blogs.error.message} onRetry={blogs.reload} />
      ) : rows.length === 0 ? (
        filtered ? (
          <div className="panel panel__empty">{q ? `No posts match “${q}”.` : 'No posts match these filters.'}</div>
        ) : (
          <div className="panel empty-panel">
            <span className="empty-panel__icon"><BlogIcon size={28} /></span>
            <h2>No blog posts yet</h2>
            <p>Share recipes, product guides and news from the farm. Posts show on the shop's blog page and in search results.</p>
            {newPost}
          </div>
        )
      ) : (
        <div className="panel panel--flush">
          <div className="table-wrap">
            <table className="table table--cards blog-table">
              <thead>
                <tr><th>Post</th><th>Category</th><th>Status</th><th>Last saved</th><th>Live</th><th className="table__actions"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const live = b.status === 'published'
                  return (
                    <tr key={b.blog_id} className={live ? '' : 'is-muted'}>
                      <td className="cell-main">
                        <div className="product-cell">
                          <ProductImage src={b.featured_image} alt="" className="product-cell__img blog-table__img" />
                          <span>
                            {can.edit
                              ? <Link to={panel(`/admin/blogs/${b.blog_id}/edit`)} className="table__strong">{b.title}</Link>
                              : <span className="table__strong">{b.title}</span>}
                            <span className="table__sub">/blog/{b.slug}{!b.allow_indexing && ' · hidden from search engines'}</span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Category">
                        {b.category}
                        {b.tags.length > 0 && <span className="table__sub">{b.tags.slice(0, 3).join(', ')}{b.tags.length > 3 ? ` +${b.tags.length - 3}` : ''}</span>}
                      </td>
                      <td className="cell-aside">
                        <span className={`coupon-state coupon-state--${live ? 'active' : 'disabled'}`}>{live ? 'Published' : 'Draft'}</span>
                      </td>
                      <td data-label="Last saved" className="nowrap">
                        {blogDate(b.updated_at)}
                        {b.updated_by && <span className="table__sub">by {editorName(b.updated_by)}</span>}
                      </td>
                      <td data-label="Live">
                        <Switch checked={live} onChange={(v) => toggle(b, v)} label={`Publish ${b.title}`} disabled={!can.edit} />
                      </td>
                      <td className="table__actions">
                        {live && (
                          <a href={blogPath(b.slug)} target="_blank" rel="noreferrer" className="admin-icon-button" aria-label={`View ${b.title} on the blog`} title="View on the blog">
                            <ExternalLinkIcon />
                          </a>
                        )}
                        {can.edit && <Link to={panel(`/admin/blogs/${b.blog_id}/edit`)} className="admin-icon-button" aria-label={`Edit ${b.title}`} title="Edit"><EditIcon /></Link>}
                        {can.delete && <ConfirmButton label={`Delete ${b.title}`} icon={<DeleteIcon />} onConfirm={() => remove(b)} confirm={{
                          title: `Delete “${b.title}”?`,
                          message: <p>The post and its pictures are deleted{live ? ' and taken off the blog' : ''}. To hide it for a while instead, move it to drafts. This can't be undone.</p>,
                          confirmLabel: 'Delete post',
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

      {total > PAGE_SIZE && (
        <div className="orders-pager">
          <p className="orders-pager__showing">Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length} of {total} posts</p>
          <nav className="admin-pager" aria-label="Pages">
            <button className="admin-button admin-button--ghost" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="admin-button admin-button--ghost" disabled={page >= pages} onClick={() => goToPage(page + 1)}>Next</button>
          </nav>
        </div>
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}
