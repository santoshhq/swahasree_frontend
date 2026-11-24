import { useEffect } from 'react'
import { useLocation } from 'react-router'
import type { BlogPost } from './blog'
import type { Product } from './types'

// What search engines and link previews see for each page. index.html carries the same defaults
// (plus the store's Organization and WebSite structured data), so a crawler that doesn't run
// JavaScript, or a WhatsApp/Facebook preview, still gets the home page's.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://swahasree.com').replace(/\/$/, '')
export const SITE_NAME = 'Swahasree'
export const DEFAULT_TITLE = 'Swahasree | Andhra Pickles & Pantry'
export const DEFAULT_DESCRIPTION =
  'Discover Andhra pickles and pantry favourites from Swahasree. Shop mango avakaya, gongura, tomato pickle and more.'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`

export type PageMeta = {
  // The page's own part; " | Swahasree" is added. Leave out for the home page's title.
  title?: string
  description?: string
  image?: string
  // Pages that shouldn't be in search results (cart, checkout, account, search results, not found).
  noindex?: boolean
  // The page's original address when it isn't this one (a blog post first published elsewhere).
  canonical?: string
  // schema.org data for this page (Product, BreadcrumbList...), added next to index.html's.
  jsonLd?: object
}

// The head element matching tag[key="name"], created if missing; null value: removed.
function headTag(tag: string, key: string, name: string): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(`${tag}[${key}="${name}"]`)
  if (!el) {
    el = document.createElement(tag)
    el.setAttribute(key, name)
    document.head.appendChild(el)
  }
  return el
}

function setHead(tag: string, key: string, name: string, attr: string, value: string | null) {
  if (value === null) document.head.querySelector(`${tag}[${key}="${name}"]`)?.remove()
  else headTag(tag, key, name).setAttribute(attr, value)
}

function apply(title: string, description: string, image: string, url: string | null, noindex: boolean, jsonLd: string | null, canonical: string | null = url) {
  document.title = title
  setHead('meta', 'name', 'description', 'content', description)
  setHead('meta', 'property', 'og:title', 'content', title)
  setHead('meta', 'property', 'og:description', 'content', description)
  setHead('meta', 'property', 'og:image', 'content', image)
  setHead('meta', 'property', 'og:url', 'content', url)
  setHead('meta', 'name', 'twitter:title', 'content', title)
  setHead('meta', 'name', 'twitter:description', 'content', description)
  setHead('meta', 'name', 'twitter:image', 'content', image)
  setHead('meta', 'name', 'robots', 'content', noindex ? 'noindex, follow' : null)
  setHead('link', 'rel', 'canonical', 'href', noindex ? null : canonical)
  if (jsonLd === null) {
    document.head.querySelector('script[data-page-jsonld]')?.remove()
  } else {
    const script = headTag('script', 'data-page-jsonld', '')
    script.setAttribute('type', 'application/ld+json')
    script.textContent = jsonLd
  }
}

/**
 * Sets the page's title, description, canonical address, link preview and structured data, and
 * puts the defaults back when the page closes. null: leave them alone (the page is still loading,
 * or is showing NotFoundPage, which sets its own).
 */
export function usePageMeta(page: PageMeta | null) {
  // The canonical address is the path without its query: /shop?sort=newest is /shop.
  const { pathname } = useLocation()
  const skip = page === null
  const title = page?.title ? `${page.title} | ${SITE_NAME}` : DEFAULT_TITLE
  const description = page?.description ?? DEFAULT_DESCRIPTION
  const image = page?.image ?? DEFAULT_IMAGE
  const noindex = page?.noindex ?? false
  const jsonLd = page?.jsonLd ? JSON.stringify(page.jsonLd) : null
  const canonical = page?.canonical ?? null

  useEffect(() => {
    if (skip) return
    apply(title, description, image, SITE_URL + pathname, noindex, jsonLd, canonical ?? SITE_URL + pathname)
    return () => apply(DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, null, false, null)
  }, [skip, title, description, image, pathname, noindex, jsonLd, canonical])
}

// A description of at most max characters, cut at a word.
export function snippet(text: string, max = 158): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:\s]+$/, '')}…`
}

// The backend keeps category names in capitals ("RICE"); titles read better as "Rice".
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s/&-])(\p{L})/gu, (_, gap, c: string) => gap + c.toUpperCase())

export const breadcrumbs = (crumbs: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: 'Home', path: '/' }, ...crumbs].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: SITE_URL + c.path,
  })),
})

// A product's search result: price (or price range) in rupees, stock, rating and its place in the store.
export function productJsonLd(product: Product, rating: { average: number | null; count: number }) {
  const url = `${SITE_URL}/product/${encodeURIComponent(product.product_id)}`
  const prices = product.variants.map((v) => v.price)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const availability = `https://schema.org/${product.in_stock ? 'InStock' : 'OutOfStock'}`
  const seller = { '@type': 'Organization', name: 'Swahasree', url: `${SITE_URL}/` }
  const categoryPath = `/category/${encodeURIComponent(product.category_id)}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: product.product_name,
        url,
        sku: product.product_id,
        image: product.product_imgs ?? [],
        description: product.description ? snippet(product.description, 5000) : undefined,
        category: product.sub_category ?? titleCase(product.category_name),
        offers: prices.length
          ? low === high
            ? { '@type': 'Offer', url, priceCurrency: 'INR', price: low, availability, seller }
            : { '@type': 'AggregateOffer', url, priceCurrency: 'INR', lowPrice: low, highPrice: high, offerCount: prices.length, availability, seller }
          : undefined,
        aggregateRating: rating.count > 0 && rating.average !== null
          ? { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.count, bestRating: 5, worstRating: 1 }
          : undefined,
      },
      breadcrumbs([
        { name: titleCase(product.category_name), path: categoryPath },
        ...(product.sub_category ? [{ name: product.sub_category, path: `${categoryPath}/${encodeURIComponent(product.sub_category)}` }] : []),
        { name: product.product_name, path: `/product/${encodeURIComponent(product.product_id)}` },
      ]),
    ],
  }
}

// A blog post's search result: headline, picture, dates and its place on the blog.
export function blogPostJsonLd(post: BlogPost) {
  const url = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`
  const iso = (s: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`).toISOString()
  const store = { '@type': 'Organization', name: 'Swahasree', url: `${SITE_URL}/`, logo: `${SITE_URL}/brand/swahasree-logo.webp` }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        mainEntityOfPage: post.canonical_url ?? url,
        headline: post.title,
        description: post.meta_description ?? post.excerpt,
        image: post.featured_image ? [post.featured_image] : undefined,
        datePublished: iso(post.published_at),
        dateModified: iso(post.updated_at),
        articleSection: post.category,
        keywords: post.tags.length ? post.tags.join(', ') : undefined,
        author: store,
        publisher: store,
      },
      breadcrumbs([
        { name: 'Blog', path: '/blog' },
        { name: post.title, path: `/blog/${encodeURIComponent(post.slug)}` },
      ]),
    ],
  }
}
