import { Link } from 'react-router'
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../lib/brand'
import { LockIcon, MailIcon, PhoneIcon } from './Icons'
import { StoreLogo } from './StoreLogo'

const YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer id="contact" className="pantry-footer">
      <div className="container pantry-footer__grid">
        <div className="pantry-footer__brand">
          <StoreLogo lazy />
          <p>Andhra flavours for the everyday table.</p>
        </div>
        <nav aria-label="Shop">
          <h2>Shop</h2>
          <Link to="/shop">All products</Link>
          <Link to="/bulk-orders">Bulk orders</Link>
          <Link to="/blog">The journal</Link>
        </nav>
        <nav aria-label="Customer care">
          <h2>Customer care</h2>
          <Link to="/account">My orders</Link>
          <Link to="/track-order">Track order</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}><MailIcon size={16} /> {SUPPORT_EMAIL}</a>
          {SUPPORT_PHONE && <a href={`tel:${SUPPORT_PHONE}`}><PhoneIcon size={16} /> {SUPPORT_PHONE_DISPLAY}</a>}
        </nav>
        <nav aria-label="Store policies">
          <h2>Policies</h2>
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund-policy">Returns and refunds</Link>
        </nav>
      </div>
      <div className="container pantry-footer__bottom">
        <p>© {YEAR} Swahasree</p>
        <Link to="/manager-login"><LockIcon size={14} /> Store manager login</Link>
      </div>
    </footer>
  )
}
