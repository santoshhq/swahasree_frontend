import { Link } from 'react-router'
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY, WHATSAPP_DISPLAY, WHATSAPP_URL } from '../../lib/brand'
import { titleCase } from '../../lib/display'
import type { Category } from '../../lib/types'
import { LockIcon, MailIcon, PhoneIcon, WhatsAppIcon } from '../Icons'
import { StoreLogo } from '../StoreLogo'
import { categoryLink, homeCategories } from './catalog'

const license = (import.meta.env.VITE_FSSAI_LICENSE_NUMBER ?? '').trim()
const address = (import.meta.env.VITE_SUPPORT_ADDRESS ?? '').trim()
const year = new Date().getFullYear()

export function HomeFooter({ categories }: { categories: Category[] }) {
  return (
    <footer className="home-footer" id="contact">
      <div className="container home-footer__grid">
        <div className="home-footer__brand">
          <StoreLogo lazy />
          <p>Andhra flavours for the everyday table.</p>
          {/^[0-9]{14}$/.test(license) ? <p>FSSAI Lic. No. {license}</p>
            : import.meta.env.DEV && <p>Sample FSSAI Lic. No. 11223344556677</p>}
        </div>
        <nav aria-label="Footer shop">
          <h2>Shop</h2>
          <Link to="/shop">All products</Link>
          {homeCategories(categories).map(({ category }) => (
            <Link key={category.category_id} to={categoryLink(category)}>{titleCase(category.category_name)}</Link>
          ))}
          <Link to="/bulk-orders">Bulk orders</Link>
        </nav>
        <nav aria-label="Footer customer care">
          <h2>Customer care</h2>
          <Link to="/account">My orders</Link>
          <Link to="/track-order">Track order</Link>
          <a href="#shopping-faq">Shopping FAQ</a>
          <a href="#our-story">Our story</a>
          <Link to="/blog">The journal</Link>
        </nav>
        <nav aria-label="Footer policies">
          <h2>Policies</h2>
          <Link to="/privacy-policy">Privacy policy</Link>
          <Link to="/terms">Terms and conditions</Link>
          <Link to="/refund-policy">Returns and refunds</Link>
          <a href="#payment-delivery">Delivery information</a>
        </nav>
        <div className="home-footer__contact">
          <h2>Contact</h2>
          <a href={`mailto:${SUPPORT_EMAIL}`}><MailIcon size={16} /> {SUPPORT_EMAIL}</a>
          {SUPPORT_PHONE && <a href={`tel:${SUPPORT_PHONE}`}><PhoneIcon size={16} /> {SUPPORT_PHONE_DISPLAY}</a>}
          {WHATSAPP_URL && <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={16} /> WhatsApp {WHATSAPP_DISPLAY}</a>}
          {address && <address>{address}</address>}
          <a href="#from-our-kitchen">Watch our Instagram reels</a>
        </div>
      </div>
      <div className="container home-footer__bottom">
        <p>© {year} Swahasree Foods</p>
        <a href="#payment-delivery"><LockIcon size={15} /> Payment and delivery options</a>
        <Link to="/manager-login">Store manager login</Link>
      </div>
    </footer>
  )
}
