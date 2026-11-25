import { lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router'
import { HeroBanner } from '../components/HeroBanner'
import { CategoryCircles } from '../components/home/CategoryCircles'
import { categoryLink, featuredProducts, homeCategories, loadCollections } from '../components/home/catalog'
import { AboutSection, PaymentAssurance, TrustStrip, WhyChooseUsSection } from '../components/home/HomeEditorial'
import { ReelsSection } from '../components/home/ReelsSection'
import { useNearViewport } from '../components/home/useNearViewport'
import { ProductSection } from '../components/ProductSection'
import { EmptyState, ErrorState, ProductGridSkeleton } from '../components/ui'
import { getPaymentOptions, getProducts, isShownInStore } from '../lib/api'
import { BRAND_NAME } from '../lib/brand'
import { titleCase } from '../lib/display'
import { usePageMeta } from '../lib/seo'
import type { Category } from '../lib/types'
import { useFetch } from '../lib/useFetch'

const CustomerReviews = lazy(() => import('../components/CustomerReviews').then(({ CustomerReviews }) => ({ default: CustomerReviews })))
const heroFallback = { key: 'pantry-hero', src: '/brand/andhra-pantry.webp', link: '/shop', label: 'Shop the Swahasree pantry' }

export function HomePage() {
  usePageMeta({})
  const categories = useOutletContext<Category[]>()
  const entries = homeCategories(categories)
  const catalogue = useFetch((signal) => getProducts({ sort: 'newest', limit: 8 }, signal), 'home-new-arrivals')
  const newArrivals = (catalogue.data?.products ?? []).filter(isShownInStore)

  const [collectionsNear, collectionsRef] = useNearViewport()
  const collectionKey = collectionsNear ? entries.map(({ category }) => category.category_id).join('|') : ''
  const collections = useFetch(
    (signal) => collectionKey ? loadCollections(entries, signal) : Promise.resolve(null),
    `home-collections|${collectionKey}`,
  )
  const rows = collections.data?.rows ?? []
  const featured = featuredProducts(newArrivals, collections.data)
  const productImages = new Map(newArrivals.flatMap((product) =>
    product.product_imgs?.[0] ? [[product.category_id, product.product_imgs[0]] as const] : []))

  const [reviewsNear, reviewsRef] = useNearViewport()
  const reviewProducts = [...new Map([...rows.flatMap((row) => row.products), ...newArrivals]
    .filter(({ rating_count }) => rating_count > 0).map((product) => [product.product_id, product])).values()]

  const sampleProduct = (newArrivals.find((product) => product.in_stock) ?? newArrivals[0])?.product_id
  const payment = useFetch(
    (signal) => sampleProduct ? getPaymentOptions(sampleProduct, signal) : Promise.resolve(null),
    `home-payment|${sampleProduct ?? ''}`,
  )

  return (
    <div className="pantry-home">
      <h1 className="visually-hidden">{BRAND_NAME} Foods</h1>
      <HeroBanner fallback={heroFallback} />
      <CategoryCircles entries={entries} productImages={productImages} />
      <TrustStrip />

      <ProductSection id="new-arrivals" title="New Arrivals" more={{ to: '/shop?sort=newest', label: 'View all' }} products={newArrivals} rail>
        {catalogue.loading ? <ProductGridSkeleton count={4} rail />
          : catalogue.error ? <ErrorState message={catalogue.error.message} onRetry={catalogue.reload} />
          : !newArrivals.length ? <EmptyState title="The pantry is being stocked"><p>Check back soon for the latest products.</p></EmptyState>
          : undefined}
      </ProductSection>

      <div ref={collectionsRef} className="home-deferred">
        {collectionsNear && (!collectionKey || collections.data) && featured.products.length > 0 && (
          <div className="home-featured">
            <ProductSection id="featured-picks" title={featured.title} more={{ to: '/shop', label: 'Shop all' }} products={featured.products} rail />
          </div>
        )}
        {rows.filter(({ products }) => products.length > 0).map(({ category, title, intro, products }) => (
          <ProductSection key={category.category_id} id={`collection-${category.category_id}`} title={title}
            intro={intro} more={{ to: categoryLink(category), label: `Shop ${titleCase(category.category_name).toLowerCase()}` }}
            products={products.slice(0, 4)} rail />
        ))}
      </div>

      <AboutSection />
      <ReelsSection />
      <WhyChooseUsSection />
      <div ref={reviewsRef} className="home-deferred">
        {reviewsNear && reviewProducts.length > 0 && <Suspense fallback={null}><CustomerReviews products={reviewProducts} /></Suspense>}
      </div>
      <PaymentAssurance methods={payment.data?.methods} />
    </div>
  )
}
