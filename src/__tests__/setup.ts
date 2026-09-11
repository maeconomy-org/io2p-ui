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

// jsdom 29 no longer ships its own Web Storage — it defers to Node's, which stays undefined unless
// the process is started with `--localstorage-file`. So `localStorage` is absent under test even
// though `window` and `document` are real, and every suite touching it died in `beforeEach` on
// "Cannot read properties of undefined (reading 'clear')".
//
// A stub rather than the flag: Node's implementation persists to a FILE, so runs would leak state
// into each other and the order of tests would start to matter.
class MemoryStorage implements Storage {
  #items = new Map<string, string>()

  get length() {
    return this.#items.size
  }
  key(index: number) {
    return [...this.#items.keys()][index] ?? null
  }
  getItem(key: string) {
    return this.#items.get(key) ?? null
  }
  // The spec coerces both, and code under test passes numbers and objects freely.
  setItem(key: string, value: string) {
    this.#items.set(String(key), String(value))
  }
  removeItem(key: string) {
    this.#items.delete(String(key))
  }
  clear() {
    this.#items.clear()
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!window[name]) {
    Object.defineProperty(window, name, {
      configurable: true,
      writable: true,
      value: new MemoryStorage(),
    })
  }
}
