import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Classes, not `vi.fn().mockImplementation(() => ({...}))` — an arrow function cannot be `new`'d,
// so that spelling threw "is not a constructor" the moment anything actually constructed one.
// floating-ui does, behind every Radix popover / dropdown / select.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
  root = null
  rootMargin = ''
  thresholds = []
}

global.ResizeObserver = NoopObserver as unknown as typeof ResizeObserver
global.IntersectionObserver =
  NoopObserver as unknown as typeof IntersectionObserver

// jsdom implements neither the Pointer Events API nor pointer capture, and Radix's dropdown, select
// and popover primitives all open on pointerdown. Without these a menu never opens, so a test fails
// on a missing menu item rather than on the behaviour it was written to check.
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = MouseEvent as unknown as typeof PointerEvent
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
