// The blog: posts written in the admin panel's Blog section and read at /blog/<slug>.
// The backend's models/blog_model.py has the same categories and limits.

export const BLOG_CATEGORIES = [
  'Product Guides', 'Health & Nutrition', 'Recipes', 'Organic Farming', 'Sustainable Living', 'Store News',
] as const
export type BlogCategory = (typeof BLOG_CATEGORIES)[number]

export type BlogStatus = 'draft' | 'published'

export const MAX_TAGS = 15
export const MAX_TAG_LENGTH = 40
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// What search results show before cutting a title or description short.
export const SEO_TITLE_IDEAL = 60
export const META_DESCRIPTION_IDEAL = 160

/** A post as a card on the blog page (no content). allow_indexing and updated_at are for the sitemap. */
export type BlogSummary = {
  slug: string
  title: string
  excerpt: string
  featured_image: string
  image_alt: string | null
  category: BlogCategory
  tags: string[]
  reading_minutes: number
  published_at: string
  updated_at: string
  allow_indexing: boolean
}

export type BlogPost = BlogSummary & {
  content: string
  seo_title: string | null
  meta_description: string | null
  canonical_url: string | null
}

/** "How to Serve Avakaya!" → "how-to-serve-avakaya". */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/, '')
}

/** The comma-separated Tags box as a list: trimmed, no empties or repeats (ignoring case). */
export function parseTags(text: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of text.split(',')) {
    const tag = raw.split(/\s+/).filter(Boolean).join(' ')
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase())
      tags.push(tag)
    }
  }
  return tags
}

export const blogPath = (slug: string) => `/blog/${encodeURIComponent(slug)}`

/** "24 October 2026". The backend sends UTC without a timezone suffix. */
export function blogDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** The date as the <time dateTime> attribute wants it. */
export function isoDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).toISOString()
}

/** Who saved a post, as the admin panel shows it: a manager by their login ID, or the store owner. */
export const editorName = (by: { role: string; email: string; login_id?: string }) =>
  by.role === 'manager' ? by.login_id ?? by.email : 'Store owner'

/** The embed address for a YouTube or Vimeo link, or null if it's neither. */
export function videoEmbedUrl(link: string): string | null {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1)
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1] ?? null
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
  const vimeo = (host === 'vimeo.com' || host === 'player.vimeo.com') && url.pathname.match(/(\d{1,12})(?:\/|$)/)?.[1]
  return vimeo ? `https://player.vimeo.com/video/${vimeo}` : null
}

/** Words in a post's HTML. */
export function countWords(html: string): number {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  return text.split(/\s+/).filter(Boolean).length
}

/** Whether there's anything to read or see (an emptied editor still holds "<p><br></p>"). */
export function hasContent(html: string): boolean {
  return countWords(html) > 0 || /<(img|iframe)\b/i.test(html)
}
