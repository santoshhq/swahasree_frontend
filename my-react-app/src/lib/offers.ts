import { useEffect, useState } from 'react'
import { getActiveOffers, previewOffers } from './api'
import type { CartLine, OfferPreview, Product, ShopOffer } from './types'
import { useFetch } from './useFetch'

// Every product card shows its offers, so the list is loaded once and shared by all of them,
// then asked for again after a few minutes in case the store changed it.
const REFRESH_MS = 5 * 60_000
let cached: { at: number; offers: Promise<ShopOffer[]> } | null = null

function loadOffers(): Promise<ShopOffer[]> {
  if (!cached || Date.now() - cached.at > REFRESH_MS) {
    // No offers is fine: the shop just shows no badges. A failed load is tried again next time.
    const offers = getActiveOffers().catch(() => {
      cached = null
      return []
    })
    cached = { at: Date.now(), offers }
  }
  return cached.offers
}

/** The offers running now (empty until loaded). */
export function useActiveOffers(): ShopOffer[] {
  const [offers, setOffers] = useState<ShopOffer[]>([])
  useEffect(() => {
    let live = true
    loadOffers().then((o) => live && setOffers(o))
    return () => {
      live = false
    }
  }, [])
  return offers
}

/** The offers a product counts towards: listed by name, or through its category or sub-category. */
export function offersFor(product: Pick<Product, 'product_id' | 'category_id' | 'sub_category'>, offers: ShopOffer[]): ShopOffer[] {
  return offers.filter((o) =>
    o.applies_to === 'products'
      ? o.product_ids.includes(product.product_id)
      : o.applies_to === 'sub_categories'
        ? (o.sub_categories ?? []).some((s) => s.category_id === product.category_id && s.name === product.sub_category)
        : o.category_ids.includes(product.category_id),
  )
}

/** The rule in plain words: "Buy 2, get 1 more free" or "Buy 2, get Toor Dal (500g) free". */
export function offerRule(o: Pick<ShopOffer, 'offer_type' | 'buy_quantity' | 'get_quantity' | 'gift'>): string {
  if (o.offer_type === 'buy_x_get_x') return `Buy ${o.buy_quantity}, get ${o.get_quantity} more free`
  const gift = o.gift ? `${o.gift.product_name} (${o.gift.variant_name})` : 'a free gift'
  return `Buy ${o.buy_quantity}, get ${o.get_quantity > 1 ? `${o.get_quantity} × ` : ''}${gift}${o.gift ? ' free' : ''}`
}

/** The free items the bag gets right now; asked again whenever the bag changes. */
export function useOfferPreview(lines: CartLine[]): OfferPreview | null {
  const key = lines.map((l) => `${l.product_id}:${l.variant_name}:${l.quantity}`).join(',')
  const preview = useFetch(
    (signal) => (lines.length ? previewOffers(lines, signal) : Promise.resolve(null)),
    `offer-preview|${key}`,
  )
  // A failed preview just shows no free items; the order still gets them if they apply.
  return preview.data
}
