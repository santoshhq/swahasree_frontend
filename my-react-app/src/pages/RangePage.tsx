import { Link, Navigate, useParams } from 'react-router'
import { BrandLink, EmptyState, Loading } from '../components/ui'
import { getRangeTiles } from '../lib/api'
import { RANGE_TILES } from '../lib/rangeTiles'
import { usePageMeta } from '../lib/seo'
import { useFetch } from '../lib/useFetch'
import { NotFoundPage } from './NotFoundPage'

// /range/:tile: a home page picture that no category is linked to yet. If one has been linked
// since the home page loaded (or the address was saved), it goes straight to that category.
export function RangePage() {
  const { tile = '' } = useParams()
  const knownTile = RANGE_TILES.some((range) => range.key === tile)
  const tiles = useFetch((signal) => getRangeTiles(signal), 'range-tiles')
  const linked = tiles.data?.find((range) => range.range_tile === tile)?.category_id
  // An empty aisle isn't worth a search result; once linked, the address moves to the category.
  usePageMeta(knownTile && tiles.data && !linked ? { title: 'No products found', noindex: true } : null)

  if (!knownTile) return <NotFoundPage />
  if (tiles.loading && !tiles.data) return <div className="container page"><Loading /></div>
  if (linked) return <Navigate to={`/category/${encodeURIComponent(linked)}`} replace />

  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">Shop</span>
      </nav>
      <header className="page-head">
        <h1>Shop</h1>
      </header>
      <EmptyState title="No products found">
        <p>This selection is currently unavailable.</p>
        <BrandLink to="/shop">Browse all products</BrandLink>
      </EmptyState>
    </div>
  )
}
