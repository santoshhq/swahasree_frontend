import { createContext, useContext } from 'react'
import { enabledFlavors } from '../lib/flavor'
import type { CartLine, FlavorSelection, ProductCustomization } from '../lib/types'

// Prices and names are a copy from when the item was added, for showing the cart quickly.
// The cart page refreshes them from the store, and the server prices the order itself.
export type CartItem = CartLine & {
  product_name: string
  price: number
  image: string | null
  unavailable?: boolean
  net_weight_grams?: number | null
  customization_settings?: ProductCustomization
}

export function cartFlavors(items: CartItem[]) {
  const groups = new Map<string, { name: string; grams: number; settings?: ProductCustomization; selection: FlavorSelection }>()
  for (const item of items) {
    const group = groups.get(item.product_id) ?? { name: item.product_name, grams: 0, selection: {} }
    if (item.customization_settings) group.settings = item.customization_settings
    if (!item.unavailable) group.grams += (item.net_weight_grams ?? 0) * item.quantity
    Object.assign(group.selection, item.customization)
    groups.set(item.product_id, group)
  }
  return groups
}

export function normalizeFlavors(items: CartItem[]): CartItem[] {
  const groups = cartFlavors(items)
  for (const group of groups.values()) {
    const minimum = group.settings?.min_weight_kg
    if (!group.settings) continue
    const valid = minimum && group.grams >= Math.round(1000 * minimum) ? enabledFlavors(group.settings) : []
    for (const field of Object.keys(group.selection) as (keyof FlavorSelection)[]) {
      if (!valid.includes(field)) delete group.selection[field]
    }
  }
  return items.map((item) => {
    const selected = groups.get(item.product_id)?.selection
    return { ...item, customization: selected && Object.keys(selected).length ? selected : undefined }
  })
}

export function orderLine({ product_id, variant_name, quantity, customization }: CartItem): CartLine {
  return { product_id, variant_name, quantity, customization }
}

export type CartState = {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  setQuantity: (productId: string, variantName: string, quantity: number) => void
  remove: (productId: string, variantName: string) => void
  replace: (update: (items: CartItem[]) => CartItem[]) => void
  clear: () => void
}

export const MAX_QUANTITY = 50

export const CartContext = createContext<CartState | null>(null)

export function useCart(): CartState {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside <CartProvider>')
  return cart
}
