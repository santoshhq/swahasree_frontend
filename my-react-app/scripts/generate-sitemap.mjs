// Writes public/sitemap.xml from the live catalogue: the shop's fixed pages, every category and
// sub-category with products, every product with its photos, and every published blog post (except
// those whose "Allow search engines to index this blog" box is off) with its featured image.
// Runs before each build (npm run build), or on its own with npm run sitemap.
//
// If the store can't be reached, the sitemap already in public/ is kept and the build goes on.
// SITEMAP_API=http://host:port/api reads another backend (default: the live site's).
import { writeFile } from 'node:fs/promises'

const SITE = (process.env.VITE_SITE_URL || 'https://swahasree.com').replace(/\/$/, '')
const API = process.env.SITEMAP_API?.replace(/\/$/, '')
const OUT = new URL('../public/sitemap.xml', import.meta.url)
// The API's largest page.
const PAGE = 100

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/shop', priority: '0.9', changefreq: 'daily' },
  { path: '/bulk-orders', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog', priority: '0.7', changefreq: 'weekly' },
  { path: '/privacy-policy', priority: '0.2', changefreq: 'yearly' },
  { path: '/terms', priority: '0.2', changefreq: 'yearly' },
  { path: '/refund-policy', priority: '0.2', changefreq: 'yearly' },
]

async function get(path) {
  const response = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw Object.assign(new Error(`${path}: HTTP ${response.status}`), { status: response.status })
  return response.json()
}

async function allProducts() {
  const products = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await get(`/public/products?limit=${PAGE}&skip=${skip}`)
    products.push(...page.products)
    if (!page.products.length || products.length >= page.total) return products
  }
}

// Published posts, newest first. A backend from before the blog answers 404: no posts yet, rather
// than no sitemap. Any other failure stops the update, like the catalogue's.
async function allBlogs() {
  const blogs = []
  try {
    for (let skip = 0; ; skip += PAGE) {
      const page = await get(`/public/blogs?limit=${PAGE}&skip=${skip}`)
      blogs.push(...page.blogs)
      if (!page.blogs.length || blogs.length >= page.total) return blogs
    }
  } catch (error) {
    if (error.status === 404 && !blogs.length) return []
    throw error
  }
}

// The backend sends UTC without a timezone suffix; the sitemap wants W3C dates.
const lastmod = (iso) => (iso ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).toISOString() : null)

// Blog pictures can come back with the backend's internal address (http://127.0.0.1:7676/files/...);
// the same files are public under the site's /api/files/ (src/lib/api.ts does the same for the shop).
const publicFile = (url) => url.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|backend)(?::\d+)?\/files\//, `${SITE}/api/files/`)

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function entry({ path, priority, changefreq, images = [], modified = null }) {
  return [
    '  <url>',
    `    <loc>${xml(SITE + path)}</loc>`,
    ...(modified ? [`    <lastmod>${modified}</lastmod>`] : []),
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    ...images.map((src) => `    <image:image><image:loc>${xml(src)}</image:loc></image:image>`),
    '  </url>',
  ].join('\n')
}

if (!API) {
  console.log('Sitemap: using the bundled static pages. Set SITEMAP_API to include the current catalogue.')
  process.exit(0)
}

try {
  const [categories, products, blogs] = await Promise.all([get('/public/categories'), allProducts(), allBlogs()])
  const indexedBlogs = blogs.filter((b) => b.allow_indexing !== false)
  const pages = [
    ...STATIC_PAGES,
    ...categories.filter((c) => c.product_count > 0).flatMap((c) => {
      const base = `/category/${encodeURIComponent(c.category_id)}`
      return [
        { path: base, priority: '0.8', changefreq: 'weekly' },
        ...c.sub_categories
          .filter((s) => s.product_count > 0)
          .map((s) => ({ path: `${base}/${encodeURIComponent(s.name)}`, priority: '0.7', changefreq: 'weekly' })),
      ]
    }),
    ...products.filter((p) => p.status !== false).map((p) => ({
      path: `/product/${encodeURIComponent(p.product_id)}`,
      priority: '0.8',
      changefreq: 'weekly',
      images: (p.product_imgs ?? []).map((url) => new URL(publicFile(url), SITE).href),
    })),
    ...indexedBlogs.map((b) => ({
      path: `/blog/${encodeURIComponent(b.slug)}`,
      priority: '0.6',
      changefreq: 'monthly',
      images: b.featured_image ? [publicFile(b.featured_image)] : [],
      modified: lastmod(b.updated_at),
    })),
  ]
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...pages.map(entry),
    '</urlset>',
    '',
  ].join('\n')
  await writeFile(OUT, body)
  console.log(`sitemap.xml: ${pages.length} pages (${products.length} products, ${indexedBlogs.length} blog posts, from ${API})`)
} catch (error) {
  console.warn(`sitemap.xml not updated, keeping the one in public/ (${error.message})`)
}
