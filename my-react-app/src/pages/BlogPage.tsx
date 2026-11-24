import { Link, useSearchParams } from 'react-router'
import { ArrowIcon } from '../components/Icons'
import { BrandLink, EmptyState, ErrorState, ProductImage } from '../components/ui'
import { getBlogs } from '../lib/api'
import { BLOG_CATEGORIES, blogDate, blogPath, isoDate, type BlogCategory, type BlogSummary } from '../lib/blog'
import { usePageMeta } from '../lib/seo'
import { useFetch } from '../lib/useFetch'

// Four full rows of three.
const PAGE_SIZE = 12
const DESCRIPTION = 'Serving ideas, pantry guides and recipes from Swahasree.'

/** The blog's front page: a plain grid of every published post, newest first, filtered by category or tag. */
export function BlogPage() {
  const [params] = useSearchParams()
  const category = (BLOG_CATEGORIES as readonly string[]).includes(params.get('category') ?? '') ? params.get('category') as BlogCategory : undefined
  const tag = params.get('tag')?.trim() || undefined
  const page = Math.max(1, Number(params.get('page')) || 1)
  const blogs = useFetch(
    (signal) => getBlogs({ category, tag, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }, signal),
    `blogs|${category ?? ''}|${tag ?? ''}|${page}`,
  )

  // A category page is worth finding in search; tag pages and later pages repeat what's elsewhere.
  usePageMeta({
    title: category ? `${category} | Blog` : tag ? `Posts tagged “${tag}” | Blog` : 'Blog',
    description: category ? `${category} from the Swahasree blog. ${DESCRIPTION}` : DESCRIPTION,
    noindex: !!tag || page > 1,
  })

  const total = blogs.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const posts = blogs.data?.blogs ?? []
  const categories = blogs.data?.categories ?? []
  const filtered = !!(category || tag)
  const pageLink = (n: number) => {
    const next = new URLSearchParams(params)
    if (n > 1) next.set('page', String(n))
    else next.delete('page')
    const text = next.toString()
    return text ? `/blog?${text}` : '/blog'
  }
  // Switching category keeps the old posts on screen, dimmed, until the new ones arrive.
  const refreshing = blogs.loading && !!blogs.data

  return (
    <div className="container page blog">
      <h1 className="blog__title">{category ?? (tag ? `Posts tagged “${tag}”` : 'Blog')}</h1>

      {/* Only worth showing once there's more than one category to choose between. */}
      {(categories.length > 1 || filtered) && (
        <nav className="blog-filters" aria-label="Blog categories">
          <Link to="/blog" className={`blog-filter${filtered ? '' : ' is-active'}`} aria-current={filtered ? undefined : 'page'}>
            All posts
          </Link>
          {categories.map((c) => (
            <Link
              key={c.category}
              to={`/blog?category=${encodeURIComponent(c.category)}`}
              className={`blog-filter${category === c.category ? ' is-active' : ''}`}
              aria-current={category === c.category ? 'page' : undefined}
            >
              {c.category} <span className="blog-filter__count">{c.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {blogs.loading && !blogs.data ? (
        <PostsSkeleton />
      ) : blogs.error ? (
        <ErrorState message={blogs.error.message} onRetry={blogs.reload} />
      ) : posts.length === 0 ? (
        <EmptyState title={filtered ? 'No posts here yet' : 'Our first posts are on the way'}>
          <p>{filtered ? 'Try another category, or see every post.' : 'Recipes and guides are coming soon. Meanwhile, have a look around the shop.'}</p>
          {filtered ? <BrandLink to="/blog">See all posts</BrandLink> : <BrandLink to="/shop">Browse all products</BrandLink>}
        </EmptyState>
      ) : (
        <ul className={`blog-grid${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing || undefined}>
          {posts.map((post) => <li key={post.slug}><BlogCard post={post} /></li>)}
        </ul>
      )}

      {pages > 1 && (
        <nav className="blog-pager" aria-label="More posts">
          {page > 1 ? <Link to={pageLink(page - 1)} className="blog-pager__link">← Newer posts</Link> : <span />}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link to={pageLink(page + 1)} className="blog-pager__link">Older posts →</Link> : <span />}
        </nav>
      )}
    </div>
  )
}

/** A post's card: picture, date, title, summary and "Read now". Also "Keep reading" under a post. */
export function BlogCard({ post, headingLevel = 2 }: { post: BlogSummary; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article className="blog-card">
      <Link to={blogPath(post.slug)} className="blog-card__media" tabIndex={-1} aria-hidden>
        <ProductImage src={post.featured_image} alt="" className="blog-card__img" />
      </Link>
      <div className="blog-card__body">
        <time className="blog-card__date" dateTime={isoDate(post.published_at)}>{blogDate(post.published_at)}</time>
        <Heading className="blog-card__title">
          <Link to={blogPath(post.slug)}>{post.title}</Link>
        </Heading>
        <p className="blog-card__excerpt">{post.excerpt}</p>
        <span className="blog-card__read" aria-hidden>Read now <ArrowIcon size={15} /></span>
      </div>
    </article>
  )
}

// Grey cards in the grid's shape while the first posts load, so the page doesn't jump.
function PostsSkeleton() {
  return (
    <div aria-busy="true">
      <p className="visually-hidden" role="status">Loading posts…</p>
      <ul className="blog-grid" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <div className="blog-card blog-card--skeleton">
              <div className="blog-card__media" />
              <div className="blog-card__body">
                <span className="skeleton-line skeleton-line--short" />
                <span className="skeleton-line" />
                <span className="skeleton-line" />
                <span className="skeleton-line skeleton-line--mid" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
