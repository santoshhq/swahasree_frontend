// Presentation helpers: how names read on the page. They never change what is stored or sent.

const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'in', 'a', 'an', 'to', 'for', 'with'])

/** "HONEY" → "Honey", "DRY FRUITS AND NUTS" → "Dry Fruits and Nuts". Mixed-case names are left as typed. */
export function titleCase(name: string): string {
  const trimmed = name.trim()
  if (trimmed !== trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase()) return trimmed
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

/**
 * The name a card shows: the part before the first "|" (catalogue names carry a search-friendly
 * tail, such as "Avakaya | Andhra mango pickle". The full name stays in titles.
 */
export function shortName(name: string): string {
  const head = name.split('|')[0].trim()
  return head || name.trim()
}

