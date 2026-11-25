import { getCategoryProducts, getRangeTiles, isShownInStore } from '../../lib/api'
import { titleCase } from '../../lib/display'
import type { Category, Product } from '../../lib/types'

const COLLECTIONS = [
  { names: ['pickles', 'pickle'], title: 'Andhra Pickles', intro: 'Tangy, spicy accompaniments for hot rice and everyday meals.', image: '/brand/avakaya-mango.webp' },
  { names: ['sweets', 'sweet'], title: 'Traditional Sweets', intro: 'Laddus, halwa and sweet bites worth sharing.', image: '/brand/pantry-sweets.webp' },
  { names: ['podis', 'podies', 'podulu', 'podi'], title: 'Andhra Podis', intro: 'A spoonful for idli, dosa or a bowl of rice with ghee.', image: '/brand/pantry-podis.webp' },
  { names: ['snacks', 'snack'], title: 'Crunchy Snacks', intro: 'Savoury favourites to open when the chai is ready.', image: '/brand/pantry-snacks.webp' },
]

export function categoryLink(category: Category) {
  return `/category/${encodeURIComponent(category.category_id)}`
}

export function homeCategories(categories: Category[]) {
  const available = categories.filter((category) => category.product_count > 0)
  return available.map((category) => {
    const index = COLLECTIONS.findIndex(({ names }) => names.includes(category.category_name.trim().toLowerCase()))
    const collection = COLLECTIONS[index]
    return {
      category,
      rank: collection ? index : COLLECTIONS.length,
      title: collection?.title ?? titleCase(category.category_name),
      image: collection?.image,
      intro: collection?.intro,
    }
  }).sort((a, b) => a.rank - b.rank).slice(0, COLLECTIONS.length)
}

export type HomeCategory = ReturnType<typeof homeCategories>[number]

export async function loadCollections(categories: HomeCategory[], signal: AbortSignal) {
  const [rows, featured] = await Promise.all([
    Promise.all(categories.map(async (entry) => {
      const result = await getCategoryProducts(entry.category.category_id, { limit: 6 }, signal).catch(() => null)
      const products = (result?.products ?? []).filter(isShownInStore)
      products.sort((a, b) => Number(b.in_stock) - Number(a.in_stock))
      return { ...entry, products }
    })),
    getRangeTiles(signal).catch(() => []),
  ])
  const featuredIds = new Set(featured.map(({ category_id }) => category_id))
  return { rows, featuredIds }
}

export function featuredProducts(newArrivals: Product[], collections: Awaited<ReturnType<typeof loadCollections>> | null) {
  const rows = collections?.rows ?? []
  const candidates = [...new Map([...rows.flatMap((row) => row.products), ...newArrivals]
    .filter((product) => product.in_stock).map((product) => [product.product_id, product])).values()]
  const fresh = new Set(newArrivals.map(({ product_id }) => product_id))
  const reviewed = candidates.filter(({ rating_average, rating_count }) => (rating_average ?? 0) >= 4 && rating_count >= 3)
  if (reviewed.length >= 2) {
    reviewed.sort((a, b) => Number(fresh.has(a.product_id)) - Number(fresh.has(b.product_id))
      || (b.rating_average ?? 0) - (a.rating_average ?? 0) || b.rating_count - a.rating_count)
    return { title: 'Customer Favourites', products: reviewed.slice(0, 4) }
  }

  const picks = new Map<string, Product>()
  for (const product of candidates) {
    const alreadyPicked = picks.get(product.category_id)
    if (!alreadyPicked || (fresh.has(alreadyPicked.product_id) && !fresh.has(product.product_id))) {
      picks.set(product.category_id, product)
    }
  }
  const priorities = collections?.featuredIds ?? new Set<string>()
  const products = [...picks.values()].sort((a, b) => Number(priorities.has(b.category_id)) - Number(priorities.has(a.category_id)))
  return { title: 'Featured Picks', products: products.slice(0, 4) }
}
