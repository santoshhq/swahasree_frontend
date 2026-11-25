import { Link } from 'react-router'
import { titleCase } from '../../lib/display'
import { SectionHead } from '../ProductSection'
import { ProductImage } from '../ui'
import { categoryLink, type HomeCategory } from './catalog'

function CircularCategoryCard({ entry, productImage }: { entry: HomeCategory; productImage?: string }) {
  const { category, image } = entry
  return (
    <li>
      <Link className="home-circle" to={categoryLink(category)}>
        <ProductImage className="home-circle__image" alt="" src={category.image_url || image || productImage} />
        <span>{titleCase(category.category_name)}</span>
      </Link>
    </li>
  )
}

export function CategoryCircles({ entries, productImages }: { entries: HomeCategory[]; productImages: Map<string, string> }) {
  if (entries.length === 0) return null

  return (
    <section className="container home-section home-categories" aria-labelledby="shop-by-category">
      <SectionHead id="shop-by-category" title="Shop by Category" align="center" />
      <ul className="home-categories__grid">
        {entries.map((entry) => (
          <CircularCategoryCard key={entry.category.category_id} entry={entry} productImage={productImages.get(entry.category.category_id)} />
        ))}
      </ul>
    </section>
  )
}
