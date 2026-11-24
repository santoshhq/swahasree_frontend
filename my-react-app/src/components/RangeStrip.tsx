import { Link } from 'react-router'
import { getRangeTiles } from '../lib/api'
import { titleCase } from '../lib/display'
import type { Category } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { ArrowIcon } from './Icons'

// Feature the visible categories selected by the admin, using the category's current name.
export function RangeStrip({ categories }: { categories: Category[] }) {
  const tiles = useFetch((signal) => getRangeTiles(signal), 'range-tiles')
  const featuredIds = new Set((tiles.data ?? []).map((tile) => tile.category_id))
  const featured = categories.filter((category) => featuredIds.has(category.category_id))
  if (!featured.length) return null

  return (
    <section className="pantry-categories container" aria-label="Featured categories">
      <h2>Featured categories</h2>
      <div>
        {featured.map((category) => (
          <Link to={`/category/${encodeURIComponent(category.category_id)}`} key={category.category_id}>
            {category.image_url && <img src={category.image_url} alt="" loading="lazy" width={48} height={48} />}
            {titleCase(category.category_name)} <ArrowIcon size={16} />
          </Link>
        ))}
      </div>
    </section>
  )
}
