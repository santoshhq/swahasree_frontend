import type { AdminCategory, AdminOffer, AdminProduct } from '../../lib/adminApi'

// What one side of a deal shows: a picture (or a category's first letter), a name and a size.
export type DealSide = { image: string | null; letter: string | null; name: string; detail: string | null }

/** The "buy" side of an offer, from the products, categories or sub-categories it counts. */
export function buySide(offer: Pick<AdminOffer, 'applies_to' | 'product_ids' | 'category_ids' | 'sub_categories'>, products: AdminProduct[], categories: AdminCategory[]): DealSide | null {
  if (offer.applies_to === 'sub_categories') {
    const picked = offer.sub_categories ?? []
    if (!picked.length) return null
    const category = categories.find((c) => c.category_id === picked[0].category_id)
    return {
      image: null,
      letter: picked[0].name.charAt(0).toUpperCase(),
      name: picked.length === 1 ? picked[0].name : `${picked[0].name} and ${picked.length - 1} more`,
      detail: picked.length === 1 && category ? `Any product in ${category.category_name} / ${picked[0].name}` : 'Any product in them',
    }
  }
  if (offer.applies_to === 'products') {
    const picked = products.filter((p) => offer.product_ids.includes(p.product_id))
    if (!picked.length) return null
    return {
      image: picked[0].product_imgs?.[0] ?? null,
      letter: null,
      name: picked.length === 1 ? picked[0].product_name : `${picked[0].product_name} and ${picked.length - 1} more`,
      detail: picked.length === 1 ? picked[0].category_name : null,
    }
  }
  const picked = categories.filter((c) => offer.category_ids.includes(c.category_id))
  if (!picked.length) return null
  return {
    image: null,
    letter: picked[0].category_name.charAt(0).toUpperCase(),
    name: picked.length === 1 ? picked[0].category_name : `${picked[0].category_name} and ${picked.length - 1} more`,
    detail: 'Any product in it',
  }
}

/** The free side: the same item as the buy side, or the gift product and size. */
export function freeSide(offer: Pick<AdminOffer, 'offer_type' | 'gift_product_id' | 'gift_variant_name'>, buy: DealSide | null, products: AdminProduct[]): DealSide | null {
  if (offer.offer_type === 'buy_x_get_x') return buy && { ...buy, detail: 'Same product and size' }
  const gift = products.find((p) => p.product_id === offer.gift_product_id)
  if (!gift) return null
  return { image: gift.product_imgs?.[0] ?? null, letter: null, name: gift.product_name, detail: offer.gift_variant_name }
}
