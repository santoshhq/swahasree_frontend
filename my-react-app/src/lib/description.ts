// Product descriptions are typed (or pasted) in the admin panel as plain text: paragraphs, a few
// headings ("Key Features"), "Label: value" lines and short points, one per line. This turns that
// text into blocks the product page can lay out, instead of one tall run of lines.

export type DescriptionBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string; label?: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'specs'; rows: { label: string; value: string }[]; header?: { label: string; value: string } }

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/** The first `limit` words, without a dangling comma or colon, and whether anything was cut. */
export function previewWords(text: string, limit: number): { text: string; cut: boolean } {
  const all = text.split(/\s+/).filter(Boolean)
  if (all.length <= limit) return { text: all.join(' '), cut: false }
  return { text: all.slice(0, limit).join(' ').replace(/[,;:–—-]+$/, ''), cut: true }
}

// "Origin: India" -> label and value. A label is a few words with no full stop in it.
function splitLabel(line: string): { label: string; value: string } | null {
  const m = line.match(/^([^:.]{1,60}):\s+(.+)$/)
  if (!m || countWords(m[1]) > 6) return null
  return { label: m[1].trim(), value: m[2].trim() }
}

// A short line with no sentence punctuation, like "Product Specifications" or "What is Glycemic Index ?".
const looksLikeHeading = (line: string) =>
  countWords(line) <= 6 && !/[.,;:!]$/.test(line) && !line.includes(':') && /^[A-Za-z]/.test(line)

// One cell of a table pasted as one cell per line: "Energy", "3,699 kJ / 884 kcal", "0 g".
const looksLikeCell = (line: string) => countWords(line) <= 5 && !/[.!?;:]$/.test(line) && !line.includes(': ')

const endsSentence = (line: string) => /[.!?]$/.test(line)

// Cells from `start` that pair up into a two-column table (at least two rows), or 0.
function tableRun(lines: string[], start: number): number {
  let end = start
  while (end < lines.length && looksLikeCell(lines[end]) && !splitLabel(lines[end])) {
    // A short line with a sentence after it is the next heading ("Key Features"), not a cell.
    if (lines[end + 1] && endsSentence(lines[end + 1]) && looksLikeHeading(lines[end])) break
    end++
  }
  const count = end - start
  return count >= 4 && count % 2 === 0 ? count : 0
}

// Short points under a heading become a list; longer ones stay paragraphs.
const MAX_POINT_WORDS = 20
// "Label: value" lines up to this long go in the spec table; a long "Note: ..." stays a paragraph.
const MAX_SPEC_WORDS = 25

export function parseDescription(text: string): DescriptionBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
  const blocks: DescriptionBlock[] = []
  let underHeading = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prev = lines[i - 1]
    const next = lines[i + 1]
    const last = blocks[blocks.length - 1]
    const pair = splitLabel(line)

    if (pair && countWords(line) <= MAX_SPEC_WORDS) {
      if (last?.kind === 'specs') last.rows.push(pair)
      else blocks.push({ kind: 'specs', rows: [pair] })
      continue
    }

    // A heading comes after a finished sentence (not in the middle of a pasted table) and before a
    // sentence, a spec line or a table, so stray table cells like "Not specified" stay text.
    const table = next ? tableRun(lines, i + 1) : 0
    const afterBreak = !prev || endsSentence(prev) || splitLabel(prev) !== null || countWords(prev) > 6 || last?.kind === 'specs'
    if (!pair && looksLikeHeading(line) && next && afterBreak && (endsSentence(next) || splitLabel(next) || table)) {
      blocks.push({ kind: 'heading', text: line })
      underHeading = true
      if (table) {
        const cells = lines.slice(i + 1, i + 1 + table)
        const rows: { label: string; value: string }[] = []
        for (let c = 0; c < cells.length; c += 2) rows.push({ label: cells[c], value: cells[c + 1] })
        // "Nutrient | Amount" above rows with numbers in them is the table's own header.
        const header = !/\d/.test(rows[0].label + rows[0].value) && /\d/.test(rows[1].value) ? rows.shift() : undefined
        blocks.push({ kind: 'specs', rows, header })
        i += table
      }
      continue
    }

    if (!pair && underHeading && countWords(line) <= MAX_POINT_WORDS) {
      if (last?.kind === 'list') last.items.push(line)
      else blocks.push({ kind: 'list', items: [line] })
      continue
    }
    underHeading = false
    blocks.push(pair ? { kind: 'paragraph', label: pair.label, text: pair.value } : { kind: 'paragraph', text: line })
  }

  // A "list" of one line is just a closing sentence.
  return blocks.map((b) => (b.kind === 'list' && b.items.length === 1 ? { kind: 'paragraph', text: b.items[0] } : b))
}
