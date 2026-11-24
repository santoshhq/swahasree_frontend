import { useId, useRef, useState } from 'react'
import { parseDescription, previewWords, type DescriptionBlock } from '../lib/description'
import { ChevronIcon } from './Icons'

// How much of the description shows before "Read more".
const PREVIEW_WORDS = 20

/** The product's description: the first 20 words, then the whole text laid out on "Read more". */
export function ProductDescription({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const preview = previewWords(text, PREVIEW_WORDS)

  const toggle = () => {
    setOpen(!open)
    // Closing a long description could leave the reader far below it: bring its top back into view.
    if (open) {
      requestAnimationFrame(() => {
        const top = box.current?.getBoundingClientRect().top ?? 0
        if (top < 0) box.current?.scrollIntoView({ block: 'start' })
      })
    }
  }

  return (
    <div className="description" ref={box}>
      {!preview.cut || open ? (
        <div id={id} className="description__full">
          {parseDescription(text).map((block, i) => <Block key={i} block={block} />)}
        </div>
      ) : (
        <p id={id} className="description__preview">{preview.text}…</p>
      )}
      {preview.cut && (
        <button type="button" className={`description__toggle${open ? ' is-open' : ''}`} aria-expanded={open} aria-controls={id} onClick={toggle}>
          {open ? 'Read less' : 'Read more'} <ChevronIcon size={16} />
        </button>
      )}
    </div>
  )
}

function Block({ block }: { block: DescriptionBlock }) {
  switch (block.kind) {
    case 'heading':
      return <h3 className="description__heading">{block.text}</h3>
    case 'list':
      return <ul className="description__list">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    case 'specs':
      return (
        <dl className="description__specs">
          {block.header && (
            <div className="description__specs-head" aria-hidden><span>{block.header.label}</span><span>{block.header.value}</span></div>
          )}
          {block.rows.map((row, i) => (
            <div key={i}><dt>{row.label}</dt><dd>{row.value}</dd></div>
          ))}
        </dl>
      )
    default:
      return <p>{block.label && <strong>{block.label}: </strong>}{block.text}</p>
  }
}
