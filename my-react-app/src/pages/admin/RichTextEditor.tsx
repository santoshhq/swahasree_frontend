import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { uploadBlogImage } from '../../lib/adminApi'
import { hasContent, videoEmbedUrl } from '../../lib/blog'
import {
  AddColumnIcon, AddRowIcon, BoldIcon, BulletListIcon, ClearFormatIcon, CodeIcon, DeleteIcon, Heading2Icon, Heading3Icon,
  ImagePlusIcon, ItalicIcon, LinkIcon, NumberListIcon, ParagraphIcon, QuoteIcon, RedoIcon, RuleIcon, SpinnerIcon, StrikeIcon,
  TableIcon, UnderlineIcon, UndoIcon, UnlinkIcon, VideoIcon,
} from './AdminIcons'

// The blog's rich-text editor: a contentEditable box with a toolbar for paragraphs, headings, lists,
// links, pictures, tables and YouTube/Vimeo videos, plus an HTML view for anything else.
// Its output is plain HTML; the backend (services/blog_service.py) cleans it before it's saved, so
// whatever is pasted in, only the tags the storefront styles (.blog-prose in App.css) are kept.

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type Block = 'p' | 'h2' | 'h3' | 'blockquote'
type Popover = 'link' | 'image' | 'video' | null
type Marks = { bold: boolean; italic: boolean; underline: boolean; strikeThrough: boolean; insertUnorderedList: boolean; insertOrderedList: boolean }

const NO_MARKS: Marks = { bold: false, italic: false, underline: false, strikeThrough: false, insertUnorderedList: false, insertOrderedList: false }

/** A link as typed: "swahasree.com/shop" gets https://; /shop, #top, mailto: and tel: stay as they are. */
function normaliseLink(text: string): string {
  const link = text.trim()
  if (!link || /^(https?:|mailto:|tel:|\/|#)/i.test(link)) return link
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link)) return `mailto:${link}`
  return `https://${link}`
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function RichTextEditor({ id, labelledBy, initialValue, onChange, onError, invalid, describedBy }: {
  id: string
  labelledBy: string
  // Read once, when the editor opens; after that the editor holds the content and reports changes.
  initialValue: string
  onChange: (html: string) => void
  onError: (message: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  // Where the cursor was when a popover opened, so its insert lands there and not at the start.
  const savedRange = useRef<Range | null>(null)
  const [marks, setMarks] = useState<Marks>(NO_MARKS)
  const [block, setBlock] = useState<Block | null>(null)
  const [inTable, setInTable] = useState(false)
  const [popover, setPopover] = useState<Popover>(null)
  const [source, setSource] = useState<string | null>(null)
  const [uploading, setUploading] = useState(0)
  // A picture in the post that was clicked: its alt text can be changed, or it can be taken out.
  const pickedImage = useRef<HTMLImageElement | null>(null)
  const [picked, setPicked] = useState<{ src: string; alt: string } | null>(null)
  const [empty, setEmpty] = useState(!hasContent(initialValue))

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.innerHTML = initialValue || '<p><br></p>'
    lockEmbeds(el)
    // Enter starts a new <p>, not a <div>.
    document.execCommand('defaultParagraphSeparator', false, 'p')
    // The content is the editor's own from here on; initialValue is only the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The toolbar's pressed states follow the cursor.
  useEffect(() => {
    const update = () => {
      const el = editorRef.current
      const selection = document.getSelection()
      if (!el || !selection?.rangeCount || !el.contains(selection.anchorNode)) return
      setMarks({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      })
      const value = String(document.queryCommandValue('formatBlock')).toLowerCase().replace(/[<>]/g, '')
      setBlock((['p', 'h2', 'h3', 'blockquote'] as const).find((b) => b === value) ?? null)
      setInTable(!!closestInEditor(selection.anchorNode, 'td, th'))
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  const closestInEditor = (node: Node | null, selector: string): HTMLElement | null => {
    const el = node instanceof Element ? node : node?.parentElement
    const found = el?.closest<HTMLElement>(selector) ?? null
    return found && editorRef.current?.contains(found) ? found : null
  }

  const emit = () => {
    const el = editorRef.current
    if (!el) return
    const html = el.innerHTML
    setEmpty(!hasContent(html))
    onChange(html)
  }

  const saveSelection = () => {
    const selection = document.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange()
  }

  const restoreSelection = () => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const selection = document.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    if (savedRange.current) selection.addRange(savedRange.current)
    else {
      // Nothing remembered: add at the end.
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      selection.addRange(range)
    }
  }

  const run = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    emit()
  }

  const insertHtml = (html: string) => {
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    if (editorRef.current) lockEmbeds(editorRef.current)
    // The cursor is now after what was added, so a second picture still uploading goes after the first.
    savedRange.current = null
    saveSelection()
    emit()
  }

  const setBlockType = (b: Block) => run('formatBlock', `<${b}>`)

  const openPopover = (which: Exclude<Popover, null>) => {
    saveSelection()
    setPopover((p) => (p === which ? null : which))
  }

  const addLink = (href: string, newTab: boolean) => {
    const link = normaliseLink(href)
    if (!link) return
    restoreSelection()
    const selection = document.getSelection()
    const target = newTab ? ' target="_blank"' : ''
    if (!selection || selection.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${escapeHtml(link)}"${target}>${escapeHtml(href.trim())}</a>`)
    } else {
      document.execCommand('createLink', false, link)
      // createLink can't set the target; mark the links it just made.
      editorRef.current?.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
        if (a.getAttribute('href') === link) {
          if (newTab) a.setAttribute('target', '_blank')
          else a.removeAttribute('target')
        }
      })
    }
    savedRange.current = null
    setPopover(null)
    emit()
  }

  const uploadImages = async (files: File[], alt?: string) => {
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) {
        onError(`${file.name} isn't a JPEG, PNG or WebP image.`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        onError(`${file.name} is larger than 5 MB.`)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const { url } = await uploadBlogImage(file)
        // Without alt text given, the file name stands in ("mango-pickle-jar.jpg" → "mango pickle jar").
        const text = alt?.trim() || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
        insertHtml(`<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"><p><br></p>`)
      } catch (err) {
        onError((err as Error).message)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const addVideo = (link: string) => {
    const src = videoEmbedUrl(link)
    if (!src) {
      onError('Paste a YouTube or Vimeo link, e.g. https://www.youtube.com/watch?v=…')
      return
    }
    setPopover(null)
    insertHtml(`<div class="blog-embed"><iframe src="${src}" title="Video" allowfullscreen></iframe></div><p><br></p>`)
  }

  const addTable = () => {
    const cells = (tag: string) => `<tr>${`<${tag}><br></${tag}>`.repeat(3)}</tr>`
    saveSelection()
    insertHtml(`<table><thead>${cells('th')}</thead><tbody>${cells('td')}${cells('td')}</tbody></table><p><br></p>`)
  }

  // Table rows and columns are DOM changes, so they skip the browser's undo; they're small and easy to redo by hand.
  const tableCell = () => closestInEditor(document.getSelection()?.anchorNode ?? null, 'td, th')

  const addRow = () => {
    const row = tableCell()?.closest('tr')
    if (!row) return
    const copy = document.createElement('tr')
    for (let i = 0; i < row.children.length; i++) copy.appendChild(document.createElement('td')).innerHTML = '<br>'
    // A new row under the heading row goes into the body.
    if (row.parentElement?.tagName === 'THEAD') row.closest('table')?.querySelector('tbody')?.prepend(copy)
    else row.after(copy)
    emit()
  }

  const addColumn = () => {
    const cell = tableCell()
    const table = cell?.closest('table')
    if (!cell || !table) return
    const index = Array.from(cell.parentElement!.children).indexOf(cell)
    table.querySelectorAll('tr').forEach((tr) => {
      const added = document.createElement(tr.parentElement?.tagName === 'THEAD' ? 'th' : 'td')
      added.innerHTML = '<br>'
      tr.children[index]?.after(added)
    })
    emit()
  }

  const removeTable = () => {
    tableCell()?.closest('table')?.remove()
    setInTable(false)
    emit()
  }

  const toggleSource = () => {
    const el = editorRef.current
    if (!el) return
    if (source === null) {
      setPopover(null)
      setPicked(null)
      setSource(el.innerHTML)
    } else {
      el.innerHTML = source || '<p><br></p>'
      lockEmbeds(el)
      setSource(null)
      emit()
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    // A pasted screenshot is uploaded like a picked one, instead of being kept as a data: address
    // (which the backend would strip).
    e.preventDefault()
    saveSelection()
    void uploadImages(files)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    e.preventDefault()
    // Put the cursor where the picture was dropped.
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
    if (range) savedRange.current = range
    void uploadImages(files)
  }

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const image = e.target instanceof HTMLImageElement ? e.target : null
    pickedImage.current = image
    setPicked(image ? { src: image.src, alt: image.alt } : null)
  }

  const setPickedAlt = (alt: string) => {
    if (!pickedImage.current) return
    pickedImage.current.alt = alt
    setPicked((p) => (p ? { ...p, alt } : p))
    emit()
  }

  const removePicked = () => {
    pickedImage.current?.remove()
    pickedImage.current = null
    setPicked(null)
    emit()
  }

  const tool = (label: string, icon: ReactNode, action: () => void, pressed?: boolean, disabled?: boolean) => (
    <button type="button" className="rte-tool" aria-label={label} title={label} aria-pressed={pressed}
      disabled={disabled || source !== null}
      // mousedown, not click: a click would first move the focus (and the selection) out of the editor.
      onMouseDown={(e) => { e.preventDefault(); action() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action() } }}>
      {icon}
    </button>
  )

  return (
    <div className={`rte${invalid ? ' is-invalid' : ''}`}>
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting" aria-controls={id}>
        <div className="rte-group">
          {tool('Paragraph', <ParagraphIcon />, () => setBlockType('p'), block === 'p')}
          {tool('Heading 2', <Heading2Icon />, () => setBlockType('h2'), block === 'h2')}
          {tool('Heading 3', <Heading3Icon />, () => setBlockType('h3'), block === 'h3')}
          {tool('Quote', <QuoteIcon />, () => setBlockType('blockquote'), block === 'blockquote')}
        </div>
        <div className="rte-group">
          {tool('Bold', <BoldIcon />, () => run('bold'), marks.bold)}
          {tool('Italic', <ItalicIcon />, () => run('italic'), marks.italic)}
          {tool('Underline', <UnderlineIcon />, () => run('underline'), marks.underline)}
          {tool('Strikethrough', <StrikeIcon />, () => run('strikeThrough'), marks.strikeThrough)}
        </div>
        <div className="rte-group">
          {tool('Bulleted list', <BulletListIcon />, () => run('insertUnorderedList'), marks.insertUnorderedList)}
          {tool('Numbered list', <NumberListIcon />, () => run('insertOrderedList'), marks.insertOrderedList)}
        </div>
        <div className="rte-group">
          {tool('Add link', <LinkIcon />, () => openPopover('link'), popover === 'link')}
          {tool('Remove link', <UnlinkIcon />, () => run('unlink'))}
          {tool('Add picture', <ImagePlusIcon />, () => openPopover('image'), popover === 'image')}
          {tool('Add video', <VideoIcon />, () => openPopover('video'), popover === 'video')}
          {tool('Add table', <TableIcon />, addTable)}
          {tool('Add divider line', <RuleIcon />, () => run('insertHorizontalRule'))}
        </div>
        {inTable && (
          <div className="rte-group">
            {tool('Add row below', <AddRowIcon />, addRow)}
            {tool('Add column to the right', <AddColumnIcon />, addColumn)}
            {tool('Delete table', <DeleteIcon />, removeTable)}
          </div>
        )}
        <div className="rte-group">
          {tool('Clear formatting', <ClearFormatIcon />, () => run('removeFormat'))}
          {tool('Undo', <UndoIcon />, () => run('undo'))}
          {tool('Redo', <RedoIcon />, () => run('redo'))}
        </div>
        <div className="rte-group rte-group--end">
          <button type="button" className="rte-tool rte-tool--text" aria-pressed={source !== null} onClick={toggleSource}
            title={source === null ? 'Edit the HTML' : 'Back to the editor'}>
            <CodeIcon /> <span>{source === null ? 'HTML' : 'Editor'}</span>
          </button>
        </div>
        {uploading > 0 && <p className="rte-status" role="status"><SpinnerIcon size={14} className="admin-spin" /> Uploading picture…</p>}
      </div>

      {popover === 'link' && <LinkPopover onAdd={addLink} onClose={() => setPopover(null)} />}
      {popover === 'image' && <ImagePopover onAdd={(file, alt) => { setPopover(null); void uploadImages([file], alt) }} onClose={() => setPopover(null)} />}
      {popover === 'video' && <VideoPopover onAdd={addVideo} onClose={() => setPopover(null)} />}

      {picked && source === null && (
        <ImageBar key={picked.src} src={picked.src} alt={picked.alt} onAlt={setPickedAlt} onRemove={removePicked} onDone={() => setPicked(null)} />
      )}

      <div
        ref={editorRef}
        id={id}
        className={`rte-area blog-prose${empty ? ' is-empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        data-placeholder="Start writing your post…"
        hidden={source !== null}
        onInput={emit}
        onBlur={saveSelection}
        onPaste={onPaste}
        onDrop={onDrop}
        onClick={onClick}
      />
      {source !== null && (
        <textarea className="rte-source" value={source} onChange={(e) => { setSource(e.target.value); onChange(e.target.value) }}
          aria-label="Post content as HTML" spellCheck={false} />
      )}
    </div>
  )
}

// Embedded videos are one block each: the cursor goes around them, never inside the iframe's frame.
function lockEmbeds(el: HTMLElement) {
  el.querySelectorAll<HTMLElement>('.blog-embed').forEach((d) => { d.contentEditable = 'false' })
}

function PopoverForm({ title, onSubmit, onClose, children }: { title: string; onSubmit: () => void; onClose: () => void; children: ReactNode }) {
  // Not a <form>: it sits inside the post's form, and forms can't be nested.
  const submit = (e: KeyboardEvent) => {
    e.preventDefault()
    onSubmit()
  }
  return (
    <div className="rte-pop" role="group" aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose() }
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'file') submit(e)
      }}>
      {children}
    </div>
  )
}

function LinkPopover({ onAdd, onClose }: { onAdd: (href: string, newTab: boolean) => void; onClose: () => void }) {
  const [href, setHref] = useState('')
  const [newTab, setNewTab] = useState(false)
  return (
    <PopoverForm title="Add link" onSubmit={() => onAdd(href, newTab)} onClose={onClose}>
      <label className="admin-label" htmlFor="rte-link">Link address</label>
      <input id="rte-link" className="admin-input" value={href} autoFocus placeholder="https://swahasree.com/shop or /shop"
        onChange={(e) => setHref(e.target.value)} />
      <label className="rte-check"><input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} /> Open in a new tab</label>
      <div className="rte-pop__actions">
        <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="admin-button" disabled={!href.trim()} onClick={() => onAdd(href, newTab)}>Add link</button>
      </div>
      <p className="admin-hint admin-hint--tight">Select some text first to turn it into the link; otherwise the address itself is added.</p>
    </PopoverForm>
  )
}

function ImagePopover({ onAdd, onClose }: { onAdd: (file: File, alt: string) => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  return (
    <PopoverForm title="Add picture" onSubmit={() => file && onAdd(file, alt)} onClose={onClose}>
      <label className="admin-label" htmlFor="rte-image">Picture</label>
      <input id="rte-image" type="file" className="admin-input" accept={IMAGE_TYPES.join(',')} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <label className="admin-label" htmlFor="rte-alt">Alt text</label>
      <input id="rte-alt" className="admin-input" value={alt} maxLength={200} placeholder="What the picture shows, e.g. Brown rice in a glass jar"
        onChange={(e) => setAlt(e.target.value)} />
      <div className="rte-pop__actions">
        <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="admin-button" disabled={!file} onClick={() => file && onAdd(file, alt)}>Upload and add</button>
      </div>
      <p className="admin-hint admin-hint--tight">JPEG, PNG or WebP up to 5 MB. You can also paste or drop pictures straight into the post.</p>
    </PopoverForm>
  )
}

function VideoPopover({ onAdd, onClose }: { onAdd: (link: string) => void; onClose: () => void }) {
  const [link, setLink] = useState('')
  return (
    <PopoverForm title="Add video" onSubmit={() => onAdd(link)} onClose={onClose}>
      <label className="admin-label" htmlFor="rte-video">YouTube or Vimeo link</label>
      <input id="rte-video" className="admin-input" value={link} autoFocus placeholder="https://www.youtube.com/watch?v=…"
        onChange={(e) => setLink(e.target.value)} />
      <div className="rte-pop__actions">
        <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="admin-button" disabled={!link.trim()} onClick={() => onAdd(link)}>Add video</button>
      </div>
    </PopoverForm>
  )
}

/** Shown while a picture in the post is clicked: its alt text, or take it out. */
function ImageBar({ src, alt, onAlt, onRemove, onDone }: { src: string; alt: string; onAlt: (alt: string) => void; onRemove: () => void; onDone: () => void }) {
  return (
    <div className="rte-imagebar" role="group" aria-label="Selected picture">
      <img src={src} alt="" />
      <label className="admin-label" htmlFor="rte-image-alt">Alt text</label>
      <input id="rte-image-alt" className="admin-input" value={alt} maxLength={200} onChange={(e) => onAlt(e.target.value)} />
      <button type="button" className="admin-button admin-button--danger-ghost" onClick={onRemove}>Remove picture</button>
      <button type="button" className="admin-button admin-button--ghost" onClick={onDone}>Done</button>
    </div>
  )
}
