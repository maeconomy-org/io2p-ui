/**
 * Copy text to the clipboard, returning whether it succeeded rather than throwing.
 *
 * `navigator.clipboard` is undefined on insecure origins (any plain-http deployment) and rejects
 * with NotAllowedError when the document lacks focus, so the async API alone is not enough to make
 * a copy button work. The hidden-textarea `execCommand` path is deprecated but still the only
 * fallback that covers both cases.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through: denied by focus/permission, but execCommand may still work.
    }
  }

  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  // Off-screen rather than `display: none` — execCommand ignores unrendered nodes.
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'

  document.body.appendChild(textarea)
  try {
    const selection = document.getSelection()
    const previous = selection?.rangeCount ? selection.getRangeAt(0) : null

    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')

    if (previous && selection) {
      selection.removeAllRanges()
      selection.addRange(previous)
    }
    return ok
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}
