import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'

import { PreferenceSync } from '@/components/shell/preference-sync'
import {
  PREF_COOKIE_NAME,
  THEME_STORAGE_KEY,
  clearPreferenceMirrors,
} from '@/constants'
import { readCookie, writeCookie } from '@/lib/cookies'

let auth: {
  preferences?: Record<string, Record<string, unknown>>
  authLoading: boolean
  isAuthenticated: boolean
} = { preferences: {}, authLoading: false, isAuthenticated: true }
vi.mock('@/contexts', () => ({ useAuth: () => auth }))

const applyTheme = vi.fn()
let theme = 'light'
const storeTheme = vi.fn()
const storeLocale = vi.fn()
vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ theme, applyTheme }),
}))
vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: (key: string) => [
    undefined,
    key === 'theme' ? storeTheme : storeLocale,
    true,
  ],
}))

let locale = 'en'
vi.mock('next-intl', () => ({ useLocale: () => locale }))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

beforeEach(() => {
  vi.clearAllMocks()
  clearPreferenceMirrors()
  auth = { preferences: {}, authLoading: false, isAuthenticated: true }
  theme = 'light'
  locale = 'en'
})

afterEach(() => clearPreferenceMirrors())

describe('PreferenceSync — the cookie', () => {
  it('mirrors the account values', () => {
    auth.preferences = { ui: { objectsView: 'columns' } }
    render(<PreferenceSync />)
    expect(readCookie(PREF_COOKIE_NAME)).toBe('1.c....')
  })

  it('writes nothing while `/me` is still in flight', () => {
    auth = { preferences: undefined, authLoading: true, isAuthenticated: true }
    render(<PreferenceSync />)
    expect(readCookie(PREF_COOKIE_NAME)).toBeUndefined()
  })

  it('writes nothing when signed out', () => {
    auth = { preferences: {}, authLoading: false, isAuthenticated: false }
    render(<PreferenceSync />)
    expect(readCookie(PREF_COOKIE_NAME)).toBeUndefined()
  })

  // The effect must be idempotent — it is re-run on every `setQueryData`.
  it('does not rewrite an unchanged value', () => {
    auth.preferences = { ui: { objectsView: 'columns' } }
    const { rerender } = render(<PreferenceSync />)
    const setter = vi.spyOn(document, 'cookie', 'set')

    rerender(<PreferenceSync />)

    expect(setter).not.toHaveBeenCalled()
    setter.mockRestore()
  })

  // `/me` wins: the cookie is a projection of the bag, never merged with itself.
  it('overwrites a cookie that disagrees with the account', () => {
    writeCookie(PREF_COOKIE_NAME, '1.c.n.50.d.nl')
    auth.preferences = { ui: { objectsView: 'table' } }
    render(<PreferenceSync />)
    expect(readCookie(PREF_COOKIE_NAME)).toBe('1.t....')
  })
})

describe('PreferenceSync — theme', () => {
  it('applies the account theme over this browser', () => {
    auth.preferences = { ui: { theme: 'dark' } }
    render(<PreferenceSync />)
    expect(applyTheme).toHaveBeenCalledWith('dark')
  })

  // `applyTheme`, not the persisting setter — otherwise it PATCHes back what it
  // just read and the reconcile writes on every load.
  it('does not persist while reconciling', () => {
    auth.preferences = { ui: { theme: 'dark' } }
    render(<PreferenceSync />)
    expect(storeTheme).not.toHaveBeenCalled()
  })

  it('does nothing when they already agree', () => {
    theme = 'dark'
    auth.preferences = { ui: { theme: 'dark' } }
    render(<PreferenceSync />)
    expect(applyTheme).not.toHaveBeenCalled()
  })

  it('pushes this browser up once when the node has no theme', () => {
    theme = 'dark'
    render(<PreferenceSync />)
    expect(storeTheme).toHaveBeenCalledWith('dark')
  })

  it('pushes nothing up while `/me` is in flight', () => {
    auth = { preferences: undefined, authLoading: true, isAuthenticated: true }
    theme = 'dark'
    render(<PreferenceSync />)
    expect(storeTheme).not.toHaveBeenCalled()
  })
})

describe('PreferenceSync — locale', () => {
  it('corrects the cookie so the NEXT request renders the new language', () => {
    auth.preferences = { locale: { app: 'nl' } }
    render(<PreferenceSync />)
    expect(readCookie(PREF_COOKIE_NAME)).toBe('1.....nl')
  })

  /**
   * The regression this pins. `router.refresh()` invalidates the segment cache,
   * so React suspends onto `loading.tsx` — a whole-page skeleton. Firing it from
   * a PASSIVE reconcile put that skeleton on every load whose cookie had not
   * caught up yet. An explicit switch refreshes itself; see `useSetLocale`.
   */
  it('never refreshes on its own, whatever the account says', () => {
    auth.preferences = { locale: { app: 'nl' } }
    const { rerender } = render(<PreferenceSync />)

    rerender(<PreferenceSync />)

    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('clearPreferenceMirrors', () => {
  it('drops the theme and the views but KEEPS the language', () => {
    writeCookie(PREF_COOKIE_NAME, '1.c.n.50.d.nl')
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    clearPreferenceMirrors()
    clearPreferenceMirrors()

    // The login page is on THIS person's computer; sending them back to English
    // to sign in is worse than the leak it would prevent.
    expect(readCookie(PREF_COOKIE_NAME)).toBe('1.....nl')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('removes the cookie outright when there is no language to keep', () => {
    writeCookie(PREF_COOKIE_NAME, '1.c.n.50.d.')

    clearPreferenceMirrors()

    expect(readCookie(PREF_COOKIE_NAME)).toBeUndefined()
  })
})
