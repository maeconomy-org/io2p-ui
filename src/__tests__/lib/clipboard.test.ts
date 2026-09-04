import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { copyText } from '@/lib/clipboard'

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  })
}

describe('copyText', () => {
  beforeEach(() => {
    // jsdom implements neither the async clipboard nor execCommand.
    document.execCommand = vi.fn(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setClipboard(undefined)
  })

  it('returns false for empty text without touching the clipboard', async () => {
    const writeText = vi.fn()
    setClipboard({ writeText })

    expect(await copyText('')).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('uses the async clipboard when it resolves', async () => {
    const writeText = vi.fn(async () => undefined)
    setClipboard({ writeText })

    expect(await copyText('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(document.execCommand).not.toHaveBeenCalled()
  })

  it('falls back to execCommand when writeText is denied', async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })
    setClipboard({ writeText })

    expect(await copyText('hello')).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('falls back when the clipboard API is absent (insecure origin)', async () => {
    setClipboard(undefined)

    expect(await copyText('hello')).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns false when both paths fail', async () => {
    setClipboard(undefined)
    document.execCommand = vi.fn(() => false)

    expect(await copyText('hello')).toBe(false)
  })

  it('removes the temporary textarea even when execCommand throws', async () => {
    setClipboard(undefined)
    document.execCommand = vi.fn(() => {
      throw new Error('boom')
    })

    expect(await copyText('hello')).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })
})
