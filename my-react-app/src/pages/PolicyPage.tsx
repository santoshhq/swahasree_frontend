import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SUPPORT_EMAIL } from '../lib/format'
import { snippet, usePageMeta } from '../lib/seo'

// DRAFT policies, written from how the store actually works (email sign-in codes, Razorpay or cash on
// delivery, Shiprocket delivery, cancelling before packing). Have them checked before relying on them.
// A paragraph is usually plain text; JSX when it needs a link or bold text.
type Section = { heading: string; paragraphs?: ReactNode[]; points?: string[] }
// updated: when this policy last changed, if not on UPDATED with the others.
type Policy = { title: string; intro: string; sections: Section[]; updated?: string }

export type PolicyId = 'privacy' | 'terms' | 'refund'

const UPDATED = '13 October 2026'

const POLICIES: Record<PolicyId, Policy> = {
  privacy: {
    title: 'Privacy Policy',
    updated: '27 October 2026',
    intro: 'This policy explains what information Swahasree collects when you shop with us, why we need it, and how we look after it.',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          'Swahasree uses contact and delivery information to manage orders and customer requests.',
          <>
            For privacy-related questions or requests concerning your personal information, please contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </>,
        ],
      },
      {
        heading: 'What we collect',
        points: [
          'Your name, email address and mobile number, which you give us at checkout.',
          'Your delivery address, so we can deliver your order.',
          'Your orders: what you bought, how you paid and where each order is.',
          'Reviews you post, including the display name you choose. Your email is never shown with a review.',
        ],
      },
      {
        heading: 'How we use it',
        points: [
          'To process, pack and deliver your orders, and to send you order updates.',
          'To sign you in and show your order history.',
          'To answer your questions and handle cancellations, returns and refunds.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: ['We share only what each partner needs to do its job, and we never sell your information.'],
        points: [
          'Our delivery partner (Shiprocket and its couriers) receives your name, phone number and delivery address.',
          'Online payments are handled by Razorpay. Your card, UPI and bank details go straight to Razorpay; we never see or store them.',
        ],
      },
      {
        heading: 'On your device',
        paragraphs: ['Your browser keeps your cart, your sign-in and the address you last used, so you do not have to enter them again. Signing out or clearing your browser data removes them.'],
      },
      {
        heading: 'Your choices',
        paragraphs: [`You can ask us for a copy of your information, or ask us to correct or delete it, by writing to ${SUPPORT_EMAIL}. We keep order records for as long as the law requires.`],
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'These terms apply when you browse or order from Swahasree. By placing an order, you agree to them.',
    sections: [
      {
        heading: 'Products and prices',
        points: [
          'Prices are in Indian rupees. The total, including any delivery charge or cash-on-delivery fee, is shown before you place your order.',
          'Product photos illustrate the contents and may differ from the pack you receive.',
          'We may change prices or stop selling a product at any time. This does not affect orders already placed.',
        ],
      },
      {
        heading: 'Orders',
        points: [
          'Your order is placed when you see the order confirmation. For online payments, it is placed once the payment succeeds.',
          'If we cannot fulfil an order, for example because an item has run out, we will let you know and refund anything you paid in full.',
        ],
      },
      {
        heading: 'Payment',
        paragraphs: ['You can pay online through Razorpay (cards, UPI, net banking and wallets) or in cash on delivery where it is available. A small cash-on-delivery fee may apply and is shown at checkout.'],
      },
      {
        heading: 'Delivery',
        paragraphs: ['We deliver through our courier partners. Delivery times are estimates. Please check your address and phone number carefully, as we cannot be responsible for delays caused by incorrect details.'],
      },
      {
        heading: 'Cancellations, returns and refunds',
        paragraphs: ['You can cancel an order until it is packed. Returns and refunds are covered by our Return & Refund Policy.'],
      },
      {
        heading: 'Contact',
        paragraphs: [`Questions about these terms? Write to ${SUPPORT_EMAIL}.`],
      },
    ],
  },
  refund: {
    title: 'Return & Refund Policy',
    updated: '18 October 2026',
    intro: 'We want you to be happy with every order. If something is not right, this policy explains when you can return an item, how refunds work and how to cancel an order.',
    sections: [
      {
        heading: 'Returns',
        points: [
          'You can ask for a return within 15 days of delivery. After 15 days, we are unable to offer a refund or an exchange.',
          'The item must be unused, in its original packaging and in the same condition you received it.',
          'We need proof of purchase to complete a return, so please keep your order ID or invoice.',
          `To start a return, write to ${SUPPORT_EMAIL} with your order ID and a photo of the item.`,
          'Every return is accepted only after our customer care team has inspected the item.',
        ],
      },
      {
        heading: 'Partial refunds',
        paragraphs: ['In some cases, we can refund only part of the amount:'],
        points: [
          'The item is not in its original condition, or is damaged for reasons that are not our mistake.',
          'The item reaches us more than 15 days after it was delivered to you.',
        ],
      },
      {
        heading: 'How refunds are paid',
        points: [
          'When your returned item reaches us and has been inspected, we will email you to say we received it and whether your refund is approved.',
          'Approved refunds go back to your original payment method (card, UPI, net banking or wallet) through Razorpay.',
          'For cash-on-delivery orders, we refund by UPI or bank transfer to an account you give us.',
          'Refunds usually take 5–7 working days to show in your account after approval.',
        ],
      },
      {
        heading: 'Refund not received yet?',
        points: [
          'Check your bank account or UPI app again.',
          'Contact your bank or card provider. Refunds can take a few working days to be posted after we send them.',
          `Still nothing after 10 working days? Write to ${SUPPORT_EMAIL} with your order ID and payment transaction ID, and we will follow it up.`,
        ],
      },
      {
        heading: 'Cancelling an order',
        points: [
          'You can cancel from "Your orders" while the order is placed or confirmed, before it is packed. Once it is packed or shipped, it can no longer be cancelled.',
          'When an order is cancelled, you get a full refund of what you paid online. For cash on delivery, nothing is charged.',
          'We may cancel or decline an order, for example if an item is out of stock, a price or product detail was listed wrongly, or there is a problem with the delivery or payment details. If we do, anything you paid is refunded in full.',
        ],
      },
    ],
  },
}

export function PolicyPage({ id }: { id: PolicyId }) {
  const policy = POLICIES[id]
  usePageMeta({ title: policy.title, description: snippet(policy.intro) })

  return (
    <div className="container page policy">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{policy.title}</span>
      </nav>
      <header className="page-head">
        <h1>{policy.title}</h1>
        <p className="page-head__sub">Last updated {policy.updated ?? UPDATED}</p>
      </header>
      <p className="policy__intro">{policy.intro}</p>
      {policy.sections.map((section) => (
        <section key={section.heading} className="policy__section">
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
          {section.points && (
            <ul>
              {section.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
