import { getRangeTiles } from '../lib/api'
import type { Category } from '../lib/types'
import { useFetch } from '../lib/useFetch'
import { CategorySection } from './CategorySection'

// Feature the visible categories selected by the admin, using the category's current name.
export function RangeStrip({ categories }: { categories: Category[] }) {
  const tiles = useFetch((signal) => getRangeTiles(signal), 'range-tiles')
  const featuredIds = new Set((tiles.data ?? []).map((tile) => tile.category_id))
  const featured = categories.filter((category) => featuredIds.has(category.category_id))
  return <CategorySection id="featured-categories" title="Featured categories" categories={featured} />
}
