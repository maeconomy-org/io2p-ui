import type { Preferences } from 'io2p-client'

import { deleteCookie, readCookie, writeCookie } from '@/lib/cookies'

import { PREFERENCES, type PreferenceValues } from './preferences'

/**
 * The first-paint mirror of the node's preference bag.
 *
 * A preference lives on the node, so the server render cannot read it — which
 * is why `/objects` used to paint a skeleton until `/me` landed. This cookie
 * carries the handful of values that decide WHAT IS PAINTED, so the server can
 * render the right thing on the first byte.
 *
 * It is a HINT, never truth. `/me` always wins and rewrites it; treat it as
 * authoritative and it is localStorage with extra steps, which is the thing the
 * whole migration exists to escape.
 *
 * Only render-blocking values belong here. The cookie rides every request,
 * including assets — column visibility and recent searches are deliberately out.
 */

export const PREF_COOKIE_NAME = 'iom_prefs'

/** next-themes' storage key, pinned on the provider so we can clear it. */
export const THEME_STORAGE_KEY = 'theme'

/** Where the locale lived before it moved into the account. Read-only now. */
export const LEGACY_LOCALE_COOKIE = 'NEXT_LOCALE'

/** The keys this cookie mirrors, in wire order. */
const MIRRORED = [
  'objectsView',
  'processView',
  'pageSize',
  'theme',
  'locale',
] as const

export type MirroredKey = (typeof MIRRORED)[number]
export type PreferenceHints = Partial<Pick<PreferenceValues, MirroredKey>>

/**
 * Single-character codes, so the whole cookie is ~22 bytes rather than ~110 as
 * URI-encoded JSON. Every character used is a bare RFC 6265 `cookie-octet`, so
 * nothing needs escaping on the way in or out.
 */
const CODES: { [K in MirroredKey]?: Record<string, string> } = {
  objectsView: { table: 't', columns: 'c' },
  processView: { table: 't', sankey: 's', network: 'n' },
  theme: { light: 'l', dark: 'd', system: 'y' },
}

const VERSION = '1'

function encodeField(key: MirroredKey, value: unknown): string {
  if (value === undefined || value === null) return ''
  const table = CODES[key]
  if (!table) return String(value)
  return table[String(value)] ?? ''
}

function decodeField(key: MirroredKey, code: string): unknown {
  if (!code) return undefined
  const table = CODES[key]
  if (!table) return key === 'pageSize' ? Number(code) : code
  return Object.keys(table).find((name) => table[name] === code)
}

export function encodePreferenceCookie(hints: PreferenceHints): string {
  return [VERSION, ...MIRRORED.map((key) => encodeField(key, hints[key]))].join(
    '.'
  )
}

/**
 * Read every mirrored key through `PREFERENCES.validate` — the SAME validators
 * the client applies to the stored bag.
 *
 * That shared pass is what makes the server and the browser agree. A field that
 * fails it becomes absent, so a cookie written before a view type was retired
 * falls back to the default rather than selecting a view that renders nothing.
 *
 * The accumulator is loose and narrows once at the end: writing straight into
 * `PreferenceHints` needs a cast per key, because TypeScript cannot see that
 * `key` and `value` came from the same iteration.
 */
function collect(read: (key: MirroredKey) => unknown): PreferenceHints {
  const hints: Record<string, unknown> = {}
  for (const key of MIRRORED) {
    const value = read(key)
    if (PREFERENCES[key].validate(value)) hints[key] = value
  }
  return hints as PreferenceHints
}

export function decodePreferenceCookie(
  raw: string | undefined | null
): PreferenceHints {
  if (!raw) return {}
  const [version, ...segments] = raw.split('.')
  // An unknown version decodes to nothing, which is exactly "no cookie". Extra
  // trailing segments from a newer client are ignored rather than fatal.
  if (version !== VERSION) return {}
  return collect((key) =>
    decodeField(key, segments[MIRRORED.indexOf(key)] ?? '')
  )
}

/** Project the node's bag down to the mirrored subset. */
export function packHintsFromPreferences(
  preferences: Preferences | undefined
): PreferenceHints {
  return collect((key) => {
    const spec = PREFERENCES[key]
    return (preferences?.[spec.ns] as Record<string, unknown> | undefined)?.[
      spec.key ?? key
    ]
  })
}

/** Merge one field into the stored cookie, keeping the rest. */
export function patchPreferenceCookie(partial: PreferenceHints): void {
  const current = decodePreferenceCookie(readCookie(PREF_COOKIE_NAME))
  writeCookie(
    PREF_COOKIE_NAME,
    encodePreferenceCookie({ ...current, ...partial })
  )
}

/**
 * Everything the cookie keeps across a logout.
 *
 * LANGUAGE SURVIVES, on purpose. The mirror is not HttpOnly and outlives the
 * session, so the next person on a shared machine must not inherit the previous
 * one's theme or views — but the login page is on THIS person's computer, and
 * being thrown back into English to sign in is worse than the leak is bad. A
 * language is a property of the reader, not of the account they are about to
 * open.
 */
export function survivesLogout(hints: PreferenceHints): PreferenceHints {
  return hints.locale ? { locale: hints.locale } : {}
}

/**
 * Drop every LOCAL copy of the preferences except the ones a logout keeps.
 * Idempotent, so it is safe on every auth transition.
 */
export function clearPreferenceMirrors(): void {
  const kept = survivesLogout(
    decodePreferenceCookie(readCookie(PREF_COOKIE_NAME))
  )
  if (kept.locale) writeCookie(PREF_COOKIE_NAME, encodePreferenceCookie(kept))
  else deleteCookie(PREF_COOKIE_NAME)
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(THEME_STORAGE_KEY)
  }
}
