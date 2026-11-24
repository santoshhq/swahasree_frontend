// Shapes returned by the Swahasree FastAPI backend.

export type FlavorField = 'spicy_level' | 'oil_level' | 'salt_level'
export type FlavorLevel = 'Low' | 'Medium' | 'High'
export type FlavorSelection = Partial<Record<FlavorField, FlavorLevel>>
export type ProductCustomization = Record<FlavorField, boolean> & { min_weight_kg: number | null }

export type Variant = {
  variant_name: string
  price: number
  weight_kg: number | null
  net_weight_grams?: number | null
  in_stock: boolean
}

export type Product = {
  customization?: ProductCustomization
  spicy_level?: string | null
  oil_level?: string | null
  salt_level?: string | null
  product_id: string
  product_name: string
  category_id: string
  category_name: string
  sub_category: string | null
  description: string | null
  product_imgs: string[] | null
  variants: Variant[]
  min_price: number | null
  in_stock: boolean
  // The admin's "Shown in the store" switch. Older API answers leave it out: those are shown.
  status?: boolean
  // Average of the product's reviews (1 decimal), null until the first review.
  rating_average: number | null
  rating_count: number
}

// A shopper's review (GET /reviews/...). The reviewer's email is never sent to the storefront.
export type Review = {
  review_id: string
  product_id: string
  rating_score: number
  review_title: string
  review_content: string
  images_urls: string[]
  display_name: string
  admin_reply: { reply_content: string; replied_at: string } | null
  created_at: string
}

// breakdown: number of reviews per star, keyed "5" to "1".
export type RatingSummary = {
  average: number | null
  count: number
  breakdown: Record<string, number>
}

// top: highest rated first; latest: newest first; lowest: lowest rated first.
export type ReviewSort = 'top' | 'latest' | 'lowest'

// rating: the summary of all the product's reviews, whatever the filter.
export type ReviewPage = {
  total: number
  skip: number
  limit: number
  sort: ReviewSort
  rating_filter: number | null
  reviews: Review[]
  rating: RatingSummary
}

// A home page hero slide the admin uploaded (GET /public/banners). link: a store page such as
// "/shop" or a full https address; null opens the shop.
export type Banner = {
  banner_id: string
  image_url: string
  link: string | null
  alt_text: string | null
}

// One row of the search box's type-ahead list (GET /public/products/suggest).
export type SearchSuggestion = {
  product_id: string
  product_name: string
  category_name: string
  sub_category: string | null
  image: string | null
  min_price: number | null
  sizes: number
  in_stock: boolean
  // The admin's "Shown in the store" switch; hidden products are left out of the suggestions.
  status?: boolean
}

export type ProductPage = {
  products: Product[]
  total: number
  skip: number
  limit: number
}

export type SubCategory = { name: string; product_count: number }

export type Category = {
  category_id: string
  category_name: string
  image_url?: string | null
  product_count: number
  sub_categories: SubCategory[]
}

export type SortOption = 'newest' | 'price_low_to_high' | 'price_high_to_low' | 'name'

export type ListingQuery = {
  search?: string
  min_price?: number
  max_price?: number
  sort?: SortOption
  skip?: number
  limit?: number
}

export type OrderStatus =
  // A prepaid order waiting for its online payment.
  | 'payment_pending'
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type OrderItem = {
  customization?: FlavorSelection
  product_id: string
  product_name: string
  variant_name: string
  unit_price: number
  quantity: number
  line_total: number
  discount: number
  image: string | null
  // A free item from an offer: priced 0, with what it would have cost (free_value).
  is_free?: boolean
  offer_id?: string
  offer_title?: string
  free_value?: number
  // The product's HSN code, printed on the invoice when the backend sends it.
  hsn_code?: string | null
}

// An offer gives free items, never money off (that's coupons). It applies by itself, without a code.
export type ShopOffer = {
  offer_id: string
  title: string
  description: string | null
  // buy_x_get_x: more of the same product and size free. buy_x_get_gift: the gift product free.
  offer_type: 'buy_x_get_x' | 'buy_x_get_gift'
  applies_to: 'products' | 'categories' | 'sub_categories'
  product_ids: string[]
  category_ids: string[]
  // A sub-category is known by its name inside its category.
  sub_categories: { category_id: string; name: string }[]
  buy_quantity: number
  get_quantity: number
  gift: { product_id: string; product_name: string; variant_name: string; image: string | null } | null
  max_rewards_per_order: number | null
}

// What an order (or the cart, before ordering) got from one offer.
export type AppliedOffer = {
  offer_id: string
  title: string
  offer_type: ShopOffer['offer_type']
  product_id: string
  product_name: string
  variant_name: string
  free_quantity: number
  free_value: number
}

// "Add 1 more to get ...", or why an offer the cart qualifies for can't give its item.
export type OfferNudge = { offer_id: string; title: string; short_by: number; message: string }

export type OfferPreview = { free_items: OrderItem[]; applied: AppliedOffer[]; nudges: OfferNudge[] }

export type Address = {
  line1: string
  line2?: string | null
  landmark?: string | null
  city: string
  // Only India for now; orders placed before countries were recorded don't have it.
  country?: CountryName
  state: string
  pincode: string
}

export type OrderCustomer = {
  full_name: string
  email_id: string
  mobile_number: string
}

export type Order = {
  order_id: string
  order_number: string
  customer: OrderCustomer
  shipping_address: Address
  // Where the bill is addressed. The storefront currently bills to the delivery address.
  billing_address?: Address
  items: OrderItem[]
  pricing: {
    subtotal: number
    discount: number
    shipping_fee: number
    cod_fee: number
    total: number
  }
  coupon: { code: string; discount_amount: number } | null
  // Offers that added free items; the items are in items, with is_free.
  offers?: AppliedOffer[]
  payment: OrderPayment
  status: OrderStatus
  status_history: { status: OrderStatus; at: string; by: string; note: string | null }[]
  // The courier's latest update (Shiprocket tracking webhook), once the parcel has an AWB number.
  tracking?: OrderTracking | null
  notes: string | null
  // An unpaid order whose payment time ran out: its items went back on sale. Paying (online, or
  // cash on delivery) takes them again if they are still in stock.
  stock_released_at?: string | null
  // Sent with an unpaid order only: whether it can be switched to cash on delivery (the store takes
  // COD for an order this size, or the admin allowed it for this order).
  cod_available?: boolean
  // The tax invoice's serial number (e.g. OSZ/2026-27/0001) and the date it was issued, once the
  // backend assigns them.
  invoice_number?: string | null
  invoice_date?: string | null
  created_at: string
  updated_at: string
}

export type OrderTracking = {
  awb: string | null
  courier_name: string | null
  status: string | null
  status_at: string | null
  etd: string | null
}

export type PaymentMethod = 'PREPAID' | 'COD'

export type OrderPayment = {
  method: PaymentMethod
  // COD: pending -> collected. Online: awaiting_payment -> paid (-> refund_pending -> refunded).
  // Either can end as cancelled, or failed when an online payment never came.
  status: 'pending' | 'collected' | 'awaiting_payment' | 'paid' | 'refund_pending' | 'refunded' | 'failed' | 'cancelled'
  collected_at: string | null
  transaction_id?: string | null
  // The admin let this unpaid online order be paid in cash on delivery instead.
  cod_allowed?: boolean
}

// What GET /payments/methods says the store accepts.
export type PaymentOptions = {
  methods: PaymentMethod[]
  default: PaymentMethod
  razorpay_key: string | null
  cod_fee: number | null
  max_cod_order_value: number | null
}

// Handed back by place-order for an online payment; opens Razorpay's checkout.
export type RazorpayCheckout = {
  key: string
  razorpay_order_id: string
  amount: number
  currency: string
  order_id: string
  order_number: string
  prefill: { name: string; email: string; contact: string }
  pay_before: string
}

export type AddressType = 'home' | 'work' | 'other'

// Only India is delivered to for now (lib/addresses.ts).
export type CountryName = 'India'

// A delivery address saved on the customer's account (backend models/customer_model.py Customer_Address).
export type AddressInput = {
  address_type: AddressType
  full_name: string
  mobile_number: string
  alternative_mobilenumber?: string | null
  House_number_building_street: string
  Area_or_locality?: string | null
  Landmark?: string | null
  City_or_town: string
  PIN_code: string
  // Left out on addresses saved before countries were recorded: those are in India.
  Country?: CountryName
  State: string
  is_default: boolean
}

export type SavedAddress = AddressInput & { address_id: string }

// Customers sign in with Google; the email is the Google account's.
export type Customer = {
  customer_id: string
  email: string
  name: string | null
  picture: string | null
  mobile_number: string | null
  total_orders: number
  first_order_at?: string | null
  addresses: SavedAddress[]
  // True until the first address is saved.
  needs_address: boolean
}

export type CouponQuote = {
  code: string
  description: string | null
  discount_type: 'fixed_amount' | 'percentage'
  discount_value: number
  max_discount_amount: number | null
  // shipping_fee is null: delivery depends on the PIN code (see ShippingQuote).
  pricing: { subtotal: number; discount: number; shipping_fee: number | null; total: number }
}

// POST /shipping/quote: Shiprocket's cheapest courier to that PIN code, rounded up to the rupee.
// free_shipping: shipping_fee is 0, because the PIN code is in one of the store's free delivery
// ranges (reason "zone") or the cart, after the coupon, reached the store's threshold ("min_order").
export type ShippingQuote = {
  pincode: string
  shipping_fee: number
  free_shipping: boolean
  free_shipping_reason: 'zone' | 'min_order' | null
  // The store's minimum order value for free delivery anywhere; null when it has none.
  free_shipping_threshold: number | null
  // How much more for free delivery; 0 once reached, null with no threshold or a free PIN code.
  amount_left_for_free_shipping: number | null
  // Expected delivery day, YYYY-MM-DD (India time), from Shiprocket.
  delivery_date: string | null
  courier_name: string | null
  estimated_delivery_days: number | null
  etd: string | null
}

export type CartLine = { product_id: string; variant_name: string; quantity: number; customization?: FlavorSelection }
