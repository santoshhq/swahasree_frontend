import { useEffect, useRef, useState, type ReactNode } from 'react'
import { mergeMyCart, saveMyCart } from '../lib/api'
import { readStored, writeStored } from '../lib/storage'
import { useAuth } from './auth'
import { addCartItem, cartFlavors, CartContext, MAX_QUANTITY, normalizeFlavors, orderLine, type CartItem, type CartState } from './cart'

const KEY = 'swahasree_cart'
// Wait for a pause in changes (stepper clicks) before saving the cart to the account.
const SAVE_DELAY_MS = 800

const same = (item: CartItem, productId: string, variantName: string) =>
  item.product_id === productId && item.variant_name === variantName

const lines = (items: CartItem[]) => items.map(orderLine)

// What the account needs to know about the cart; prices and "unavailable" don't count as a change.
const signature = (items: CartItem[]) =>
  JSON.stringify(lines(items).sort((a, b) => `${a.product_id}|${a.variant_name}`.localeCompare(`${b.product_id}|${b.variant_name}`)))

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => normalizeFlavors(readStored<CartItem[]>(KEY, [])))
  const token = useAuth().session?.token ?? null
  // The cart as last saved on the account; null until this sign-in's cart has been merged with it.
  const saved = useRef<string | null>(null)
  const latest = useRef(items)

  useEffect(() => {
    latest.current = items
    writeStored(KEY, items)
  }, [items])

  // Signed in (or opening the site already signed in): join this browser's cart to the saved one,
  // so a cart from another device shows here too. If that fails the cart stays in this browser only.
  useEffect(() => {
    saved.current = null
    if (!token) return
    let cancelled = false
    mergeMyCart(token, lines(latest.current))
      .then(({ items: merged }) => {
        if (cancelled) return
        saved.current = signature(merged)
        setItems(merged)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  // Every later change goes to the account too.
  useEffect(() => {
    if (!token || saved.current === null) return
    const next = signature(items)
    if (next === saved.current) return
    const timer = setTimeout(() => {
      saveMyCart(token, lines(items))
        .then(() => {
          saved.current = next
        })
        // Kept in the browser; the next change tries again.
        .catch(() => {})
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [items, token])

  const replace = (update: (current: CartItem[]) => CartItem[]) =>
    setItems((current) => normalizeFlavors(update(current)))

  const add: CartState['add'] = (item, quantity) =>
    replace((current) => addCartItem(current, item, quantity))

  const setQuantity = (productId: string, variantName: string, quantity: number) =>
    replace((current) =>
      current.map((i) =>
        same(i, productId, variantName) ? { ...i, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) } : i,
      ),
    )

  const setFlavor: CartState['setFlavor'] = (productId, field, level, settings) =>
    replace((current) => {
      const selection = { ...cartFlavors(current).get(productId)?.selection, [field]: level }
      return current.map((item) => item.product_id === productId ? {
        ...item, customization: selection, customization_settings: settings ?? item.customization_settings,
      } : item)
    })

  const remove = (productId: string, variantName: string) =>
    replace((current) => current.filter((i) => !same(i, productId, variantName)))

  const available = items.filter((i) => !i.unavailable)

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.reduce((sum, i) => sum + i.quantity, 0),
        subtotal: available.reduce((sum, i) => sum + i.price * i.quantity, 0),
        add,
        setQuantity,
        setFlavor,
        remove,
        replace,
        clear: () => setItems([]),
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
