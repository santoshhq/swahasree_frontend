import { BrandLink, EmptyState } from '../components/ui'
import { usePageMeta } from '../lib/seo'

export function NotFoundPage() {
  // The server answers every address with the app, so this is how search engines learn it's gone.
  usePageMeta({ title: 'Page not found', noindex: true })

  return (
    <div className="container page">
      <EmptyState title="We couldn't find that page">
        <p>It may have moved, or the product is no longer sold.</p>
        <BrandLink to="/shop">Browse all products</BrandLink>
      </EmptyState>
    </div>
  )
}
