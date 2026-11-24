import { Link, NavLink, useParams } from 'react-router'
import { ProductListing } from '../components/ProductListing'
import { ErrorState, Loading } from '../components/ui'
import { ApiError, getCategoryProducts, getSubCategoryProducts } from '../lib/api'
import { breadcrumbs, titleCase, usePageMeta } from '../lib/seo'
import type { Category, ListingQuery } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { NotFoundPage } from './NotFoundPage'

// Handles both /category/:categoryId and /category/:categoryId/:subCategory.
export function CategoryPage() {
  const { categoryId = '', subCategory } = useParams()
  // The category block (name, sub-categories) comes with any product request; one small call gets it.
  const head = useFetch((signal) => getCategoryProducts(categoryId, { limit: 1 }, signal), `cat-head|${categoryId}`)
  const named = head.data?.category
  const name = named && titleCase(subCategory ?? named.category_name)
  const categoryPath = `/category/${encodeURIComponent(categoryId)}`
  usePageMeta(named && name ? {
    title: `Buy ${name} Online`,
    description: `Shop ${name.toLowerCase()} online at Swahasree. Explore pack sizes and prices from the Swahasree pantry.`,
    jsonLd: {
      '@context': 'https://schema.org',
      ...breadcrumbs([
        { name: titleCase(named.category_name), path: categoryPath },
        ...(subCategory ? [{ name: subCategory, path: `${categoryPath}/${encodeURIComponent(subCategory)}` }] : []),
      ]),
    },
  } : null)

  if (head.loading && !head.data) return <div className="container page"><Loading /></div>
  if (head.error) {
    return head.error instanceof ApiError && head.error.status === 404
      ? <NotFoundPage />
      : <div className="container page"><ErrorState message={head.error.message} onRetry={head.reload} /></div>
  }
  const category: Category | undefined = head.data?.category
  if (!category) return null

  const load = (q: ListingQuery, signal: AbortSignal) =>
    subCategory ? getSubCategoryProducts(categoryId, subCategory, q, signal) : getCategoryProducts(categoryId, q, signal)

  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden>/</span>
        {subCategory ? <Link to={`/category/${categoryId}`}>{category.category_name}</Link> : <span aria-current="page">{category.category_name}</span>}
        {subCategory && <><span aria-hidden>/</span><span aria-current="page">{subCategory}</span></>}
      </nav>
      <header className="page-head">
        <h1>{subCategory ?? category.category_name}</h1>
      </header>

      {category.sub_categories.length > 0 && (
        <nav className="chips" aria-label={`${category.category_name} sub-categories`}>
          <NavLink to={`/category/${categoryId}`} end className="chip">
            All {category.category_name.toLowerCase()} <span className="chip__count">{category.product_count}</span>
          </NavLink>
          {category.sub_categories.map((s) => (
            <NavLink key={s.name} to={`/category/${categoryId}/${encodeURIComponent(s.name)}`} className="chip">
              {s.name} <span className="chip__count">{s.product_count}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {/* key: switching sub-category resets the listing's local filter inputs. */}
      <ProductListing
        key={`${categoryId}|${subCategory ?? ''}`}
        load={load}
        cacheKey={`cat|${categoryId}|${subCategory ?? ''}`}
        emptyTitle="No products found"
      />
    </div>
  )
}
