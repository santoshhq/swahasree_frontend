import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { BRAND_LOGO as logo } from '../../lib/brand'
import { AdminAccessContext, allowed, type AdminAccess } from '../../lib/adminAccess'
import { ENQUIRIES_CHANGED_EVENT, getManagerMe, getNewReviewCount, getUnreadEnquiryCount, REVIEWS_SEEN_EVENT } from '../../lib/adminApi'
import {
  clearAdminSession, getAdminSession, signInPath, updateManagerPermissions,
  type ManagerAction, type ManagerPermissions, type ManagerSection,
} from '../../lib/adminSession'
import { asOwnerPath, panel, panelBase } from '../../lib/panelPath'
import { readStored, writeStored } from '../../lib/storage'
import '../../admin.css'
import {
  AddBoxIcon, AnnouncementIcon, BlogIcon, BoxIcon, CloseIcon, CollapseIcon, CustomersIcon, EnquiriesIcon, FreeShippingIcon, OffersIcon, DashboardIcon, ImageIcon, LockKeyIcon, LogoutIcon,
  ManagersIcon, MenuIcon, ProfileIcon, OrdersIcon, ReviewsIcon, SettingsIcon, StoreIcon, TagIcon, TicketIcon,
} from './AdminIcons'
import { ConfirmDialog } from './AdminUi'

// badge: which live count to show beside the item, if any.
// section/action: what a manager needs ticked to see the item. ownerOnly: never shown to managers.
type Item = {
  to: string; label: string; icon: ReactNode; end?: boolean; badge?: 'reviews' | 'enquiries'
  section?: ManagerSection; action?: ManagerAction; ownerOnly?: boolean
}

const MENU: { heading?: string; items: Item[] }[] = [
  { items: [{ to: '/admin', label: 'Dashboard', icon: <DashboardIcon />, end: true, section: 'dashboard' }] },
  { heading: 'Sales', items: [
    { to: '/admin/orders', label: 'Orders', icon: <OrdersIcon />, section: 'orders' },
    { to: '/admin/customers', label: 'Customers', icon: <CustomersIcon />, section: 'customers' },
    { to: '/admin/coupons', label: 'Coupons', icon: <TicketIcon />, section: 'coupons' },
    { to: '/admin/offers', label: 'Offers', icon: <OffersIcon />, section: 'offers' },
    { to: '/admin/free-shipping', label: 'Free shipping', icon: <FreeShippingIcon />, section: 'free_shipping' },
    { to: '/admin/enquiries', label: 'Bulk order enquiries', icon: <EnquiriesIcon />, badge: 'enquiries', section: 'enquiries' },
  ] },
  { heading: 'Catalogue', items: [
    { to: '/admin/products', label: 'Products', icon: <BoxIcon />, end: true, section: 'products' },
    { to: '/admin/products/new', label: 'Add product', icon: <AddBoxIcon />, section: 'products', action: 'create' },
    { to: '/admin/categories', label: 'Categories', icon: <TagIcon />, section: 'categories' },
    { to: '/admin/reviews', label: 'Reviews', icon: <ReviewsIcon />, badge: 'reviews', section: 'reviews' },
  ] },
  { heading: 'Store', items: [
    { to: '/admin/banners', label: 'Home page banners', icon: <ImageIcon />, section: 'banners' },
    { to: '/admin/announcements', label: 'Announcement bar', icon: <AnnouncementIcon />, section: 'announcements' },
    { to: '/admin/blogs', label: 'Blog', icon: <BlogIcon />, section: 'blogs' },
    { to: '/admin/managers', label: 'Managers', icon: <ManagersIcon />, ownerOnly: true },
    { to: '/admin/settings', label: 'Store settings', icon: <SettingsIcon />, ownerOnly: true },
  ] },
]

// What a page needs, by its address written the owner's way (most specific first; a manager's
// /manager/... addresses are matched as /admin/...). "owner": only the store owner.
// "manager": only a store manager (the owner has Store settings instead).
const PAGE_RULES: [RegExp, ManagerSection | 'owner' | 'manager', ManagerAction][] = [
  [/^\/admin\/?$/, 'dashboard', 'view'],
  [/^\/admin\/orders/, 'orders', 'view'],
  [/^\/admin\/customers/, 'customers', 'view'],
  [/^\/admin\/coupons\/new/, 'coupons', 'create'],
  [/^\/admin\/coupons\/[^/]+\/edit/, 'coupons', 'edit'],
  [/^\/admin\/coupons/, 'coupons', 'view'],
  [/^\/admin\/offers\/new/, 'offers', 'create'],
  [/^\/admin\/offers\/[^/]+\/edit/, 'offers', 'edit'],
  [/^\/admin\/offers/, 'offers', 'view'],
  [/^\/admin\/free-shipping/, 'free_shipping', 'view'],
  [/^\/admin\/enquiries/, 'enquiries', 'view'],
  [/^\/admin\/products\/new/, 'products', 'create'],
  [/^\/admin\/products\/[^/]+\/edit/, 'products', 'edit'],
  [/^\/admin\/products/, 'products', 'view'],
  [/^\/admin\/categories/, 'categories', 'view'],
  [/^\/admin\/reviews/, 'reviews', 'view'],
  [/^\/admin\/banners/, 'banners', 'view'],
  [/^\/admin\/announcements/, 'announcements', 'view'],
  [/^\/admin\/blogs\/new/, 'blogs', 'create'],
  [/^\/admin\/blogs\/[^/]+\/edit/, 'blogs', 'edit'],
  [/^\/admin\/blogs/, 'blogs', 'view'],
  [/^\/admin\/(settings|managers)/, 'owner', 'view'],
  [/^\/admin\/profile/, 'manager', 'view'],
]

const COLLAPSED_KEY = 'swahasree_admin_menu_collapsed'
// How often the menu asks for new reviews and enquiries while the panel is open.
const BADGE_POLL_MS = 60_000

/**
 * A red menu number (reviews not seen yet, enquiries not read yet): checked on load, every minute
 * and on each page change. resetTo0: the event clears it at once (opening the page marks all seen);
 * otherwise the event asks the server again (enquiries are read one at a time).
 */
function useBadgeCount(
  load: (signal: AbortSignal) => Promise<{ count: number }>, event: string, resetTo0: boolean, pathname: string, enabled: boolean,
): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const check = () => {
      // Skipped while the tab is in the background; checked again when it is next due.
      if (document.hidden) return
      load(controller.signal).then((r) => setCount(r.count)).catch(() => {})
    }
    check()
    const timer = window.setInterval(check, BADGE_POLL_MS)
    const onChange = () => (resetTo0 ? setCount(0) : load(controller.signal).then((r) => setCount(r.count)).catch(() => {}))
    window.addEventListener(event, onChange)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener(event, onChange)
    }
    // load, event and resetTo0 are fixed for each badge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, enabled])
  return count
}

/**
 * A manager's tick boxes, read again on every page change, so what the owner changes shows up
 * on the manager's next click (the backend applies it straight away either way).
 */
function useManagerPermissions(pathname: string, isManager: boolean, saved: ManagerPermissions): ManagerPermissions {
  const [permissions, setPermissions] = useState(saved)
  useEffect(() => {
    if (!isManager) return
    const controller = new AbortController()
    getManagerMe(controller.signal)
      .then((me) => {
        updateManagerPermissions(me.permissions)
        setPermissions(me.permissions)
      })
      // A switched-off or deleted manager gets a 401, which signs them out (lib/adminApi.ts).
      .catch(() => {})
    return () => controller.abort()
  }, [pathname, isManager])
  return permissions
}

export function AdminLayout() {
  const session = getAdminSession()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const isManager = session?.role === 'manager'
  // Desktop: the menu can shrink to icons (remembered). Phones: it slides in over the page.
  const [collapsed, setCollapsed] = useState(() => readStored<boolean>(COLLAPSED_KEY, false))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // Set at once on the first click, so a double click can't run the sign-out twice.
  const signOutStarted = useRef(false)
  const permissions = useManagerPermissions(pathname, isManager, session?.permissions ?? {})
  const access: AdminAccess = { isOwner: !isManager, permissions }
  const newReviews = useBadgeCount(getNewReviewCount, REVIEWS_SEEN_EVENT, true, pathname, !!session && allowed(access, 'reviews'))
  const unreadEnquiries = useBadgeCount(getUnreadEnquiryCount, ENQUIRIES_CHANGED_EVENT, false, pathname, !!session && allowed(access, 'enquiries'))
  const badges = { reviews: newReviews, enquiries: unreadEnquiries }

  // Each page starts at the top. (The phone drawer closes from the menu click itself.)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  if (!session) return <Navigate to={signInPath(null)} replace />

  const canSee = (item: Item) =>
    item.ownerOnly ? access.isOwner : !item.section || allowed(access, item.section, item.action ?? 'view')
  const menu = MENU.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter((g) => g.items.length)
  const firstPage = menu[0]?.items[0] ? panel(menu[0].items[0].to, session) : undefined

  // The owner works at /admin/..., a manager at /manager/...: someone on the other one's address
  // (an old bookmark, a shared link) is moved to the same page at their own.
  const base = panelBase(session)
  const ownPath = panel(asOwnerPath(pathname), session)
  if (ownPath !== pathname) return <Navigate to={`${ownPath}${search}`} replace />

  // The page asked for, if this person may open it.
  const ownerPath = asOwnerPath(pathname)
  const rule = PAGE_RULES.find(([pattern]) => pattern.test(ownerPath))
  const pageAllowed = !rule || (rule[1] === 'owner' ? access.isOwner : rule[1] === 'manager' ? isManager : allowed(access, rule[1], rule[2]))
  // A manager without the dashboard lands on the first section they have.
  if (!pageAllowed && /^\/admin\/?$/.test(ownerPath) && firstPage && firstPage !== base) return <Navigate to={firstPage} replace />

  const toggleCollapsed = () => {
    writeStored(COLLAPSED_KEY, !collapsed)
    setCollapsed(!collapsed)
  }
  const signOut = () => {
    const to = signInPath(session)
    clearAdminSession()
    navigate(to, { replace: true })
  }

  return (
    <AdminAccessContext.Provider value={access}>
      <div className={`admin${collapsed ? ' admin--collapsed' : ''}${drawerOpen ? ' admin--drawer-open' : ''}`}>
        <aside className="admin-sidebar" aria-label="Admin menu">
          <div className="admin-sidebar__brand">
            <Link to={firstPage ?? base} className="admin-sidebar__logo" aria-label="Home of the admin panel">
              <img src={logo} alt="Swahasree" width={150} height={73} className="admin-sidebar__logo-full" />
              {/* The Swahasree brand mark stands in when the menu is collapsed to icons. */}
              <img src="/favicon-96x96.png" alt="" width={36} height={36} className="admin-sidebar__logo-mark" />
            </Link>
            <button className="admin-sidebar__close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <CloseIcon />
            </button>
          </div>

          <nav className="admin-nav">
            {menu.map((group, i) => (
              <div key={i} className="admin-nav__group">
                {group.heading && <p className="admin-nav__heading">{group.heading}</p>}
                {group.items.map((item) => (
                  <NavLink key={item.to} to={panel(item.to, session)} end={item.end} className="admin-nav__link" title={collapsed ? item.label : undefined}
                    onClick={() => setDrawerOpen(false)}>
                    <span className="admin-nav__icon">{item.icon}</span>
                    <span className="admin-nav__label">{item.label}</span>
                    {item.badge && badges[item.badge] > 0 && (
                      <span className="admin-nav__badge" aria-label={`${badges[item.badge]} new`}>{badges[item.badge] > 99 ? '99+' : badges[item.badge]}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar__foot">
            {isManager && (
              <NavLink to={panel('/admin/profile', session)} className="admin-nav__link admin-nav__link--profile" title={collapsed ? 'My profile' : undefined}
                onClick={() => setDrawerOpen(false)}>
                <span className="admin-nav__icon"><ProfileIcon /></span>
                <span className="admin-nav__label">My profile<small>{session.loginId}</small></span>
              </NavLink>
            )}
            <a href="/" target="_blank" rel="noreferrer" className="admin-nav__link" title={collapsed ? 'View store' : undefined}>
              <span className="admin-nav__icon"><StoreIcon /></span>
              <span className="admin-nav__label">View store</span>
            </a>
            <button className="admin-nav__link" onClick={() => setConfirmingSignOut(true)} title={collapsed ? 'Sign out' : undefined}>
              <span className="admin-nav__icon"><LogoutIcon /></span>
              <span className="admin-nav__label">Sign out</span>
            </button>
            <button className="admin-sidebar__collapse" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} aria-expanded={!collapsed}>
              <CollapseIcon />
            </button>
          </div>
        </aside>

        {drawerOpen && <div className="admin-scrim" onClick={() => setDrawerOpen(false)} aria-hidden />}

        <ConfirmDialog
          open={confirmingSignOut}
          busy={signingOut}
          busyLabel="Signing out…"
          className="confirm-box--signout"
          tone="neutral"
          icon={<LogoutIcon size={22} />}
          title="Sign out?"
          message={
            <>
              <p>Are you sure you want to sign out of the admin panel?</p>
              <p className="signout-account">
                <span className="signout-account__label">Signed in as</span>
                <strong className="signout-account__email">{isManager ? `${session.loginId} (${session.email})` : session.email}</strong>
              </p>
              <p className="signout-note">You'll need to sign in again to access your account.</p>
            </>
          }
          confirmLabel="Sign out"
          cancelLabel="Stay signed in"
          onConfirm={() => {
            if (signOutStarted.current) return
            signOutStarted.current = true
            setSigningOut(true)
            signOut()
          }}
          // Closing only closes: nothing about the session changes.
          onCancel={() => setConfirmingSignOut(false)}
        />


        <div className="admin-main">
          {/* Only on phones and tablets, for the menu button; on desktop the pages use the full height. */}
          <header className="admin-topbar">
            <button className="admin-topbar__menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}>
              <MenuIcon />
            </button>
          </header>
          <main className="admin-content">
            {pageAllowed ? <Outlet /> : <NoAccess firstPage={firstPage} />}
          </main>
        </div>
      </div>
    </AdminAccessContext.Provider>
  )
}

/** A manager opened a page the owner hasn't given them (an old link, or access changed meanwhile). */
function NoAccess({ firstPage }: { firstPage?: string }) {
  return (
    <div className="panel empty-panel">
      <span className="empty-panel__icon"><LockKeyIcon size={28} /></span>
      <h2>You don't have access to this page</h2>
      <p>The store owner decides which parts of the admin panel you can use. Ask them if you need this one.</p>
      {firstPage && <Link to={firstPage} className="admin-button">Go to your first section</Link>}
    </div>
  )
}
