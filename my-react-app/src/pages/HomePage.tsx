import { Link } from 'react-router'
import { HeroBanner } from '../components/HeroBanner'
import { ArrowIcon, CartIcon, LockIcon, TruckIcon } from '../components/Icons'
import { ProductSection } from '../components/ProductSection'
import { RangeStrip } from '../components/RangeStrip'
import { EmptyState, ErrorState, ProductGridSkeleton } from '../components/ui'
import { getCategories, getProducts, isShownInStore } from '../lib/api'
import { BRAND_NAME } from '../lib/brand'
import { titleCase } from '../lib/display'
import { usePageMeta } from '../lib/seo'
import { useFetch } from '../lib/useFetch'

export function HomePage() {
  usePageMeta({})
  const catalogue = useFetch((signal) => getProducts({ sort: 'newest', limit: 6 }, signal), 'home-pantry')
  const categories = useFetch((signal) => getCategories(signal), 'categories')
  const products = (catalogue.data?.products ?? []).filter(isShownInStore)

  return (
    <div className="pantry-home">
      <h1 className="visually-hidden">{BRAND_NAME}</h1>
      <HeroBanner />

      <div className="pantry-perks">
        <ul className="container">
          <li><CartIcon size={20} /> Choose your pack size</li>
          <li><TruckIcon size={20} /> Delivery by PIN code</li>
          <li><LockIcon size={20} /> Secure checkout</li>
        </ul>
      </div>

      <ProductSection id="pantry-shop" title="From the Swahasree pantry" more={{ to: '/shop', label: 'Shop all' }} products={products}>
        {catalogue.loading ? <ProductGridSkeleton count={4} />
          : catalogue.error ? <ErrorState message={catalogue.error.message} onRetry={catalogue.reload} />
          : !products.length ? <EmptyState title="The pantry is being stocked"><p>Check back soon for the latest jars.</p></EmptyState>
          : undefined}
      </ProductSection>

      <RangeStrip categories={categories.data ?? []} />

      {!!categories.data?.length && (
        <section className="pantry-categories container" aria-labelledby="pantry-categories">
          <h2 id="pantry-categories">Browse by category</h2>
          <div>
            {categories.data.map((category) => (
              <Link key={category.category_id} to={`/category/${category.category_id}`}>
                {category.image_url && <img src={category.image_url} alt="" loading="lazy" width={48} height={48} />}
                {titleCase(category.category_name)} <ArrowIcon size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
