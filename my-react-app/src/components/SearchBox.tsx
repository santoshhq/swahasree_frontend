import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { getSearchSuggestions, isShownInStore } from '../lib/api'
import { money } from '../lib/format'
import type { SearchSuggestion } from '../lib/types'
import { SearchIcon } from './Icons'
import { ProductImage } from './ui'

// Suggestions start at the second letter, after a short pause in typing.
const MIN_LETTERS = 2
const DELAY_MS = 180

type Results = { query: string; suggestions: SearchSuggestion[] }

/**
 * The header search with a type-ahead list (the ARIA combobox pattern): focus stays in the input,
 * the arrow keys move through the list, Enter opens the highlighted product or searches the shop,
 * Escape closes the list. The last row always searches every product for the typed text.
 */
export function SearchBox() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [text, setText] = useState(params.get('search') ?? '')
  const [results, setResults] = useState<Results | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const term = text.trim().replace(/\s+/g, ' ')
  const ready = term.length >= MIN_LETTERS

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      getSearchSuggestions(term, controller.signal)
        .then((r) => {
          setResults(r)
          setActive(-1)
        })
        // No suggestions is fine: pressing Enter still searches the shop.
        .catch(() => {})
    }, DELAY_MS)
    // Typing on cancels the wait and any request still in flight, so an old answer never wins.
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [term, ready])

  // The last answer still fits while the shopper adds letters to the same text ("ri" -> "ric"),
  // so it stays up instead of flickering; for different text, wait for the new answer.
  const current = ready && results !== null && term.toLowerCase().startsWith(results.query.toLowerCase())
  // A product the admin hid from the store is never suggested, even if the API sent it.
  const suggestions = current ? results.suggestions.filter(isShownInStore) : []
  const showList = open && current
  // The suggestions, then the "See all results" row.
  const rows = suggestions.length + 1

  const close = () => {
    setOpen(false)
    setActive(-1)
  }

  const searchAll = () => {
    close()
    inputRef.current?.blur()
    navigate(term ? `/shop?search=${encodeURIComponent(term)}` : '/shop')
  }

  const choose = (suggestion: SearchSuggestion) => {
    close()
    inputRef.current?.blur()
    navigate(`/product/${suggestion.product_id}`)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (showList && active >= 0 && active < suggestions.length) choose(suggestions[active])
    else searchAll()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && showList) {
      event.preventDefault()
      close()
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && ready) {
      event.preventDefault()
      if (!showList) {
        setOpen(true)
        return
      }
      // Positions run from -1 (back in the input) to the last row, and wrap around.
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => ((i + 1 + step + rows + 1) % (rows + 1)) - 1)
    }
  }

  const rowId = (i: number) => `${listId}-row-${i}`

  return (
    <form className="search" role="search" onSubmit={submit}>
      <label htmlFor="site-search" className="visually-hidden">Search products</label>
      <input
        ref={inputRef}
        id="site-search"
        type="search"
        placeholder="Search the pantry…"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? rowId(active) : undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      <button type="submit" aria-label="Search"><SearchIcon /></button>

      {showList && (
        // preventDefault on mousedown keeps focus in the input, so a click on a row isn't lost to the input's blur.
        <ul id={listId} role="listbox" aria-label="Suggestions" className="search-suggest" onMouseDown={(e) => e.preventDefault()}>
          {suggestions.map((s, i) => (
            <li
              key={s.product_id}
              id={rowId(i)}
              role="option"
              aria-selected={i === active}
              className="search-suggest__item"
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
            >
              <ProductImage src={s.image} alt="" className="search-suggest__thumb" />
              <span className="search-suggest__text">
                <span className="search-suggest__name"><Highlight text={s.product_name} term={term} /></span>
                <span className="search-suggest__meta">{s.sub_category ? `${s.category_name} / ${s.sub_category}` : s.category_name}</span>
              </span>
              {s.in_stock ? (
                <span className="search-suggest__price price">
                  {s.sizes > 1 && <span className="price__from">from </span>}
                  {money(s.min_price)}
                </span>
              ) : (
                <span className="tag tag--muted">Out of stock</span>
              )}
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="search-suggest__empty" role="presentation">No suggestions for “{term}”.</li>
          )}
          <li
            id={rowId(suggestions.length)}
            role="option"
            aria-selected={active === suggestions.length}
            className="search-suggest__all"
            onClick={searchAll}
            onMouseEnter={() => setActive(suggestions.length)}
          >
            <SearchIcon size={16} />
            <span>See all results for “{term}”</span>
          </li>
        </ul>
      )}
    </form>
  )
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Bolds the typed letters where they start a word of the name, the same rule the server matches on.
// A product suggested through its category has nothing bolded.
function Highlight({ text, term }: { text: string; term: string }) {
  const match = new RegExp(`(^|[^a-z0-9])(${escapeRegExp(term)})`, 'i').exec(text)
  if (!match) return <>{text}</>
  const start = match.index + match[1].length
  const end = start + match[2].length
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}
