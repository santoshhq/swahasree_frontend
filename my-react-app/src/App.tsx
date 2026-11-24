import { Fragment, lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import './App.css'
import './styles/storefront.css'
import './styles/pantry.css'
import { AnnouncementBar } from './components/AnnouncementBar'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Loading } from './components/ui'
import { WhatsAppButton } from './components/WhatsAppButton'
import { CategoryPage } from './pages/CategoryPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RangePage } from './pages/RangePage'
import { ShopPage } from './pages/ShopPage'

const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })))
const BlogPage = lazy(() => import('./pages/BlogPage').then((module) => ({ default: module.BlogPage })))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage').then((module) => ({ default: module.BlogPostPage })))
const BulkOrdersPage = lazy(() => import('./pages/BulkOrdersPage').then((module) => ({ default: module.BulkOrdersPage })))
const CartPage = lazy(() => import('./pages/CartPage').then((module) => ({ default: module.CartPage })))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage').then((module) => ({ default: module.OrderDetailPage })))
const OrderPlacedPage = lazy(() => import('./pages/OrderPlacedPage').then((module) => ({ default: module.OrderPlacedPage })))
const PolicyPage = lazy(() => import('./pages/PolicyPage').then((module) => ({ default: module.PolicyPage })))
const ProductPage = lazy(() => import('./pages/ProductPage').then((module) => ({ default: module.ProductPage })))
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage').then((module) => ({ default: module.UnsubscribePage })))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((module) => ({ default: module.AdminLoginPage })))
const InvoicePage = lazy(() => import('./pages/admin/InvoicePage').then((module) => ({ default: module.InvoicePage })))
const ManagerLoginPage = lazy(() => import('./pages/admin/ManagerLoginPage').then((module) => ({ default: module.ManagerLoginPage })))
const ManagerProfilePage = lazy(() => import('./pages/admin/ManagerProfilePage').then((module) => ({ default: module.ManagerProfilePage })))
const ManagersPage = lazy(() => import('./pages/admin/ManagersPage').then((module) => ({ default: module.ManagersPage })))
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsPage').then((module) => ({ default: module.AnnouncementsPage })))
const BannersPage = lazy(() => import('./pages/admin/BannersPage').then((module) => ({ default: module.BannersPage })))
const BlogFormPage = lazy(() => import('./pages/admin/BlogFormPage').then((module) => ({ default: module.BlogFormPage })))
const BlogsPage = lazy(() => import('./pages/admin/BlogsPage').then((module) => ({ default: module.BlogsPage })))
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage').then((module) => ({ default: module.CategoriesPage })))
const CouponFormPage = lazy(() => import('./pages/admin/CouponFormPage').then((module) => ({ default: module.CouponFormPage })))
const CouponsPage = lazy(() => import('./pages/admin/CouponsPage').then((module) => ({ default: module.CouponsPage })))
const CustomersPage = lazy(() => import('./pages/admin/CustomersPage').then((module) => ({ default: module.CustomersPage })))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const EnquiriesPage = lazy(() => import('./pages/admin/EnquiriesPage').then((module) => ({ default: module.EnquiriesPage })))
const FreeShippingPage = lazy(() => import('./pages/admin/FreeShippingPage').then((module) => ({ default: module.FreeShippingPage })))
const OfferFormPage = lazy(() => import('./pages/admin/OfferFormPage').then((module) => ({ default: module.OfferFormPage })))
const OffersPage = lazy(() => import('./pages/admin/OffersPage').then((module) => ({ default: module.OffersPage })))
const OrderAdminDetailPage = lazy(() => import('./pages/admin/OrderAdminDetailPage').then((module) => ({ default: module.OrderAdminDetailPage })))
const OrdersPage = lazy(() => import('./pages/admin/OrdersPage').then((module) => ({ default: module.OrdersPage })))
const ProductFormPage = lazy(() => import('./pages/admin/ProductFormPage').then((module) => ({ default: module.ProductFormPage })))
const ProductsPage = lazy(() => import('./pages/admin/ProductsPage').then((module) => ({ default: module.ProductsPage })))
const ReviewsPage = lazy(() => import('./pages/admin/ReviewsPage').then((module) => ({ default: module.ReviewsPage })))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then((module) => ({ default: module.SettingsPage })))

function Layout() {
  const { pathname } = useLocation()
  // A new page starts at the top (filters and paging on the same page keep the scroll position).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      {/* The store's switched-on announcement, above the header; nothing when none is on. */}
      <AnnouncementBar />
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      {/* The WhatsApp chat button, on every page of the shop. */}
      <WhatsAppButton />
    </>
  )
}

export default function App() {
  return (
    <Suspense fallback={<div className="container page"><Loading /></div>}>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="category/:categoryId" element={<CategoryPage />} />
        <Route path="category/:categoryId/:subCategory" element={<CategoryPage />} />
        <Route path="range/:tile" element={<RangePage />} />
        <Route path="product/:productId" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order-placed" element={<OrderPlacedPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="privacy-policy" element={<PolicyPage key="privacy" id="privacy" />} />
        <Route path="terms" element={<PolicyPage key="terms" id="terms" />} />
        <Route path="refund-policy" element={<PolicyPage key="refund" id="refund" />} />
        <Route path="bulk-orders" element={<BulkOrdersPage />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="unsubscribe/cart-reminders" element={<UnsubscribePage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="account/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* Admin pages stand apart from the shop: no store header, bag or category bar. */}
      <Route path="admin-login" element={<AdminLoginPage />} />
      <Route path="manager-login" element={<ManagerLoginPage />} />
      {/* The admin panel: the owner's at /admin, a store manager's at /manager, the same pages in both.
          Each person is moved to their own one if they open the other (AdminLayout). */}
      {['admin', 'manager'].map((base) => (
        <Fragment key={base}>
          {/* Printable label and invoice: outside the admin layout, so only the sheet prints. */}
          <Route path={`${base}/orders/:orderId/invoice`} element={<InvoicePage />} />
          <Route path={base} element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:orderId" element={<OrderAdminDetailPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="product-requests" element={<Navigate to={"/" + base + "/products"} replace />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:productId/edit" element={<ProductFormPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="coupons/new" element={<CouponFormPage />} />
            <Route path="coupons/:couponId/edit" element={<CouponFormPage />} />
            <Route path="offers" element={<OffersPage />} />
            <Route path="offers/new" element={<OfferFormPage />} />
            <Route path="offers/:offerId/edit" element={<OfferFormPage />} />
            <Route path="free-shipping" element={<FreeShippingPage />} />
            <Route path="enquiries" element={<EnquiriesPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="blogs" element={<BlogsPage />} />
            <Route path="blogs/new" element={<BlogFormPage />} />
            <Route path="blogs/:blogId/edit" element={<BlogFormPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="managers" element={<ManagersPage />} />
            <Route path="profile" element={<ManagerProfilePage />} />
            <Route path="*" element={<Navigate to={`/${base}`} replace />} />
          </Route>
        </Fragment>
      ))}
      </Routes>
    </Suspense>
  )
}
