import { useEffect, useRef, useState, type DragEvent, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ErrorState, Loading } from '../../components/ui'
import { checkBlogSlug, createBlog, getAdminBlog, updateBlog, type AdminBlog, type BlogInput } from '../../lib/adminApi'
import {
  BLOG_CATEGORIES, blogDate, blogPath, editorName, hasContent, MAX_TAG_LENGTH, MAX_TAGS, META_DESCRIPTION_IDEAL, parseTags, SEO_TITLE_IDEAL, SLUG_PATTERN, slugify,
  type BlogCategory, type BlogStatus,
} from '../../lib/blog'
import { panel } from '../../lib/panelPath'
import { SITE_URL } from '../../lib/seo'
import { useFetch } from '../../lib/useFetch'
import { AlertIcon, ExternalLinkIcon, ImageIcon, SpinnerIcon, UploadIcon } from './AdminIcons'
import { AdminPageHead, ConfirmDialog, Panel, Toast } from './AdminUi'
import { RichTextEditor } from './RichTextEditor'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const EXCERPT_MAX = 300
const SEO_TITLE_MAX = 120
const META_DESCRIPTION_MAX = 320
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '')

export function BlogFormPage() {
  const { blogId } = useParams()
  const blog = useFetch((signal) => (blogId ? getAdminBlog(blogId, signal) : Promise.resolve(null)), `admin-blog|${blogId ?? 'new'}`)
  if (blog.loading) return <Loading />
  if (blog.error) return <ErrorState message={blog.error.message} onRetry={blog.reload} />
  return <BlogForm key={blogId ?? 'new'} blog={blog.data} />
}

type Errors = Partial<Record<'title' | 'slug' | 'excerpt' | 'image' | 'tags' | 'content' | 'seoTitle' | 'metaDescription' | 'canonicalUrl', string>>
type NewImage = { file: File; preview: string }

function BlogForm({ blog }: { blog: AdminBlog | null }) {
  const navigate = useNavigate()
  const editing = !!blog
  const formRef = useRef<HTMLFormElement>(null)

  const [title, setTitle] = useState(blog?.title ?? '')
  const [slug, setSlug] = useState(blog?.slug ?? '')
  // A new post's slug follows its title until the slug is typed in by hand.
  const [slugTouched, setSlugTouched] = useState(editing)
  const [excerpt, setExcerpt] = useState(blog?.excerpt ?? '')
  const [image, setImage] = useState<NewImage | null>(null)
  const [imageAlt, setImageAlt] = useState(blog?.image_alt ?? '')
  const [category, setCategory] = useState<BlogCategory>(blog?.category ?? 'Product Guides')
  const [tagsText, setTagsText] = useState((blog?.tags ?? []).join(', '))
  const [content, setContent] = useState(blog?.content ?? '')
  const [seoTitle, setSeoTitle] = useState(blog?.seo_title ?? '')
  const [metaDescription, setMetaDescription] = useState(blog?.meta_description ?? '')
  const [canonicalUrl, setCanonicalUrl] = useState(blog?.canonical_url ?? '')
  const [allowIndexing, setAllowIndexing] = useState(blog?.allow_indexing ?? true)
  const [status, setStatus] = useState<BlogStatus>(blog?.status ?? 'draft')

  const [slugCheck, setSlugCheck] = useState<{ slug: string; available: boolean; reason: string | null } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)

  // Unsaved changes: the form as it is now against the form as it opened.
  const snapshot = JSON.stringify([title, slug, excerpt, image?.preview, imageAlt, category, tagsText, content, seoTitle, metaDescription, canonicalUrl, allowIndexing, status])
  const [initialSnapshot] = useState(snapshot)
  const dirty = snapshot !== initialSnapshot

  useEffect(() => {
    if (!dirty || saving) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])

  // Free the new picture's preview when it's replaced or the form goes away.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.preview) }, [image])

  // Is the slug free? Asked a moment after typing stops; the post's own slug always is.
  const ownSlug = slug === blog?.slug
  useEffect(() => {
    if (ownSlug || !SLUG_PATTERN.test(slug)) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      checkBlogSlug(slug, blog?.blog_id, controller.signal).then(setSlugCheck).catch(() => {})
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [slug, ownSlug, blog?.blog_id])
  const slugState: 'ok' | 'taken' | 'checking' | null = !slug || !SLUG_PATTERN.test(slug)
    ? null
    : ownSlug ? 'ok' : slugCheck?.slug !== slug ? 'checking' : slugCheck.available ? 'ok' : 'taken'

  const tags = parseTags(tagsText)

  const validate = (): Errors => {
    const e: Errors = {}
    if (!title.trim()) e.title = 'Give the post a title.'
    if (!slug) e.slug = 'Add the URL slug, e.g. how-to-serve-avakaya.'
    else if (!SLUG_PATTERN.test(slug)) e.slug = 'Use lowercase letters, numbers and single hyphens only, e.g. how-to-serve-avakaya.'
    else if (slugState === 'taken') e.slug = slugCheck?.reason ?? 'Another post already uses this slug.'
    if (!excerpt.trim()) e.excerpt = 'Write a short description for the blog page and search results.'
    else if (excerpt.trim().length > EXCERPT_MAX) e.excerpt = `Keep it to ${EXCERPT_MAX} characters.`
    if (!editing && !image) e.image = 'Add a featured image.'
    if (tags.length > MAX_TAGS) e.tags = `Use at most ${MAX_TAGS} tags.`
    else if (tags.some((t) => t.length > MAX_TAG_LENGTH)) e.tags = `Each tag can be at most ${MAX_TAG_LENGTH} characters.`
    if (!hasContent(content)) e.content = 'Write the post before saving it.'
    if (seoTitle.trim().length > SEO_TITLE_MAX) e.seoTitle = `Keep it to ${SEO_TITLE_MAX} characters.`
    if (metaDescription.trim().length > META_DESCRIPTION_MAX) e.metaDescription = `Keep it to ${META_DESCRIPTION_MAX} characters.`
    if (canonicalUrl.trim() && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(canonicalUrl.trim())) e.canonicalUrl = 'Enter the full address, starting with https://.'
    return e
  }
  const errors = submitted ? validate() : {}

  const addImage = (files: FileList | File[]) => {
    const file = Array.from(files)[0]
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return setToast(`${file.name} isn't a JPEG, PNG or WebP image.`)
    if (file.size > MAX_IMAGE_BYTES) return setToast(`${file.name} is larger than 5 MB.`)
    setImage({ file, preview: URL.createObjectURL(file) })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addImage(e.dataTransfer.files)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    const problems = validate()
    if (Object.keys(problems).length) {
      // The first field with a problem, in the order the form shows them.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      if (slugState === 'checking') setServerError('Still checking whether the URL slug is free. Try again in a moment.')
      return
    }
    const input: BlogInput = {
      title: title.trim(),
      slug,
      excerpt: excerpt.trim(),
      image_alt: imageAlt.trim() || null,
      category,
      tags,
      content,
      seo_title: seoTitle.trim() || null,
      meta_description: metaDescription.trim() || null,
      canonical_url: canonicalUrl.trim() || null,
      allow_indexing: allowIndexing,
      status,
    }
    setSaving(true)
    try {
      const res = editing ? await updateBlog(blog.blog_id, input, image?.file ?? null) : await createBlog(input, image!.file)
      const done = res.blog.status === 'published'
        ? editing && blog.status === 'published' ? 'was saved' : 'is live on your blog'
        : 'was saved as a draft'
      navigate(panel('/admin/blogs'), { state: { toast: `${input.title} ${done}.` } })
    } catch (err) {
      setServerError((err as Error).message)
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Leaving by a link on this page with unsaved changes asks first. (Closing or reloading the tab
  // gets the browser's own question, from the beforeunload handler above.)
  const guardLeave = (to: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!dirty || saving) return
    e.preventDefault()
    setLeaveTo(to)
  }

  const blogsPath = panel('/admin/blogs')
  const wasPublished = blog?.status === 'published'
  const submitLabel = status === 'published' ? (wasPublished ? 'Save changes' : 'Publish now') : wasPublished ? 'Move to drafts' : 'Save as draft'
  const shownImage = image?.preview ?? blog?.featured_image ?? null
  const errorCount = Object.keys(errors).length
  const seoTitleLength = seoTitle.trim().length
  const metaLength = metaDescription.trim().length

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="product-form blog-form">
      <nav className="pf-crumbs" aria-label="Breadcrumb">
        <Link to={blogsPath} onClick={guardLeave(blogsPath)}>Blog</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{editing ? blog.title : 'New post'}</span>
      </nav>
      <AdminPageHead
        title={editing ? 'Edit Blog' : 'Create New Blog'}
        subtitle={editing
          ? wasPublished ? 'This post is live. Changes show on the blog as soon as you save.' : 'This post is a draft: only the admin panel can see it.'
          : 'Write the post, set how it shows in search results, then save it as a draft or publish it.'}
        stickyActions
        actions={
          <>
            <Link to={blogsPath} className="admin-button admin-button--ghost" onClick={guardLeave(blogsPath)}>Cancel</Link>
            <button type="submit" className="admin-button pf-submit" disabled={saving} aria-busy={saving || undefined}>
              {saving && <SpinnerIcon size={16} className="admin-spin" />}
              {saving ? (image ? 'Uploading…' : 'Saving…') : submitLabel}
            </button>
          </>
        }
      />

      {(serverError || errorCount > 0) && (
        <div className="pf-alert" role="alert">
          <AlertIcon />
          <div>
            <strong>{serverError ? "The post wasn't saved" : `Please fix ${errorCount === 1 ? 'this' : `these ${errorCount}`} first`}</strong>
            <p>{serverError ?? Object.values(errors).join(' ')}</p>
          </div>
        </div>
      )}

      <fieldset className="pf-columns" disabled={saving}>
        <div className="pf-main">
          <Panel title="Basic Information">
            <Field n={1} id="b-title" label="Blog Title" required error={errors.title}>
              <input id="b-title" className="admin-input" value={title} maxLength={200} placeholder="How to Serve Andhra Mango Pickle"
                aria-invalid={!!errors.title || undefined} aria-describedby={errors.title ? 'b-title-error' : undefined}
                onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
            </Field>

            <Field n={2} id="b-slug" label="URL Slug" required error={errors.slug}
              aside={slugState === 'checking' ? <span className="pf-counter">Checking…</span>
                : slugState === 'ok' ? <span className="bf-ok">Available</span>
                : slugState === 'taken' ? <span className="bf-bad">Taken</span> : null}>
              <div className="bf-slug">
                <span className="bf-slug__prefix" aria-hidden>/blog/</span>
                <input id="b-slug" className="admin-input" value={slug} maxLength={120} placeholder="how-to-serve-avakaya" spellCheck={false}
                  aria-invalid={!!errors.slug || slugState === 'taken' || undefined} aria-describedby="b-slug-help"
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '')) }}
                  onBlur={() => setSlug((s) => s.replace(/-+/g, '-').replace(/^-|-$/g, ''))} />
                {slugTouched && !editing && (
                  <button type="button" className="admin-button admin-button--ghost bf-slug__reset" onClick={() => { setSlugTouched(false); setSlug(slugify(title)) }}>
                    From title
                  </button>
                )}
              </div>
              <p id="b-slug-help" className="admin-hint admin-hint--tight">
                Public URL: <strong className="bf-url">{SITE_HOST}/blog/{slug || 'your-blog-slug'}</strong>
                {wasPublished && slug !== blog.slug && <> · The old address keeps working and forwards here.</>}
              </p>
            </Field>

            <Field n={3} id="b-excerpt" label="Short Description / Excerpt" required error={errors.excerpt}
              aside={<span className="pf-counter">{excerpt.trim().length}/{EXCERPT_MAX}</span>}>
              <textarea id="b-excerpt" className="admin-input pf-textarea" value={excerpt} maxLength={EXCERPT_MAX + 50} rows={3}
                placeholder="One or two sentences about the post, shown on the blog page and in search results."
                aria-invalid={!!errors.excerpt || undefined} onChange={(e) => setExcerpt(e.target.value)} />
            </Field>

            <Field n={4} id="b-image" label="Featured Image" required error={errors.image}>
              <div
                className={`pf-photos${dragging ? ' is-dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
                onDrop={onDrop}
              >
                {shownImage ? (
                  <div className="bf-cover">
                    {/* The picture alone in its frame: nothing is laid over it. */}
                    <div className="bf-cover__frame">
                      <img src={shownImage} alt={imageAlt || 'Featured image'} />
                    </div>
                    <div className="bf-cover__bar">
                      {image && (
                        <p className="bf-cover__status" role="status">
                          <span className="bf-cover__dot" aria-hidden />
                          Not saved yet<span className="bf-cover__file"> · {image.file.name}</span>
                        </p>
                      )}
                      <div className="bf-cover__actions">
                        <label className="admin-button admin-button--ghost">
                          <ImageIcon size={16} /> Replace image
                          <ImageInput id="b-image" onFiles={addImage} />
                        </label>
                        {image && editing && (
                          <button type="button" className="admin-button admin-button--ghost" onClick={() => setImage(null)}>Keep the current one</button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className={`pf-drop${errors.image ? ' is-invalid' : ''}`}>
                    <span className="pf-drop__icon"><UploadIcon size={24} /></span>
                    <span className="pf-drop__title">Upload featured image</span>
                    <span className="pf-drop__or">drag it here, or</span>
                    <span className="admin-button admin-button--ghost pf-drop__browse">Browse files</span>
                    <span className="pf-drop__meta">JPEG, PNG or WebP · up to 5 MB · 1200 × 630 px suits link previews best</span>
                    <ImageInput id="b-image" onFiles={addImage} invalid={!!errors.image} />
                  </label>
                )}
              </div>
            </Field>

            <Field n={5} id="b-alt" label="Image Alt Text" optional>
              <input id="b-alt" className="admin-input" value={imageAlt} maxLength={200} placeholder="What the picture shows, e.g. Mango pickle in a glass jar"
                onChange={(e) => setImageAlt(e.target.value)} />
              <p className="admin-hint admin-hint--tight">Read out by screen readers and used by search engines. Describe the picture, not the post.</p>
            </Field>

            <div className="field-pair">
              <Field n={6} id="b-category" label="Category" required>
                <select id="b-category" className="admin-input" value={category} onChange={(e) => setCategory(e.target.value as BlogCategory)}>
                  {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field n={7} id="b-tags" label="Tags" optional error={errors.tags}>
                <input id="b-tags" className="admin-input" value={tagsText} placeholder="rice, storage, kitchen tips"
                  aria-invalid={!!errors.tags || undefined} aria-describedby="b-tags-help" onChange={(e) => setTagsText(e.target.value)} />
                <p id="b-tags-help" className="admin-hint admin-hint--tight">Separate tags with commas.</p>
              </Field>
            </div>
            {tags.length > 0 && (
              <ul className="bf-tags" aria-label="Tags">
                {tags.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </Panel>

          <Panel title="Article Content">
            <div className="pf-field">
              <div className="pf-field__top">
                <span id="b-content-label" className="admin-label"><span className="bf-n">8.</span> Blog Content <Req /></span>
              </div>
              <RichTextEditor
                id="b-content"
                labelledBy="b-content-label"
                initialValue={blog?.content ?? ''}
                onChange={setContent}
                onError={setToast}
                invalid={!!errors.content}
                describedBy={errors.content ? 'b-content-error' : 'b-content-help'}
              />
              <p id="b-content-help" className="admin-hint admin-hint--tight">
                Paragraphs, headings, pictures, lists, links, tables and YouTube or Vimeo videos. Pictures can be pasted or dropped straight in.
              </p>
              <FieldError id="b-content-error" message={errors.content} />
            </div>
          </Panel>

          <Panel title="SEO Settings">
            <Field n={9} id="b-seo-title" label="SEO Title" optional error={errors.seoTitle}
              aside={<span className={`pf-counter${seoTitleLength > SEO_TITLE_IDEAL ? ' bf-over' : ''}`}>{seoTitleLength}/{SEO_TITLE_IDEAL}</span>}>
              <input id="b-seo-title" className="admin-input" value={seoTitle} maxLength={SEO_TITLE_MAX} placeholder={title || 'The title search results show'}
                aria-invalid={!!errors.seoTitle || undefined} aria-describedby="b-seo-title-help" onChange={(e) => setSeoTitle(e.target.value)} />
              <p id="b-seo-title-help" className="admin-hint admin-hint--tight">
                {seoTitleLength} characters — keep it descriptive and concise.{seoTitleLength > SEO_TITLE_IDEAL && ' Search results usually cut titles after about 60.'} Empty: the blog title is used.
              </p>
            </Field>

            <Field n={10} id="b-meta" label="Meta Description" optional error={errors.metaDescription}
              aside={<span className={`pf-counter${metaLength > META_DESCRIPTION_IDEAL ? ' bf-over' : ''}`}>{metaLength}/{META_DESCRIPTION_IDEAL}</span>}>
              <textarea id="b-meta" className="admin-input pf-textarea" value={metaDescription} maxLength={META_DESCRIPTION_MAX} rows={3}
                placeholder={excerpt || 'The summary search results show under the title'}
                aria-invalid={!!errors.metaDescription || undefined} onChange={(e) => setMetaDescription(e.target.value)} />
              <p className="admin-hint admin-hint--tight">About 150–160 characters works best. Empty: the excerpt is used.</p>
            </Field>

            <details className="bf-advanced" open={!!canonicalUrl || !!errors.canonicalUrl}>
              <summary>Advanced</summary>
              <Field n={11} id="b-canonical" label="Canonical URL" optional error={errors.canonicalUrl}>
                <input id="b-canonical" className="admin-input" value={canonicalUrl} maxLength={500} inputMode="url" spellCheck={false}
                  placeholder={`${SITE_URL}/blog/${slug || 'your-blog-slug'}`}
                  aria-invalid={!!errors.canonicalUrl || undefined} onChange={(e) => setCanonicalUrl(e.target.value)} />
                <p className="admin-hint admin-hint--tight">Only if this article was first published somewhere else: that address. Leave empty otherwise.</p>
              </Field>
            </details>

            <div className="pf-field">
              <span className="admin-label"><span className="bf-n">12.</span> Search Engine Indexing</span>
              <label className="bf-check">
                <input type="checkbox" checked={allowIndexing} onChange={(e) => setAllowIndexing(e.target.checked)} />
                <span>Allow search engines to index this blog</span>
              </label>
              {!allowIndexing && <p className="admin-hint admin-hint--tight">The post can still be opened from the blog page, but search engines are asked not to list it, and it is left out of the sitemap.</p>}
            </div>
          </Panel>
        </div>

        <div className="pf-side">
          <Panel title="Publishing">
            <span className="admin-label"><span className="bf-n">13.</span> Publishing Status <Req /></span>
            <div className="choice-stack bf-status" role="radiogroup" aria-label="Publishing status">
              <label className={`choice${status === 'draft' ? ' is-on' : ''}`}>
                <input type="radio" name="b-status" checked={status === 'draft'} onChange={() => setStatus('draft')} />
                <strong>{wasPublished ? 'Move to drafts' : 'Save as Draft'}</strong>
                <span>{wasPublished ? 'Takes it off the blog; you can publish it again later' : 'Only the admin panel can see it'}</span>
              </label>
              <label className={`choice${status === 'published' ? ' is-on' : ''}`}>
                <input type="radio" name="b-status" checked={status === 'published'} onChange={() => setStatus('published')} />
                <strong>{wasPublished ? 'Keep published' : 'Publish Now'}</strong>
                <span>{wasPublished ? 'Stays live on the blog' : 'Goes live on the blog as soon as you save'}</span>
              </label>
            </div>
            {editing && (
              <dl className="bf-facts">
                {blog.published_at && <><dt>First published</dt><dd>{blogDate(blog.published_at)}</dd></>}
                <dt>Last saved</dt>
                <dd>{blogDate(blog.updated_at)}{blog.updated_by && <span className="table__sub">by {editorName(blog.updated_by)}</span>}</dd>
              </dl>
            )}
            {wasPublished && (
              <a href={blogPath(blog.slug)} target="_blank" rel="noreferrer" className="admin-button admin-button--ghost bf-view">
                <ExternalLinkIcon size={16} /> View on the blog
              </a>
            )}
          </Panel>

          <Panel title="Search result preview">
            <div className="bf-serp" aria-label="How the post may look in search results">
              <span className="bf-serp__url">{SITE_HOST} › blog › {slug || 'your-blog-slug'}</span>
              <span className="bf-serp__title">{seoTitle.trim() || title.trim() || 'Your blog title'}</span>
              <span className="bf-serp__desc">{metaDescription.trim() || excerpt.trim() || 'Your short description shows here.'}</span>
            </div>
            {!allowIndexing && <p className="admin-hint admin-hint--tight">Indexing is off: search engines won't list this post.</p>}
          </Panel>
        </div>
      </fieldset>

      <ConfirmDialog
        open={leaveTo !== null}
        title="Discard your changes?"
        message={<p>{editing ? "Your changes to this post haven't" : "This post hasn't"} been saved. If you leave now, what you've written is lost.</p>}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => { if (leaveTo) navigate(leaveTo) }}
        onCancel={() => setLeaveTo(null)}
      />
      <Toast message={toast} kind="error" onDone={() => setToast(null)} />
    </form>
  )
}

const Req = () => <span className="bf-req" aria-hidden>*</span>

/** A numbered field with its label, an optional note beside the label, and its error under it. */
function Field({ n, id, label, required, optional, aside, error, children }: {
  n: number; id: string; label: string; required?: boolean; optional?: boolean; aside?: ReactNode; error?: string; children: ReactNode
}) {
  return (
    <div className="pf-field">
      <div className="pf-field__top">
        <label htmlFor={id} className="admin-label">
          <span className="bf-n">{n}.</span> {label} {required && <Req />}{optional && <span className="pf-optional">(optional)</span>}
        </label>
        {aside}
      </div>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="pf-error"><AlertIcon size={14} />{message}</p>
}

// The hidden file picker inside a drop area; picking the same file again still counts.
function ImageInput({ id, onFiles, invalid }: { id: string; onFiles: (files: FileList) => void; invalid?: boolean }) {
  return (
    <input id={id} type="file" accept={IMAGE_TYPES.join(',')} className="visually-hidden"
      aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }} />
  )
}
