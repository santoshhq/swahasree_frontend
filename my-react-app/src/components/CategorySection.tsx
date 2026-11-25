import { Link } from 'react-router'
import { titleCase } from '../lib/display'
import type { Category } from '../lib/types'
import { SectionHead } from './ProductSection'
import { ProductImage } from './ui'

export function CategorySection({ id, title, categories }: { id: string; title: string; categories: Category[] }) {
  if (categories.length === 0) return null

  return (
    <section className="pantry-categories container" aria-labelledby={id}>
      <SectionHead id={id} title={title} />
      <div className="pantry-categories__grid">
        {categories.map((category) => (
          <Link className="pantry-category" key={category.category_id} to={`/category/${encodeURIComponent(category.category_id)}`}>
            <ProductImage className="pantry-category__image" src={category.image_url} alt="" />
            <span className="pantry-category__name">{titleCase(category.category_name)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
