import { useSearchParams } from 'react-router'
import { ProductListing } from '../components/ProductListing'
import { getProducts } from '../lib/api'
import { usePageMeta } from '../lib/seo'

export function ShopPage() {
  const [params] = useSearchParams()
  const search = params.get('search')
  // Search results are left out of search engines; the full listing is the page to find.
  usePageMeta(search
    ? { title: `Results for “${search}”`, noindex: true }
    : {
        title: 'Shop the pantry',
        description: 'Explore Andhra pickles and pantry favourites from Swahasree.',
      })

  return (
    <div className="container page">
      <header className="page-head">
        <h1>{search ? `Results for “${search}”` : 'All products'}</h1>
      </header>
      <ProductListing load={getProducts} cacheKey="shop" emptyTitle="No products yet" />
    </div>
  )
}
