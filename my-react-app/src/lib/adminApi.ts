import { ApiError, publicBlog, publicFiles, query, request, type AnnouncementLine, type AnnouncementScroll } from './api'
import { clearAdminSession, getAdminSession, signInPath, type ManagerPermissions } from './adminSession'
import type { BlogCategory, BlogPost, BlogStatus } from './blog'
import type { HeroAnimation } from './heroAnimations'
import type { RangeTileKey } from './rangeTiles'
import type { CountryName, Order, OrderStatus, ProductCustomization, Review, ShopOffer } from './types'

// ---------- Admin data shapes ----------

export type AdminVariant = {
  variant_name: string
  price: number
  stock_qty: number
  status: boolean
  weight_kg: number
  dimensions?: { length_cm: number; width_cm: number; height_cm: number } | null
}

export type AdminProduct = {
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
  variants: AdminVariant[]
  status: boolean
}

export type AdminCategory = {
  category_id: string
  category_name: string
  image_url?: string | null
  // product_count per sub-category is counted live from the products.
  sub_categories: { name: string; product_count?: number }[] | null
  added_product_count: number | null
  product_count?: number
  // Products with no sub-category, or one the category no longer has.
  unsorted_product_count?: number
  // The picture under the home page banner that opens this category, if any.
  range_tile?: RangeTileKey | null
}

// shipment: the Shiprocket order made from the admin panel ("Create shipment").
export type AdminOrder = Order & { admin_id: string; shipment?: AdminShipment | null }

export type ShipmentBox = { length_cm: number; breadth_cm: number; height_cm: number; weight_kg: number }
// Filled step by step by "Packed: book courier" (a booking that stopped halfway has only some fields).
export type AdminShipment = {
  sr_order_id?: number | string
  shipment_id?: number | string
  box?: ShipmentBox
  created_at?: string
  awb?: string
  courier_name?: string | null
  pickup_scheduled_at?: string
  pickup_date?: string | null
  label_url?: string
  cancelled_at?: string
  cancel_failed?: boolean
}

export type Coupon = {
  first_order_only: boolean
  coupon_id: string
  code: string
  description: string | null
  usage_type: 'multi_use' | 'single_use'
  discount_type: 'fixed_amount' | 'percentage'
  discount_value: number
  max_discount_amount: number | null
  applies_to: 'all' | 'products' | 'categories' | 'sub_categories'
  product_ids: string[]
  category_ids: string[]
  // A sub-category is known by its name inside its category.
  sub_categories: { category_id: string; name: string }[]
  min_subtotal: number | null
  min_quantity: number | null
  used_count: number
  redeemed_by: { order_number: string; email_id: string; redeemed_at: string } | null
  starts_at: string | null
  ends_at: string | null
  status: boolean
  state: 'active' | 'scheduled' | 'expired' | 'redeemed' | 'disabled'
}

export type CouponInput = Omit<Coupon, 'coupon_id' | 'used_count' | 'redeemed_by' | 'state'>

export type Dashboard = {
  admin: { full_name: string | null; store_name: string | null }
  orders_by_status: Partial<Record<OrderStatus, number>>
  today: { count: number; total: number }
  to_collect: { count: number; total: number }
  collected_this_month: { count: number; total: number }
  recent_orders: AdminOrder[]
  low_stock: { product_id: string; product_name: string; variant_name: string; stock_qty: number; image: string | null }[]
  low_stock_threshold: number
  products: { total: number; active: number }
  categories: number
  active_coupons: number
}

// A home page hero slide. status false: kept here but not shown on the home page.
export type AdminBanner = {
  banner_id: string
  image_url: string
  link: string | null
  alt_text: string | null
  status: boolean
  created_at: string
}

export type BannerChanges = Partial<Pick<AdminBanner, 'link' | 'alt_text' | 'status'>>

// The admin panel also sees the product's name and the reviewer's email.
// is_new: not yet seen when the list was loaded (counted in the menu's red badge).
// Pending: waiting for the admin; only Approved reviews are shown to shoppers.
export type ReviewApproval = 'Pending' | 'Approved' | 'Reject'

export type AdminReview = Review & { product_name: string | null; email_id: string; is_new: boolean; admin_approvel: ReviewApproval }

export type PaymentSettings = {
  prepaid: boolean
  cod: boolean
  partial_prepaid: boolean
  partial_prepaid_percent: number | null
}

export type AdminProfile = {
  admin_id: string
  email_id: string
  store_name: string
  full_name: string
  mobile_number: string
  payment_settings: PaymentSettings
}

// ---------- Request helper ----------

/**
 * Every admin call carries the admin token. When the server says it is no longer valid (expired after
 * a day, a manager switched off or deleted), the session is dropped and they're sent to sign in.
 * A 403 signs the owner out (the token isn't an admin's), but for a manager it only means that box
 * isn't ticked: they stay signed in and see the message.
 */
async function adminRequest<T>(path: string, options: Parameters<typeof request>[1] = {}): Promise<T> {
  const session = getAdminSession()
  if (!session) {
    window.location.assign(signInPath(null))
    throw new ApiError(401, 'Please sign in again.')
  }
  try {
    return await request<T>(path, { ...options, token: session.token })
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || (err.status === 403 && session.role === 'admin'))) {
      clearAdminSession()
      window.location.assign(signInPath(session))
    }
    throw err
  }
}

// ---------- Store managers ----------

// A manager as the owner sees them on the Managers page. The password is never sent back.
export type StoreManager = {
  manager_id: string
  login_id: string
  role: 'manager'
  full_name: string
  email_id: string
  mobile_number: string
  permissions: ManagerPermissions
  status: boolean
  created_at: string | null
  last_login_at: string | null
}

export type ManagerInput = { full_name: string; email_id: string; mobile_number: string; password: string; permissions: ManagerPermissions; status: boolean }

// Owner only.
export const getManagers = (signal?: AbortSignal) => adminRequest<StoreManager[]>('/admin/managers', { signal })

// The login ID is made by the server and emailed with the password; email_sent false: share it yourself.
export const createManager = (input: ManagerInput) =>
  adminRequest<{ message: string; email_sent: boolean; manager: StoreManager }>('/admin/managers', { method: 'POST', body: input })

// password: a new one set by the owner (e.g. the manager forgot theirs); leave it out to keep the current one.
export const updateManager = (managerId: string, changes: Partial<Omit<ManagerInput, 'email_id'>>) =>
  adminRequest<{ message: string; manager: StoreManager }>(`/admin/managers/${encodeURIComponent(managerId)}`, { method: 'PATCH', body: changes })

export const deleteManager = (managerId: string) =>
  adminRequest<{ message: string }>(`/admin/managers/${encodeURIComponent(managerId)}`, { method: 'DELETE' })

// The signed-in manager's own details and tick boxes.
export const getManagerMe = (signal?: AbortSignal) =>
  adminRequest<Omit<StoreManager, 'created_at'> & { store_name: string | null }>('/managers/me', { signal })

// Changing a manager's own password: a 6-digit code is emailed first (sent_to is the masked address),
// then the code goes in with the new password. A new code can be asked for after resend_after_seconds.
export const sendManagerPasswordCode = () =>
  adminRequest<{ message: string; sent_to: string; expires_in_minutes: number; resend_after_seconds: number }>(
    '/managers/me/change-password/send-code', { method: 'POST' })

export const changeManagerPassword = (otp: string, newPassword: string) =>
  adminRequest<{ message: string }>('/managers/me/change-password', {
    method: 'POST',
    body: { otp, new_password: newPassword },
  })

// ---------- Dashboard and profile ----------

export const getDashboard = (signal?: AbortSignal) => adminRequest<Dashboard>('/admin/dashboard', { signal })
export const getAdminProfile = (signal?: AbortSignal) => adminRequest<AdminProfile>('/admin/me', { signal })
export const updateAdminProfile = (changes: Partial<Pick<AdminProfile, 'store_name' | 'full_name' | 'mobile_number'>>) =>
  adminRequest<{ message: string }>('/admin/update-admin', { method: 'PATCH', body: changes })

export const getPaymentSettings = (signal?: AbortSignal) =>
  adminRequest<PaymentSettings & { online_payments_available: boolean }>('/admin/payment-settings', { signal })
export const updatePaymentSettings = (settings: PaymentSettings) =>
  adminRequest<{ message: string; payment_settings: PaymentSettings }>('/admin/payment-settings', { method: 'PUT', body: settings })

// Password reset with an emailed 6-digit code. These need no admin token (the same calls serve a
// "forgot password" flow), so they go straight to the API.
export const requestPasswordResetCode = (email: string) =>
  request<{ message: string }>('/admin/reset-password/request', { method: 'POST', body: { email_id: email } })
export const resetPasswordWithCode = (email: string, otp: string, newPassword: string) =>
  request<{ message: string }>('/admin/verify-otp', { method: 'POST', body: { email_id: email, otp, new_password: newPassword } })

// ---------- Home page banners ----------

type BannerList = { admin_id: string; banners: AdminBanner[]; animation: HeroAnimation }

export const getAdminBanners = (signal?: AbortSignal) => adminRequest<BannerList>('/admin/banners', { signal })

// multipart/form-data: one or more files under "images".
export const uploadBanners = (form: FormData) =>
  adminRequest<BannerList & { message: string }>('/admin/banners', { method: 'POST', body: form })

export const updateBanner = (bannerId: string, changes: BannerChanges) =>
  adminRequest<{ message: string; banner: AdminBanner }>(`/admin/banners/${encodeURIComponent(bannerId)}`, { method: 'PATCH', body: changes })

// The home page's animation between banners, for every shopper.
export const setBannerAnimation = (animation: HeroAnimation) =>
  adminRequest<BannerList & { message: string }>('/admin/banners/animation', { method: 'PUT', body: { animation } })

// Every banner id, in the new order.
export const reorderBanners = (bannerIds: string[]) =>
  adminRequest<BannerList & { message: string }>('/admin/banners/order', { method: 'PUT', body: { banner_ids: bannerIds } })

// Swaps the picture; the banner keeps its place, link, description and on/off.
export const replaceBannerImage = (bannerId: string, file: File) => {
  const form = new FormData()
  form.append('image', file)
  return adminRequest<{ message: string; banner: AdminBanner }>(`/admin/banners/${encodeURIComponent(bannerId)}/image`, { method: 'PUT', body: form })
}

export const deleteBanner = (bannerId: string) =>
  adminRequest<{ message: string }>(`/admin/banners/${encodeURIComponent(bannerId)}`, { method: 'DELETE' })

// ---------- Announcement bar ----------

// The thin bar above the store header. Only one is switched on at a time, so switching one on
// switches the store's other bars off (done by the backend).
export type AnnouncementBar = {
  announcement_id: string
  content: AnnouncementLine[]
  height_px: number
  background_color: string
  text_color: string
  scroll_style: AnnouncementScroll
  scroll_seconds: number
  admin_id: string
  status: boolean
  created_at: string | null
  updated_at: string | null
}

export type AnnouncementInput = Pick<AnnouncementBar, 'content' | 'height_px' | 'background_color' | 'text_color' | 'scroll_style' | 'scroll_seconds' | 'status'>
export type AnnouncementChanges = Partial<AnnouncementInput>

export const getAdminAnnouncements = (signal?: AbortSignal) =>
  adminRequest<AnnouncementBar[]>('/admin/announcements', { signal })

export const createAnnouncement = (input: AnnouncementInput) =>
  adminRequest<{ message: string; announcement: AnnouncementBar }>('/admin/announcements', { method: 'POST', body: input })

export const updateAnnouncement = (announcementId: string, changes: AnnouncementChanges) =>
  adminRequest<{ message: string; announcement: AnnouncementBar }>(`/admin/announcements/${encodeURIComponent(announcementId)}`, {
    method: 'PATCH',
    body: changes,
  })

export const setAnnouncementStatus = (announcementId: string, status: boolean) =>
  adminRequest<{ message: string; announcement: AnnouncementBar }>(
    `/admin/announcements/${encodeURIComponent(announcementId)}/status`,
    { method: 'PATCH', body: { status } },
  )

export const deleteAnnouncement = (announcementId: string) =>
  adminRequest<{ message: string }>(`/admin/announcements/${encodeURIComponent(announcementId)}`, { method: 'DELETE' })

// ---------- Product reviews ----------

// replied false: only reviews still waiting for a reply.
export const getAdminReviews = (q: { approval?: ReviewApproval; replied?: boolean; skip: number; limit: number }, signal?: AbortSignal) =>
  adminRequest<{ total: number; reviews: AdminReview[] }>(`/reviews/admin/all${query(q)}`, { signal })

// The red number on "Reviews" in the admin menu.
export const getNewReviewCount = (signal?: AbortSignal) =>
  adminRequest<{ count: number }>('/reviews/admin/new-count', { signal })

// Opening the reviews page clears that number.
export const markReviewsSeen = () =>
  adminRequest<{ message: string; updated: number }>('/reviews/admin/mark-seen', { method: 'POST' })

// The layout listens for this to refresh the badge straight away.
export const REVIEWS_SEEN_EVENT = 'swahasree:reviews-seen'

// Replying again replaces the earlier reply.
// Approving makes a review public and counts it in the product's stars; rejecting hides it.
export const setReviewApproval = (reviewId: string, approval: ReviewApproval) =>
  adminRequest<{ message: string; review: AdminReview }>(`/reviews/${encodeURIComponent(reviewId)}/approval`, {
    method: 'PATCH',
    body: { admin_approvel: approval },
  })

// Only approved reviews can be replied to (the reply is public).
export const replyToReview = (reviewId: string, replyContent: string) =>
  adminRequest<{ message: string; review: AdminReview }>(`/reviews/${encodeURIComponent(reviewId)}/reply`, {
    method: 'PUT',
    body: { reply_content: replyContent },
  })

// ---------- Bulk order enquiries ----------

// Sent from the shop's Bulk orders page (the email is confirmed with a code first).
// is_opened: marked as read in the admin panel; unread ones are counted in the menu's red badge.
export type AdminEnquiry = {
  enqury_id: string
  name: string
  email_id: string
  mobile_number: string
  subject: string
  comments: string | null
  is_opened: boolean
  created_at: string
}

export type EnquiryStatus = 'all' | 'unread' | 'read'
export type EnquiryCounts = Record<EnquiryStatus, number>

// Newest first. counts: each tab's total, for the numbers beside All, Unread and Read.
export const getAdminEnquiries = (q: { status: EnquiryStatus; page: number; limit: number }, signal?: AbortSignal) =>
  adminRequest<{
    data: AdminEnquiry[]
    pagination: { current_page: number; limit: number; total_enquiries: number; total_pages: number }
    counts: EnquiryCounts
  }>(`/enquryform/all-enqueries${query(q)}`, { signal })

// The red number on "Bulk order enquiries" in the admin menu.
export const getUnreadEnquiryCount = (signal?: AbortSignal) =>
  adminRequest<{ count: number }>('/enquryform/unopened-count', { signal })

export const markEnquiryRead = (enquiryId: string) =>
  adminRequest<{ message: string; is_opened: boolean }>(`/enquryform/admin-enqury-opened/${encodeURIComponent(enquiryId)}`, { method: 'PATCH' })

export const deleteEnquiry = (enquiryId: string) =>
  adminRequest<{ message: string }>(`/enquryform/delete-enquiry/${encodeURIComponent(enquiryId)}`, { method: 'DELETE' })

export const deleteEnquiries = (enquiryIds: string[]) =>
  adminRequest<{ message: string; requested_count: number; deleted_count: number }>('/enquryform/delete-many-enquiries', {
    method: 'DELETE',
    body: { enqury_ids: enquiryIds },
  })

// The layout listens for this to refresh the badge straight away after one is read or deleted.
export const ENQUIRIES_CHANGED_EVENT = 'swahasree:enquiries-changed'

// ---------- Categories ----------

export const getAdminCategories = (signal?: AbortSignal) =>
  adminRequest<AdminCategory[]>('/categories/get_admin_categories', { signal })

type CategoryInput = {
  name: string
  sub_categories: { name: string }[]
  rename_sub_categories?: Record<string, string>
  remove_image?: boolean
}

function categoryBody(input: CategoryInput, image?: File) {
  if (!image) return input
  const form = new FormData()
  form.append('data', JSON.stringify(input))
  form.append('image', image)
  return form
}

export const createCategory = (name: string, subCategories: string[], image?: File) =>
  adminRequest<{ message: string }>(`/categories/create-category${image ? '/with-image' : ''}`, {
    method: 'POST',
    body: categoryBody({ name, sub_categories: subCategories.map((s) => ({ name: s })) }, image),
  })

// renames: old sub-category name -> new name, so the backend moves those products along.
export const updateCategory = (
  categoryId: string, name: string, subCategories: string[], renames: Record<string, string>,
  image?: File, removeImage = false,
) =>
  adminRequest<{ message: string; category: AdminCategory; products_moved: number }>(`/categories/${encodeURIComponent(categoryId)}${image ? '/with-image' : ''}`, {
    method: 'PATCH',
    body: categoryBody({
      name, sub_categories: subCategories.map((s) => ({ name: s })), rename_sub_categories: renames,
      remove_image: removeImage,
    }, image),
  })

export const deleteCategory = (categoryId: string) =>
  adminRequest<{ message: string }>(`/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' })

// ---------- Products ----------

export type ProductListFilters = { status?: boolean; category_id?: string; sub_category?: string; search?: string; skip: number; limit: number }

// The products page: newest first, filtered on the server, with the total for the page numbers.
export const getAdminProductList = (filters: ProductListFilters, signal?: AbortSignal) =>
  adminRequest<{ products: AdminProduct[]; total: number; skip: number; limit: number }>(`/products/list${query(filters)}`, { signal })

export const getAdminProducts = (adminId: string, status: boolean | undefined, skip: number, limit: number, signal?: AbortSignal) =>
  adminRequest<AdminProduct[]>(`/products/admin/${encodeURIComponent(adminId)}${query({ status, skip, limit })}`, { signal })

export const getAdminCategoryProducts = (categoryId: string, skip: number, limit: number, signal?: AbortSignal) =>
  adminRequest<AdminProduct[]>(`/products/category/${encodeURIComponent(categoryId)}${query({ skip, limit })}`, { signal })

export const getAdminProduct = (productId: string, signal?: AbortSignal) =>
  adminRequest<AdminProduct>(`/products/${encodeURIComponent(productId)}`, { signal })

// The product endpoints take multipart form data, because images are uploaded in the same request.
export const createProduct = (form: FormData) =>
  adminRequest<{ message: string; product: AdminProduct }>('/products/create-product', { method: 'POST', body: form })

export const updateProduct = (productId: string, form: FormData) =>
  adminRequest<{ message: string; product: AdminProduct }>(`/products/${encodeURIComponent(productId)}`, { method: 'PATCH', body: form })


export const deleteProduct = (productId: string) =>
  adminRequest<{ message: string }>(`/products/${encodeURIComponent(productId)}`, { method: 'DELETE' })

export const bulkDeleteProducts = (productIds: string[]) =>
  adminRequest<{ message: string; deleted_count: number }>('/products/bulk-delete', { method: 'DELETE', body: { product_ids: productIds } })

// ---------- Orders ----------

export type OrderFilters = {
  status?: OrderStatus
  email_id?: string
  order_number?: string
  // Part of the order ID, or the customer's name, email or mobile number.
  search?: string
  // YYYY-MM-DD, both days included; the backend reads them as India time.
  start_date?: string
  end_date?: string
  skip: number
  limit: number
}

// Newest first; total counts every order matching the filters, for the page numbers.
export const getAdminOrders = (filters: OrderFilters, signal?: AbortSignal) =>
  adminRequest<{ orders: AdminOrder[]; total: number; skip: number; limit: number }>(`/admin/orders${query(filters)}`, { signal })

export const getAdminOrder = (orderId: string, signal?: AbortSignal) =>
  adminRequest<AdminOrder>(`/admin/orders/${encodeURIComponent(orderId)}`, { signal })

// The Shiprocket pickup address, used as the return address on printed labels (null if unavailable).
export type ReturnAddress = { name: string | null; line1: string | null; line2: string | null; city: string | null; state: string | null; pincode: string; phone: string }
export const getReturnAddress = (signal?: AbortSignal) => adminRequest<ReturnAddress | null>('/admin/orders/return-address', { signal })

export const getSuggestedBox = (orderId: string, signal?: AbortSignal) =>
  adminRequest<ShipmentBox>(`/admin/orders/${encodeURIComponent(orderId)}/shipment/suggested-box`, { signal })

export const bookCourier = (orderId: string, box: ShipmentBox) =>
  adminRequest<{ message: string; order: AdminOrder }>(`/admin/orders/${encodeURIComponent(orderId)}/ship`, { method: 'POST', body: box })

export const getShipmentLabel = (orderId: string) =>
  adminRequest<{ label_url: string }>(`/admin/orders/${encodeURIComponent(orderId)}/shipment/label`, { method: 'POST' })

export const updateOrderStatus = (orderId: string, status: OrderStatus, note?: string) =>
  adminRequest<{ message: string; order: AdminOrder }>(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: { status, note: note || null },
  })

// Let the customer pay this unpaid online order in cash on delivery, even if the store's COD is off.
export const allowOrderCod = (orderId: string, allowed: boolean) =>
  adminRequest<{ message: string; order: AdminOrder }>(`/admin/orders/${encodeURIComponent(orderId)}/cod`, {
    method: 'PATCH',
    body: { allowed },
  })

// Who moves orders on after "packed". "shiprocket" (the default): Shiprocket's tracking updates mark
// them shipped, out for delivery and delivered. "manual": the admin does.
export type ShippingModeName = 'shiprocket' | 'manual'
export type ShippingMode = {
  mode: ShippingModeName
  // false: the server's webhook token isn't set, so no tracking updates arrive yet.
  tracking_updates_ready: boolean
  // true: hide "Mark as shipped", "Out for delivery" and "Delivered"; the backend refuses them too.
  courier_drives_status: boolean
}
// Readable by managers who see orders; only the store owner can change it.
export const getShippingMode = (signal?: AbortSignal) => adminRequest<ShippingMode>('/admin/orders/shipping-mode', { signal })
export const updateShippingMode = (mode: ShippingModeName) =>
  adminRequest<{ message: string; shipping_mode: ShippingMode }>('/admin/orders/shipping-mode', { method: 'PUT', body: { mode } })

// ---------- Customers ----------

// Totals are counted from this store's orders. Cancelled and returned orders count as orders, not as spend.
export type AdminCustomer = {
  customer_id: string
  email_id: string
  name: string | null
  picture: string | null
  mobile_number: string | null
  signed_in_with_google: boolean
  address_count: number
  joined_at: string | null
  last_login_at: string | null
  total_orders: number
  total_spent: number
  last_order_at: string | null
}

// Details only; a customer's orders come from getAdminOrders({ email_id }) when the admin opens them.
export const getAdminCustomers = (filters: { search?: string; skip: number; limit: number }, signal?: AbortSignal) =>
  adminRequest<{ customers: AdminCustomer[]; total: number; skip: number; limit: number }>(`/admin/customers${query(filters)}`, { signal })

// ---------- Free shipping ----------

// A PIN code range (both ends included) where delivery is free. status false: kept, but delivery
// there is charged Shiprocket's rate. The checkout shows the Shiprocket delivery date either way.
export type FreeShippingRange = {
  freeshipping_id: string
  location_name: string
  // Only India for now; the state is one of its states (lib/addresses.ts).
  country: CountryName
  state: string
  start_pincode: string
  end_pincode: string
  status: boolean
}

export type FreeShippingInput = Omit<FreeShippingRange, 'freeshipping_id'>

export const getFreeShippingRanges = (signal?: AbortSignal) => adminRequest<FreeShippingRange[]>('/freeshipping', { signal })

export const createFreeShippingRange = (input: FreeShippingInput) =>
  adminRequest<{ message: string; free_shipping: FreeShippingRange }>('/freeshipping/add-freeshipping', { method: 'POST', body: input })

export const updateFreeShippingRange = (id: string, changes: Partial<FreeShippingInput>) =>
  adminRequest<{ message: string; free_shipping: FreeShippingRange }>(`/freeshipping/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes })

export const setFreeShippingStatus = (id: string, status: boolean) =>
  adminRequest<{ message: string; free_shipping: FreeShippingRange }>(`/freeshipping/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } })

export const deleteFreeShippingRange = (id: string) =>
  adminRequest<{ message: string }>(`/freeshipping/${encodeURIComponent(id)}`, { method: 'DELETE' })

// Free delivery to every PIN code once the cart, after the coupon, is worth at least amount.
// Never set: enabled false, amount null. enabled false with an amount: kept, but not applied.
// The store owner's alone: the backend refuses managers, whatever their free shipping tick boxes.
export type FreeShippingThreshold = { enabled: boolean; amount: number | null }

export const getFreeShippingThreshold = (signal?: AbortSignal) =>
  adminRequest<FreeShippingThreshold>('/freeshipping/threshold', { signal })

export const updateFreeShippingThreshold = (input: { enabled: boolean; amount: number }) =>
  adminRequest<{ message: string; threshold: FreeShippingThreshold }>('/freeshipping/threshold', { method: 'PUT', body: input })

// Forgets the amount too (switching it off keeps it).
export const deleteFreeShippingThreshold = () =>
  adminRequest<{ message: string; threshold: FreeShippingThreshold }>('/freeshipping/threshold', { method: 'DELETE' })

// Public: the same rule the checkout applies (inside a range that is switched on).
export const checkFreeShipping = (pincode: string) =>
  request<{ pincode: string; free_shipping: boolean; location_name: string | null; message: string }>(
    '/freeshipping/check-free-shipping', { method: 'POST', body: { pincode } })

// ---------- Offers ----------

// Free items, never money off (that's coupons). No dates: an offer is simply on or off.
export type AdminOffer = ShopOffer & {
  gift_product_id: string | null
  gift_variant_name: string | null
  status: boolean
}

export type OfferInput = Omit<AdminOffer, 'offer_id' | 'gift'>

export const getAdminOffers = (signal?: AbortSignal) => adminRequest<AdminOffer[]>('/admin/offers', { signal })

export const getAdminOffer = (offerId: string, signal?: AbortSignal) =>
  adminRequest<AdminOffer>(`/admin/offers/${encodeURIComponent(offerId)}`, { signal })

export const createOffer = (input: OfferInput) =>
  adminRequest<{ message: string; offer: AdminOffer }>('/admin/offers', { method: 'POST', body: input })

export const updateOffer = (offerId: string, changes: Partial<OfferInput>) =>
  adminRequest<{ message: string; offer: AdminOffer }>(`/admin/offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', body: changes })

export const setOfferStatus = (offerId: string, status: boolean) =>
  adminRequest<{ message: string; offer: AdminOffer }>(`/admin/offers/${encodeURIComponent(offerId)}/status`, { method: 'PATCH', body: { status } })

export const deleteOffer = (offerId: string) =>
  adminRequest<{ message: string }>(`/admin/offers/${encodeURIComponent(offerId)}`, { method: 'DELETE' })

// ---------- Coupons ----------

export const getCoupons = (filters: { status?: boolean; usage_type?: string; search?: string; skip: number; limit: number }, signal?: AbortSignal) =>
  adminRequest<Coupon[]>(`/admin/coupons${query(filters)}`, { signal })

export const getCoupon = (couponId: string, signal?: AbortSignal) =>
  adminRequest<Coupon>(`/admin/coupons/${encodeURIComponent(couponId)}`, { signal })

export const createCoupon = (input: CouponInput) =>
  adminRequest<{ message: string; coupon: Coupon }>('/admin/coupons', { method: 'POST', body: input })

export const updateCoupon = (couponId: string, changes: Partial<CouponInput>) =>
  adminRequest<{ message: string; coupon: Coupon }>(`/admin/coupons/${encodeURIComponent(couponId)}`, { method: 'PATCH', body: changes })

export const deleteCoupon = (couponId: string) =>
  adminRequest<{ message: string }>(`/admin/coupons/${encodeURIComponent(couponId)}`, { method: 'DELETE' })

// ---------- Blog ----------

// Who saved a post: the owner, or a manager (with their login ID).
export type BlogEditor = { role: 'admin' | 'manager'; email: string; login_id?: string }

// Every post is known by blog_id (a uuid4) for opening, editing, publishing and deleting.
// previous_slugs: addresses the post had before its slug changed; they still lead to it.
export type AdminBlog = BlogPost & {
  blog_id: string
  status: BlogStatus
  previous_slugs: string[]
  created_at: string
  // Null while the post has never been published.
  published_at: string | null
  created_by: BlogEditor | null
  updated_by: BlogEditor | null
}

export type AdminBlogSummary = Omit<AdminBlog, 'content' | 'seo_title' | 'meta_description' | 'canonical_url' | 'previous_slugs'>

export type BlogInput = {
  title: string
  slug: string
  excerpt: string
  image_alt: string | null
  category: BlogCategory
  tags: string[]
  content: string
  seo_title: string | null
  meta_description: string | null
  canonical_url: string | null
  allow_indexing: boolean
  status: BlogStatus
}

export type BlogCounts = { all: number; draft: number; published: number }

// Latest change first. counts: each tab's total, for the numbers beside All, Published and Drafts.
export const getAdminBlogs = (q: { status?: BlogStatus; category?: BlogCategory; search?: string; skip: number; limit: number }, signal?: AbortSignal) =>
  adminRequest<{ blogs: AdminBlogSummary[]; total: number; skip: number; limit: number; counts: BlogCounts }>(`/admin/blogs${query(q)}`, { signal })
    .then((r) => ({ ...r, blogs: r.blogs.map(publicBlog) }))

export const getAdminBlog = (blogId: string, signal?: AbortSignal) =>
  adminRequest<AdminBlog>(`/admin/blogs/${encodeURIComponent(blogId)}`, { signal }).then(publicBlog)

// exceptId: the post being edited, whose own slug counts as free.
export const checkBlogSlug = (slug: string, exceptId: string | undefined, signal?: AbortSignal) =>
  adminRequest<{ slug: string; available: boolean; reason: string | null }>(
    `/admin/blogs/slug-available${query({ slug, except_id: exceptId })}`, { signal })

// multipart/form-data: the fields as JSON under "data", the picture under "featured_image".
function blogForm(input: Partial<BlogInput> | null, featuredImage: File | null): FormData {
  const form = new FormData()
  if (input) form.append('data', JSON.stringify(input))
  if (featuredImage) form.append('featured_image', featuredImage)
  return form
}

export const createBlog = (input: BlogInput, featuredImage: File) =>
  adminRequest<{ message: string; blog: AdminBlog }>('/admin/blogs', { method: 'POST', body: blogForm(input, featuredImage) })
    .then((r) => ({ ...r, blog: publicBlog(r.blog) }))

// featuredImage: a new picture (the old one is deleted); null keeps the current one.
export const updateBlog = (blogId: string, changes: Partial<BlogInput>, featuredImage: File | null) =>
  adminRequest<{ message: string; blog: AdminBlog }>(`/admin/blogs/${encodeURIComponent(blogId)}`, {
    method: 'PATCH',
    body: blogForm(changes, featuredImage),
  }).then((r) => ({ ...r, blog: publicBlog(r.blog) }))

export const setBlogStatus = (blogId: string, status: BlogStatus) =>
  adminRequest<{ message: string; blog: AdminBlogSummary }>(`/admin/blogs/${encodeURIComponent(blogId)}/status`, { method: 'PATCH', body: { status } })
    .then((r) => ({ ...r, blog: publicBlog(r.blog) }))

export const deleteBlog = (blogId: string) =>
  adminRequest<{ message: string }>(`/admin/blogs/${encodeURIComponent(blogId)}`, { method: 'DELETE' })

// A picture for inside a post, uploaded as soon as it's picked; the editor puts the returned address
// in the content, made public first, so the saved post carries an address visitors can open.
export const uploadBlogImage = (file: File) => {
  const form = new FormData()
  form.append('image', file)
  return adminRequest<{ message: string; url: string }>('/admin/blogs/images', { method: 'POST', body: form })
    .then((r) => ({ ...r, url: publicFiles(r.url) }))
}
