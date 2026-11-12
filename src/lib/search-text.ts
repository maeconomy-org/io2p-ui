import {
  MAX_SEARCH_CHARS,
  MAX_SEARCH_WORDS,
  MIN_SEARCH_CHARS,
} from '@/constants'

/**
 * How a list matches `q`. `words`: the list index (objects, processes, templates, formulas,
 * constants), where each folded word must match somewhere. `substring`: one case-insensitive
 * match of the whole text (shares, users), with no fold and no word limit.
 */
export type SearchKind = 'words' | 'substring'

export type SearchProblem = 'too-short' | 'too-many-words'

export type SearchInput =
  | { status: 'empty' }
  | { status: 'ok'; q: string }
  | { status: 'refused'; problem: SearchProblem }

/**
 * The node's `textFold` (io2p-core `lib/engine/index-writer.ts`), step for step, so the UI refuses
 * exactly the searches the node refuses. Plain `toLowerCase`, never a locale or full case fold:
 * the node keeps `ß`, so "strasse" must not count as "Straße" here either.
 */
export function foldSearch(text: string): string {
  return text
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replaceAll('ς', 'σ')
    .normalize('NFC')
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .normalize('NFC')
}

/** The different folded words of `text`, split on white space as the node splits them. */
export function searchWords(text: string): string[] {
  return [...new Set(foldSearch(text).split(/\s+/u).filter(Boolean))]
}

/** `text` cut to the node limit at a code point, so an emoji is never split in half. */
function capSearch(text: string): string {
  if (text.length <= MAX_SEARCH_CHARS) return text
  let capped = ''
  for (const char of text) {
    if (capped.length + char.length > MAX_SEARCH_CHARS) break
    capped += char
  }
  return capped.trimEnd()
}

/**
 * What the user typed, as the `q` to send or the reason the node would refuse it. Both checks run
 * on the capped text, which is the text that is sent.
 */
export function searchInput(
  raw: string | undefined,
  kind: SearchKind
): SearchInput {
  // The node answers 422 for U+0000 in `q`; it can only come from a paste.
  const text = capSearch((raw ?? '').replaceAll('\u0000', '').trim())
  if (text === '') return { status: 'empty' }

  if (kind === 'substring') {
    return [...text.normalize('NFC')].length < MIN_SEARCH_CHARS
      ? { status: 'refused', problem: 'too-short' }
      : { status: 'ok', q: text }
  }

  const words = searchWords(text)
  if (!words.some((word) => [...word].length >= MIN_SEARCH_CHARS)) {
    return { status: 'refused', problem: 'too-short' }
  }
  if (words.length > MAX_SEARCH_WORDS) {
    return { status: 'refused', problem: 'too-many-words' }
  }
  return { status: 'ok', q: text }
}

/**
 * The `q` to send after `input`. Too short sends no `q`, so one typed letter shows the whole list
 * (the hint says why). Too many words keeps `previous`: dropping the words would widen the list to
 * rows that look like matches.
 */
export function nextSearch(
  input: SearchInput,
  previous: string | undefined
): string | undefined {
  switch (input.status) {
    case 'empty':
      return undefined
    case 'ok':
      return input.q
    case 'refused':
      return input.problem === 'too-many-words' ? previous : undefined
  }
}
