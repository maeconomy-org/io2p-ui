import { useEffect, useState } from 'react'

/** The time a picker waits after the last key press, the same as the columns view. */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * `value`, updated only once it has stopped changing for `delayMs`. A picker sends its search from
 * this, so typing a word is one request rather than one per key.
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs = SEARCH_DEBOUNCE_MS
): T {
  const [debounced, setDebounced] = useState(value)

  // The setState runs in a timer callback, not in the effect body.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
