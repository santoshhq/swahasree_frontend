import { Link, Navigate, useParams } from 'react-router'
import { BrandLink, ErrorState, Loading } from '../components/ui'
import { ApiError, getBlog } from '../lib/api'
import { blogDate, blogPath, isoDate } from '../lib/blog'
import { blogPostJsonLd, usePageMeta } from '../lib/seo'
import { useFetch } from '../lib/useFetch'
import { BlogCard } from './BlogPage'
import { NotFoundPage } from './NotFoundPage'

/** One blog post at /blog/<slug>. */
export function BlogPostPage() {
  const { slug = '' } = useParams()
  const result = useFetch((signal) => getBlog(slug, signal), `blog|${slug}`)
  const post = result.data?.blog ?? null

  // While loading (or when the post is missing) the page leaves the <head> alone; NotFoundPage sets its own.
  usePageMeta(post ? {
    title: post.seo_title ?? post.title,
    description: post.meta_description ?? post.excerpt,
    image: post.featured_image,
    noindex: !post.allow_indexing,
    canonical: post.canonical_url ?? undefined,
    jsonLd: blogPostJsonLd(post),
  } : null)

  if (result.loading && !result.data) return <Loading label="Loading post…" />
  if (result.error) {
    return result.error instanceof ApiError && result.error.status === 404
      ? <NotFoundPage />
      : <div className="container page"><ErrorState message={result.error.message} onRetry={result.reload} /></div>
  }
  if (!post) return null
  // An old address of a renamed post: move on to the current one.
  if (post.slug !== slug) return <Navigate to={blogPath(post.slug)} replace />

  const related = result.data?.related ?? []
  const categoryLink = `/blog?category=${encodeURIComponent(post.category)}`

  return (
    <div className="container page blog-post">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden>/</span>
        <Link to="/blog">Blog</Link>
        <span aria-hidden>/</span>
        <Link to={categoryLink}>{post.category}</Link>
      </nav>

      <article className="blog-article">
        <header className="blog-article__head">
          <Link to={categoryLink} className="blog-card__category">{post.category}</Link>
          <h1>{post.title}</h1>
          <p className="blog-article__excerpt">{post.excerpt}</p>
          <p className="blog-card__meta">
            <time dateTime={isoDate(post.published_at)}>{blogDate(post.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{post.reading_minutes} min read</span>
          </p>
        </header>

        {post.featured_image && (
          <figure className="blog-article__cover">
            <img src={post.featured_image} alt={post.image_alt ?? ''} width={1200} height={630} fetchPriority="high" />
          </figure>
        )}

        {/* Cleaned by the backend before it was saved (services/blog_service.py): only plain article tags. */}
        <div className="blog-prose blog-article__body" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.tags.length > 0 && (
          <footer className="blog-article__tags">
            <h2 className="visually-hidden">Tags</h2>
            <ul>
              {post.tags.map((t) => <li key={t}><Link to={`/blog?tag=${encodeURIComponent(t)}`} className="chip">#{t}</Link></li>)}
            </ul>
          </footer>
        )}
      </article>

      <aside className="blog-cta" aria-label="Shop">
        <div>
          <h2>Bring it to your kitchen</h2>
          <p>Find pickles and pantry ingredients for your next meal.</p>
        </div>
        <BrandLink to="/shop">Shop the pantry</BrandLink>
      </aside>

      {related.length > 0 && (
        <section className="blog-related" aria-labelledby="blog-related-title">
          <div className="blog-related__head">
            <h2 id="blog-related-title">Keep reading</h2>
            <Link to="/blog" className="text-button">All posts →</Link>
          </div>
          <ul className="blog-grid blog-grid--related">
            {related.map((r) => <li key={r.slug}><BlogCard post={r} headingLevel={3} /></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
