import { MAX_SEARCH_CHARS, MIN_SEARCH_CHARS } from '@/constants'

/**
 * The `q` to send for what the user typed: trimmed and capped, or `undefined` when it is too short.
 *
 * Counts code points, as the node does. The node also lower-cases first, which can only add code
 * points, so a value this passes the node passes too.
 */
export function searchText(raw: string | undefined): string | undefined {
  const text = raw?.trim() ?? ''
  const chars = [...text.normalize('NFC')]
  if (chars.length < MIN_SEARCH_CHARS) return undefined
  if (text.length <= MAX_SEARCH_CHARS) return text
  // Cut at a code point, so an emoji is never split in half.
  let capped = ''
  for (const char of chars) {
    if (capped.length + char.length > MAX_SEARCH_CHARS) break
    capped += char
  }
  return capped.trimEnd()
}
