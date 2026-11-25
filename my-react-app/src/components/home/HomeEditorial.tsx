import { BadgeCheck, Check, ChevronDown, ChevronRight, CookingPot, Leaf, MapPin, PackageCheck, ShieldCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { PaymentMethod } from '../../lib/types'
import { CartIcon, ChevronIcon, LockIcon, TruckIcon } from '../Icons'

export function TrustStrip() {
  return (
    <div className="home-trust-strip">
      <ul className="container">
        <li><CartIcon size={20} /> Choose your pack size</li>
        <li><TruckIcon size={21} /> Delivery by PIN code</li>
        <li><LockIcon size={18} /> Secure checkout</li>
      </ul>
    </div>
  )
}

export function AboutSection() {
  return (
    <section className="home-section home-about" id="our-story" aria-labelledby="about-swahasree">
      <div className="container home-about__layout">
        <img src="/brand/andhra-kitchen.webp" alt="Hands spooning Andhra mango pickle into a glass jar" width="1100" height="733" loading="lazy" decoding="async" />
        <div className="home-about__copy">
          <p className="home-about__label">About Swahasree Foods</p>
          <h2 id="about-swahasree" className="section__title">Inspired by the Andhra family kitchen.</h2>
          <p>Some of the best meals start with a spoonful of pickle on hot rice, or a little podi and ghee alongside dosa.</p>
          <p>Swahasree Foods brings those familiar flavours to the everyday table, along with sweets to share and something crunchy for chai.</p>
          <details>
            <summary className="home-text-link">Know our story <ChevronIcon size={16} /></summary>
            <p>Our pantry takes its cues from the Andhra meals we grew up with. We bring pickles, podis, sweets and snacks together so that it’s easy to keep those traditions at your own table.</p>
          </details>
        </div>
      </div>
    </section>
  )
}

const licenseValue = (import.meta.env.VITE_FSSAI_LICENSE_NUMBER ?? '').trim()
const fssaiLicense = /^\d{14}$/.test(licenseValue) ? licenseValue : null
const customerCount = Number(import.meta.env.VITE_HOME_CUSTOMER_COUNT)
const numberFormat = new Intl.NumberFormat('en-IN')

const values = [
  { Icon: CookingPot, title: 'Authentic Andhra Recipes', copy: 'Traditional recipes passed down through generations, made the way home kitchens do.' },
  { Icon: PackageCheck, title: 'Small-Batch and Fresh', copy: 'Prepared in small batches and packed fresh, so you taste the difference.' },
  { Icon: Sprout, title: 'No Artificial Preservatives', copy: 'Pure ingredients, natural oils and spices. Nothing you can’t pronounce.' },
  { Icon: BadgeCheck, title: fssaiLicense ? 'Hygienic and FSSAI Licensed' : 'Hygienically Packed', copy: 'Made and packed in a clean kitchen.' },
]

function ReassuranceHeading({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <header className="home-reassurance__head">
      <h2 id={id}>{title}</h2>
      <span className="home-reassurance__divider" aria-hidden="true"><Leaf size={17} strokeWidth={2.25} /></span>
      <p>{subtitle}</p>
    </header>
  )
}

function ReassuranceIcon({ Icon }: { Icon: LucideIcon }) {
  return <span className="home-reassurance__icon" aria-hidden="true"><Icon size={28} strokeWidth={2.25} /></span>
}

export function WhyChooseUsSection() {
  return (
    <section className="home-section home-reassurance home-why" aria-labelledby="why-swahasree">
      <div className="container">
        <ReassuranceHeading id="why-swahasree" title="Why Swahasree" subtitle="Andhra family recipes, made with care for your everyday table." />
        <ul className="home-values" role="list">
          {values.map(({ Icon, title, copy }) => (
            <li className="home-reassurance__card" key={title}>
              <ReassuranceIcon Icon={Icon} />
              <h3>{title}</h3>
              <p>{copy}</p>
              {Icon === BadgeCheck && fssaiLicense && <p className="home-values__license">FSSAI Lic. No. {fssaiLicense}</p>}
            </li>
          ))}
        </ul>
        {Number.isSafeInteger(customerCount) && customerCount > 0 && (
          <dl className="home-values__stats">
            <dt>customers served</dt>
            <dd>{numberFormat.format(customerCount)}</dd>
          </dl>
        )}
      </div>
    </section>
  )
}

const paymentLabels = { upi: 'UPI', cards: 'Cards', netbanking: 'Net banking', wallets: 'Wallets' }
const enabledOnlineMethods = new Set<string>((import.meta.env.VITE_RAZORPAY_METHODS ?? '').split(',').map((method: string) => method.trim().toLowerCase()))
const paymentBadges = Object.entries(paymentLabels).filter(([key]) => enabledOnlineMethods.has(key))

export function PaymentAssurance({ methods }: { methods?: PaymentMethod[] }) {
  const prepaid = methods?.includes('PREPAID')
  const cod = methods?.includes('COD')
  const partial = methods?.includes('PARTIAL_PREPAID')

  return (
    <section className="home-section home-reassurance home-assurance" id="payment-delivery" aria-labelledby="assurance-heading">
      <div className="container">
        <ReassuranceHeading id="assurance-heading" title="Payment and delivery" subtitle="See how to pay, check delivery to your PIN code, and track your order." />
        <div className="home-assurance__grid">
          <article className="home-reassurance__card">
            <ReassuranceIcon Icon={ShieldCheck} />
            <div className="home-assurance__content">
              <h3>{prepaid ? 'Secure payments with Razorpay' : 'Payment options at checkout'}</h3>
              <p>{prepaid ? 'Pay online through Razorpay. Choose from the methods offered for your order at checkout.' : 'Review the payment options available for your order before you place it.'}</p>
              {prepaid && paymentBadges.length > 0 && (
                <ul className="home-assurance__methods" aria-label="Online payment methods" role="list">
                  {paymentBadges.map(([key, label]) => <li key={key}><Check size={15} strokeWidth={2.5} aria-hidden="true" />{label}</li>)}
                </ul>
              )}
              {partial && <p className="home-assurance__note"><Check size={17} strokeWidth={2.5} aria-hidden="true" />Partial COD for eligible orders.</p>}
              {cod && <p className="home-assurance__note"><Check size={17} strokeWidth={2.5} aria-hidden="true" />Cash on delivery for eligible orders.</p>}
            </div>
          </article>
          <article className="home-reassurance__card">
            <ReassuranceIcon Icon={MapPin} />
            <div className="home-assurance__content">
              <h3>Delivery by PIN code</h3>
              <p>Enter your PIN code at checkout to check delivery availability, charges, and your estimated arrival when available.</p>
              <Link className="home-assurance__track" to="/track-order">Track order <ChevronRight size={17} aria-hidden="true" /></Link>
            </div>
          </article>
        </div>
        <details className="home-assurance__faq" id="shopping-faq">
          <summary>Shopping FAQ <ChevronDown size={20} aria-hidden="true" /></summary>
          <dl>
            <dt>How do I choose a pack size?</dt>
            <dd>Choose a size on the product card or product page to see its price before adding it to your cart.</dd>
            <dt>Where can I track my order?</dt>
            <dd>On Track Order, enter your order ID or the AWB number from your shipping update.</dd>
          </dl>
        </details>
      </div>
    </section>
  )
}
