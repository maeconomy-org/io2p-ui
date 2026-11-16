import { MIN_SEARCH_CHARS } from '@/constants'

import { foldText, searchWords } from './search-text'

/** A part of a name to mark: UTF-16 offsets, end exclusive. */
export type MarkRange = readonly [start: number, end: number]

/**
 * Where each word of `q` appears in `text`, folded the way the node folds, so `ideeen` marks
 * `Ideeën`. Each grapheme is folded on its own and a mark always covers whole graphemes, so it
 * never cuts an emoji or splits a letter from its accent. Words under `MIN_SEARCH_CHARS` are not
 * marked: one letter would mark half the name. Ranges that overlap or touch are merged.
 */
export function searchMarks(text: string, q: string | undefined): MarkRange[] {
  if (!q) return []
  const words = searchWords(q).filter(
    (word) => [...word].length >= MIN_SEARCH_CHARS
  )
  if (words.length === 0) return []

  let folded = ''
  // For each folded UTF-16 unit, the grapheme it came from.
  const owner: number[] = []
  const graphemes: MarkRange[] = []
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  for (const { segment, index } of segmenter.segment(text)) {
    const part = foldText(segment)
    for (let i = 0; i < part.length; i++) owner.push(graphemes.length)
    graphemes.push([index, index + segment.length])
    folded += part
  }

  const found: [number, number][] = []
  for (const word of words) {
    for (
      let at = folded.indexOf(word);
      at !== -1;
      at = folded.indexOf(word, at + 1)
    ) {
      found.push([owner[at]!, owner[at + word.length - 1]! + 1])
    }
  }
  found.sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const [start, end] of found) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged.map(([first, after]) => [
    graphemes[first]![0],
    graphemes[after - 1]![1],
  ])
}
