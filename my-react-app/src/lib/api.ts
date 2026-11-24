import type { CartItem } from '../state/cart'
import type { BlogCategory, BlogPost, BlogSummary } from './blog'
import type { RangeTileKey } from './rangeTiles'
import type { HeroAnimation } from './heroAnimations'
import type {
  Address,
  AddressInput,
  CartLine,
  Category,
  CouponQuote,
  Customer,
  ListingQuery,
  Order,
  OrderCustomer,
  PaymentMethod,
  PaymentOptions,
  Product,
  ProductPage,
  RazorpayCheckout,
  RatingSummary,
  Review,
  SavedAddress,
  ReviewPage,
  ReviewSort,
  SearchSuggestion,
  ShippingQuote,
  Banner,
  OfferPreview,
  ShopOffer,
} from './types'

// "/api" goes through Vite's proxy in development. For production set VITE_API_URL
// to the backend's address, e.g. https://api.swahasree.com
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// FastAPI sends either {"detail": "text"} or, for validation errors, {"detail": [{loc, msg}, ...]}.
function readableError(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = d.loc?.filter((p) => p !== 'body').at(-1)
        const msg = (d.msg ?? 'is invalid').replace(/^Value error, /, '')
        return field ? `${String(field).replaceAll('_', ' ')}: ${msg}` : msg
      })
      .join('. ')
  }
  if (status >= 500) return 'The store is having trouble right now. Please try again in a moment.'
  // Refused by the web server before reaching the store (its upload limit), so there's no detail.
  if (status === 413) return 'The photos are too large to upload together. Try fewer or smaller photos at a time.'
  return 'Something went wrong. Please try again.'
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function request<T>(path: string, { method = 'GET', body, token, headers, signal }: RequestOptions = {}): Promise<T> {
  // FormData (product images) goes as multipart; the browser sets that Content-Type with its boundary.
  const isForm = body instanceof FormData
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, "Can't reach the store. Check your internet connection and try again.")
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, readableError(data?.detail, response.status))
  return data as T
}

export function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

// ---------- Storefront ----------

// The admin's "Shown in the store" switch. A product switched off must not appear anywhere on the
// storefront; older API answers leave status out, so those products keep showing.
export const isShownInStore = (product: { status?: boolean }) => product.status !== false

export const getCategories = (signal?: AbortSignal) => request<Category[]>('/public/categories', { signal })

// Which category each picture under the home page banner opens (pictures left out have none).
export const getRangeTiles = (signal?: AbortSignal) =>
  request<{ range_tile: RangeTileKey; category_id: string }[]>('/public/range-tiles', { signal })

export const getProducts = (q: ListingQuery, signal?: AbortSignal) =>
  request<ProductPage>(`/public/products${query(q)}`, { signal })

export const getCategoryProducts = (categoryId: string, q: ListingQuery, signal?: AbortSignal) =>
  request<ProductPage & { category: Category }>(
    `/public/categories/${encodeURIComponent(categoryId)}/products${query(q)}`,
    { signal },
  )

export const getSubCategoryProducts = (categoryId: string, subCategory: string, q: ListingQuery, signal?: AbortSignal) =>
  request<ProductPage & { category: Category; sub_category: string }>(
    `/public/categories/${encodeURIComponent(categoryId)}/sub-categories/${encodeURIComponent(subCategory)}/products${query(q)}`,
    { signal },
  )

// The home page hero's slides, in the order the admin set; only the switched-on ones.
export const getBanners = (signal?: AbortSignal) =>
  request<{ banners: Banner[]; animation: HeroAnimation }>('/public/banners', { signal })

// static: the text stays still (several lines take turns); the others scroll across the bar.
export type AnnouncementScroll = 'static' | 'left_to_right' | 'right_to_left'

// One line of the announcement bar. A coupon code adds a copy button; a link opens a store page
// or a full https:// address when the line is tapped. Older bars stored plain strings, so the
// storefront still accepts those and treats them as text-only lines.
export type AnnouncementLine = {
  text: string
  coupon_code: string | null
  link: string | null
}

// The thin bar above the header: the one the store has switched on, or null when none is.
export type PublicAnnouncement = {
  announcement_id: string
  content: Array<AnnouncementLine | string>
  height_px: number
  background_color: string
  text_color: string
  scroll_style: AnnouncementScroll
  // Seconds the scrolling text takes for one full pass across the bar.
  scroll_seconds: number
}

export const getAnnouncement = (signal?: AbortSignal) =>
  request<{ announcement: PublicAnnouncement | null }>('/public/announcements', { signal })

// Products whose name (or category) has a word starting with what was typed; at least 2 letters.
export const getSearchSuggestions = (q: string, signal?: AbortSignal) =>
  request<{ query: string; suggestions: SearchSuggestion[] }>(`/public/products/suggest${query({ q, limit: 6 })}`, { signal })

export const getProduct = (productId: string, signal?: AbortSignal) =>
  request<Product>(`/public/products/${encodeURIComponent(productId)}`, { signal })

// ---------- Reviews (no login: shoppers give a name and email) ----------

// rating: only reviews with that many stars (1-5).
export const getProductReviews = (
  productId: string,
  q: { sort?: ReviewSort; rating?: number; skip: number; limit: number },
  signal?: AbortSignal,
) => request<ReviewPage>(`/reviews/products/${encodeURIComponent(productId)}${query(q)}`, { signal })

// multipart/form-data: rating_score, review_title, review_content, display_name, email_id and any "images".
export const postReview = (productId: string, form: FormData) =>
  request<{ message: string; review: Review; rating: RatingSummary }>(
    `/reviews/products/${encodeURIComponent(productId)}`,
    { method: 'POST', body: form },
  )

// ---------- Checkout ----------

export const validateCoupon = (code: string, items: CartLine[], token?: string) =>
  request<CouponQuote>('/coupons/validate', { method: 'POST', body: { code, items }, token })

export type PlaceOrderInput = {
  customer: OrderCustomer
  shipping_address: Address
  items: CartLine[]
  coupon_code?: string
  payment_method: PaymentMethod
  notes?: string
}

// Ordering needs a signed-in customer. "payment" is there only for an online payment that still has to be made.
export const placeOrder = (token: string, input: PlaceOrderInput, idempotencyKey: string) =>
  request<{ message: string; order: Order; payment?: RazorpayCheckout | null }>('/orders/place-order', {
    method: 'POST',
    token,
    body: input,
    headers: { 'Idempotency-Key': idempotencyKey },
  })

// The store's methods; any product in the cart tells the backend which store.
export const getPaymentOptions = (productId: string, signal?: AbortSignal) =>
  request<PaymentOptions>(`/payments/methods${query({ product_id: productId })}`, { signal })

// The coupon counts towards the free delivery threshold (after its discount), as when ordering.
export const getShippingQuote = (pincode: string, items: CartLine[], paymentMethod: PaymentMethod, couponCode: string | null, signal?: AbortSignal, token?: string) =>
  request<ShippingQuote>('/shipping/quote', {
    method: 'POST', body: { pincode, items, payment_method: paymentMethod, coupon_code: couponCode ?? undefined }, signal, token,
  })

// The offers running now, for badges on products (matched by product or category in lib/offers.ts).
export const getActiveOffers = (signal?: AbortSignal) => request<ShopOffer[]>('/offers/active', { signal })

// The free items this cart gets, and the offers it is close to. Worked out again when the order is placed.
export const previewOffers = (items: CartLine[], signal?: AbortSignal) =>
  request<OfferPreview>('/offers/preview', { method: 'POST', body: { items }, signal })

export type RazorpayResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

export const verifyPayment = (orderId: string, result: RazorpayResult) =>
  request<{ message: string; order: Order }>('/payments/razorpay/verify', {
    method: 'POST',
    body: { order_id: orderId, ...result },
  })

// ---------- Admin ----------

export const adminLogin = (email_id: string, password: string) =>
  request<{ access_token: string; token_type: string }>('/admin/login', { method: 'POST', body: { email_id, password } })

// Store managers sign in with the login ID from their welcome email (always capitals).
export const managerLogin = (login_id: string, password: string) =>
  request<{ access_token: string; token_type: string; role: 'manager'; permissions: Record<string, Record<string, boolean>> }>(
    '/managers/login', { method: 'POST', body: { login_id, password } })

// ---------- Customer sign-in (Google) ----------

export type GoogleSignInResult = {
  access_token: string
  token_type: string
  is_new_user: boolean
  needs_address: boolean
  customer: Customer
}

// idToken is the "credential" Google Sign-In hands the page.
export const googleSignIn = (idToken: string) =>
  request<GoogleSignInResult>('/customers/auth/google', { method: 'POST', body: { id_token: idToken } })

export const getMe = (token: string, signal?: AbortSignal) => request<Customer>('/customers/me', { token, signal })

// ---------- Saved addresses ----------

export const getMyAddresses = (token: string, signal?: AbortSignal) =>
  request<{ addresses: SavedAddress[] }>('/customers/me/addresses', { token, signal })

export const addAddress = (token: string, address: AddressInput) =>
  request<{ message: string; address: SavedAddress }>('/customers/me/addresses', { method: 'POST', token, body: address })

export const updateAddress = (token: string, addressId: string, address: AddressInput) =>
  request<{ message: string; address: SavedAddress }>(`/customers/me/addresses/${encodeURIComponent(addressId)}`, {
    method: 'PUT',
    token,
    body: address,
  })

export const deleteAddress = (token: string, addressId: string) =>
  request<{ message: string }>(`/customers/me/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE', token })

export const setDefaultAddress = (token: string, addressId: string) =>
  request<{ message: string }>(`/customers/me/addresses/${encodeURIComponent(addressId)}/default`, { method: 'PATCH', token })

export const getMyOrders = (token: string, skip: number, limit: number, signal?: AbortSignal) =>
  request<{ orders: Order[]; total: number }>(`/customers/me/orders${query({ skip, limit })}`, { token, signal })

export const getMyOrder = (token: string, orderId: string, signal?: AbortSignal) =>
  request<Order>(`/customers/me/orders/${encodeURIComponent(orderId)}`, { token, signal })

// Pay an unpaid order online: hands back the Razorpay details, then verifyPayment as at checkout.
export const payMyOrder = (token: string, orderId: string) =>
  request<{ message: string; order: Order; payment: RazorpayCheckout | null }>(`/customers/me/orders/${encodeURIComponent(orderId)}/pay`, {
    method: 'POST',
    token,
  })

// Place an unpaid order as cash on delivery instead (only when order.cod_available).
export const payMyOrderOnDelivery = (token: string, orderId: string) =>
  request<{ message: string; order: Order }>(`/customers/me/orders/${encodeURIComponent(orderId)}/pay-on-delivery`, {
    method: 'POST',
    token,
  })

export const cancelMyOrder = (token: string, orderId: string, reason?: string) =>
  request<{ message: string; order: Order }>(`/customers/me/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    token,
    body: { reason: reason || null },
  })

// "Notify me": one email to the signed-in customer when this out-of-stock product is back.
export const requestStockAlert = (token: string, productId: string) =>
  request<{ message: string; product_id: string; email_id: string }>('/customers/me/stock-alerts', {
    method: 'POST',
    token,
    body: { product_id: productId },
  })

// The out-of-stock products this customer is already waiting for, so "Notify me" shows as on.
export const getMyStockAlerts = (token: string) =>
  request<{ product_id: string; requested_at: string }[]>('/customers/me/stock-alerts', { token })

// ---------- Saved cart (signed in) ----------

// The cart kept on the account, so it follows the customer across devices and the store can remind
// them about it. Names, prices and "unavailable" come from the products; deleted ones are left out.
// The whole cart; an empty list empties it.
export const saveMyCart = (token: string, items: CartLine[]) =>
  request<{ items: CartItem[] }>('/customers/me/cart', { method: 'PUT', token, body: { items } })

// At sign-in: this browser's cart joined to the saved one (a product in both keeps the larger quantity).
export const mergeMyCart = (token: string, items: CartLine[]) =>
  request<{ items: CartItem[] }>('/customers/me/cart/merge', { method: 'POST', token, body: { items } })

// The "Stop cart reminders" link in a reminder email; the token in the link says who.
export const unsubscribeCartReminders = (token: string) =>
  request<{ message: string; email_id: string }>('/cart-reminders/unsubscribe', { method: 'POST', body: { token } })

// ---------- Bulk order enquiries ----------

// The enquiry form's email check: a 6-digit code is emailed, and the form can be sent once it's confirmed.
export const sendEnquiryCode = (email: string) =>
  request<{ message: string }>('/enquryform/send-otp', { method: 'POST', body: { email_id: email } })

export const verifyEnquiryEmail = (email: string, otp: string) =>
  request<{ message: string; email_id: string; verified: boolean }>('/enquryform/verify-email_id', {
    method: 'POST',
    body: { email_id: email, otp },
  })

export const sendEnquiry = (enquiry: { name: string; email_id: string; mobile_number: string; subject: string; comments: string | null }) =>
  request<{ message: string }>('/enquryform/new-enqury', { method: 'POST', body: enquiry })

// ---------- Blog ----------

// The backend writes uploaded blog pictures' addresses with its own internal host
// (http://127.0.0.1:7676/files/...), which only the server itself can open. The same files are
// public under the API, so they're pointed there: visitors can then load them, and their browsers
// keep them (the files are sent with a year-long cache).
const INTERNAL_FILES = /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|backend)(?::\d+)?\/files\//g
const PUBLIC_FILES = new URL(`${BASE_URL}/files/`, window.location.origin).href

/** Every internal file address in a piece of text (an address, or a post's HTML) made public. */
export const publicFiles = (text: string) => text.replace(INTERNAL_FILES, PUBLIC_FILES)

/** A post, card or full, with its cover picture and any pictures in its content made public. */
export function publicBlog<T extends { featured_image: string; content?: string }>(post: T): T {
  return {
    ...post,
    featured_image: post.featured_image && publicFiles(post.featured_image),
    ...(typeof post.content === 'string' ? { content: publicFiles(post.content) } : {}),
  }
}

// Published posts, newest first. categories: the filters above the list, with how many posts each has.
export const getBlogs = (q: { category?: BlogCategory; tag?: string; search?: string; skip: number; limit: number }, signal?: AbortSignal) =>
  request<{ blogs: BlogSummary[]; total: number; skip: number; limit: number; categories: { category: BlogCategory; count: number }[] }>(
    `/public/blogs${query(q)}`, { signal })
    .then((r) => ({ ...r, blogs: r.blogs.map(publicBlog) }))

// A renamed post is found by its old slug too; blog.slug is always the current one.
export const getBlog = (slug: string, signal?: AbortSignal) =>
  request<{ blog: BlogPost; related: BlogSummary[] }>(`/public/blogs/${encodeURIComponent(slug)}`, { signal })
    .then((r) => ({ blog: publicBlog(r.blog), related: r.related.map(publicBlog) }))
