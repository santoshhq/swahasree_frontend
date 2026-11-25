import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { titleCase } from '../lib/display'
import { plural } from '../lib/format'
import type { Category } from '../lib/types'
import { useAuth } from '../state/auth'
import { useCart } from '../state/cart'
import { useSignIn } from '../state/signIn'
import { CartIcon, BlogIcon, BulkIcon, ChevronIcon, CloseIcon, LockIcon, MailIcon, MenuIcon, TruckIcon, UserIcon } from './Icons'
import { SearchBox } from './SearchBox'
import { StoreLogo } from './StoreLogo'

// The header stays pinned to the top on every screen. On phones the category bar gives way to a
// menu button that slides the categories in from the left (CategoryMenu).
export function Header({ categories }: { categories: Category[] }) {
  const { count } = useCart()
  const { session } = useAuth()
  const { openSignIn } = useSignIn()
  const [menuOpen, setMenuOpen] = useState(false)
  // Checkout keeps the shopper on the task: no search or category menu, just the way back to the cart.
  const checkout = useLocation().pathname === '/checkout'

  return (
    <header className="site-header">
      <div className={`site-header__bar container${checkout ? ' site-header__bar--checkout' : ''}`}>
        {!checkout && (
          <button
            type="button"
            className="menu-button"
            aria-label="Shop by category"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        )}

        <StoreLogo className="site-header__logo" />

        {checkout ? (
          <p className="site-header__secure"><LockIcon /> Secure checkout</p>
        ) : (
          <SearchBox />
        )}

        <nav className="site-header__actions" aria-label="Your account and cart">
          {!checkout && (
            session ? (
              <Link to="/account" className="icon-link" aria-label="My account and orders">
                <UserIcon />
                <span className="icon-link__label">Account</span>
              </Link>
            ) : (
              // Signing in happens in a popup over the current page (SignInDialog).
              <button type="button" className="icon-link" aria-haspopup="dialog" aria-label="Sign in" onClick={() => openSignIn()}>
                <UserIcon />
                <span className="icon-link__label">Sign in</span>
              </button>
            )
          )}
          <Link to="/cart" className="icon-link" aria-label={count > 0 ? `Cart, ${plural(count, 'item')}` : 'Cart, empty'}>
            <span className="icon-link__icon">
              <CartIcon />
              {count > 0 && <span className="badge" aria-hidden>{count > 99 ? '99+' : count}</span>}
            </span>
            <span className="icon-link__label">Cart</span>
          </Link>
        </nav>
      </div>

      {/* Category bar on tablets and laptops (hidden on phones, where the menu button takes over).
          Only categories with products come back from the API. */}
      {!checkout && (
        <nav className="category-bar" aria-label="Shop by category">
          <div className="container">
            <ul className="category-bar__list">
              <li><NavLink to="/shop" end className="category-bar__link">Shop all</NavLink></li>
              {categories.map((c) => (
                <li key={c.category_id}>
                  <NavLink to={`/category/${c.category_id}`} className="category-bar__link">
                    {titleCase(c.category_name)}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/bulk-orders" className="category-bar__link category-bar__link--quiet">
                  <BulkIcon size={16} /> Bulk Orders
                </NavLink>
              </li>
              <li>
                <NavLink to="/track-order" className="category-bar__link category-bar__link--quiet">
                  <TruckIcon size={16} /> Track order
                </NavLink>
              </li>
              <li><NavLink to="/blog" className="category-bar__link category-bar__link--quiet">Journal</NavLink></li>
              <li><a href="#contact" className="category-bar__link category-bar__link--quiet">Contact</a></li>
            </ul>
          </div>
        </nav>
      )}

      {!checkout && (
        <CategoryMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          categories={categories}
          signedIn={Boolean(session)}
        />
      )}
    </header>
  )
}

/**
 * The phone menu: a modal <dialog> sliding in from the left (see .menu-drawer in App.css). The
 * browser gives it the focus trap, Escape to close and the focus back on the menu button.
 * Choosing a link, tapping the dimmed page or the close button closes it.
 */
function CategoryMenu({ open, onClose, categories, signedIn }: { open: boolean; onClose: () => void; categories: Category[]; signedIn: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // One category's sub-categories open at a time; the one being browsed starts open.
  const { pathname } = useLocation()
  const [expanded, setExpanded] = useState<string | null>(null)
  const { openSignIn } = useSignIn()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // A tap on the backdrop lands on the <dialog> itself (its panel fills the box); a tap on a link
  // means the shopper has chosen where to go.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget || (e.target as Element).closest('a')) onClose()
  }

  return (
    <dialog ref={ref} className="menu-drawer" aria-labelledby={titleId} onClose={onClose} onClick={onClick}>
      <div className="menu-drawer__panel">
        <div className="menu-drawer__head">
          <h2 id={titleId} className="menu-drawer__title">Menu</h2>
          <button type="button" className="menu-drawer__close" aria-label="Close menu" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <nav className="menu-drawer__body" aria-label="Categories">
          <ul className="menu-drawer__list">
            <li>
              <NavLink to="/shop" end className="menu-drawer__link">Shop all</NavLink>
            </li>
            {categories.map((c) => {
              const subs = c.sub_categories.filter((s) => s.product_count > 0)
              const to = `/category/${c.category_id}`
              const isOpen = expanded === c.category_id || (expanded === null && pathname.startsWith(`${to}/`))
              return (
                <li key={c.category_id}>
                  <div className="menu-drawer__row">
                    <NavLink to={to} end={subs.length > 0} className="menu-drawer__link">
                      {titleCase(c.category_name)}
                      <span className="menu-drawer__count">{c.product_count}</span>
                    </NavLink>
                    {subs.length > 0 && (
                      <button
                        type="button"
                        className="menu-drawer__toggle"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} ${titleCase(c.category_name)} sub-categories`}
                        onClick={() => setExpanded(isOpen ? '' : c.category_id)}
                      >
                        <ChevronIcon size={18} />
                      </button>
                    )}
                  </div>
                  {subs.length > 0 && isOpen && (
                    <ul className="menu-drawer__subs">
                      {subs.map((s) => (
                        <li key={s.name}>
                          <NavLink to={`${to}/${encodeURIComponent(s.name)}`} className="menu-drawer__sublink">
                            {s.name}
                            <span className="menu-drawer__count">{s.product_count}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
            <li className="menu-drawer__extra">
              <NavLink to="/bulk-orders" className="menu-drawer__link">
                <span className="menu-drawer__label"><BulkIcon size={20} /> Bulk orders</span>
              </NavLink>
            </li>
            <li className="menu-drawer__extra">
              <NavLink to="/track-order" className="menu-drawer__link">
                <span className="menu-drawer__label"><TruckIcon size={20} /> Track order</span>
              </NavLink>
            </li>
            <li className="menu-drawer__extra">
              <NavLink to="/blog" className="menu-drawer__link">
                <span className="menu-drawer__label"><BlogIcon size={20} /> Journal</span>
              </NavLink>
            </li>
            <li className="menu-drawer__extra">
              <a href="#contact" className="menu-drawer__link">
                <span className="menu-drawer__label"><MailIcon size={20} /> Contact</span>
              </a>
            </li>
          </ul>
        </nav>

        <div className="menu-drawer__foot">
          {signedIn ? (
            <Link to="/account" className="menu-drawer__account">
              <UserIcon size={20} />
              My orders
            </Link>
          ) : (
            // The menu closes first, so the sign-in popup is the only one open.
            <button type="button" className="menu-drawer__account" aria-haspopup="dialog" onClick={() => { onClose(); openSignIn() }}>
              <UserIcon size={20} />
              Sign in
            </button>
          )}
          <Link to="/cart" className="menu-drawer__account">
            <CartIcon size={20} />
            Cart
          </Link>
        </div>
      </div>
    </dialog>
  )
}
