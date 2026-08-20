import { routing } from '@/i18n/routing'

import {
  DEFAULT_TABLE_PAGE_SIZE,
  DEFAULT_TABLE_PAGE_SIZE_OPTIONS,
  THEME_VALUES,
  type ThemePreference,
} from './site'
import {
  ENABLED_OBJECT_VIEW_TYPES,
  ENABLED_PROCESS_VIEW_TYPES,
  type ObjectViewType,
  type ProcessViewType,
} from './view-types'

type Locale = (typeof routing.locales)[number]

/**
 * User preferences, stored on the node.
 *
 * They used to live in `localStorage`, which meant a view you set on your laptop
 * was not the view you got on your phone, and a shared machine leaked one
 * person's settings to the next. The node exposes a purpose-built
 * `namespace -> key -> value` bag for exactly this; `users.me()` already returns
 * it on every load, so reading costs no extra request.
 *
 * The node writes keys INDIVIDUALLY, so two devices changing two different
 * preferences at the same time do not overwrite each other.
 */

/** Namespaces, matching the shape the node's own API documents. */
export const PREF_NS = {
  ui: 'ui',
  onboarding: 'onboarding',
  locale: 'locale',
  defaults: 'defaults',
} as const

/**
 * Bump to re-run onboarding for everyone — after a refactor that moves the nav
 * around, say.
 *
 * Deliberately NOT `PREFERENCES_VERSION`. That version keys the whole blob, so
 * bumping it to re-onboard would also discard every user's saved objects,
 * process, properties and files view. An epoch stored inside the blob buys the
 * same "show it again to everybody" lever at the cost of one integer, and
 * leaves unrelated preferences alone.
 */
export const ONBOARDING_EPOCH = 1

/**
 * Families of open keys inside a namespace: `hint-object`, `hint-process`, …
 *
 * A prefix per family rather than one array per family, because the node merges
 * PER KEY. Seven concept hints have seven independent writers, and an array
 * would let two tabs racing on two different hints lose one of the writes.
 */
export const PREF_FLAG = { hint: 'hint' } as const
export type PrefFlagFamily = (typeof PREF_FLAG)[keyof typeof PREF_FLAG]

/** Must stay inside the node's key rule, `^[a-zA-Z][\w-]{0,63}$`. */
export const flagKey = (family: PrefFlagFamily, id: string) => `${family}-${id}`

export const PREF_KEY_RE = /^[a-zA-Z][\w-]{0,63}$/
export const PREF_MAX_KEYS_PER_NS = 100

/** Properties tab list/grid toggle — not part of the view-types config. */
export type PropertiesViewType = 'detailed' | 'grid'

/** Files tab rows/thumbnails toggle. */
export type FilesViewType = 'list' | 'grid'

/**
 * Which access slice a list opens on.
 *
 * Defaults to `all` on purpose: a user who has not found the filter yet should see everything they
 * can, not silently miss shared work and wonder where it went. Narrowing is a choice they make once
 * they know what they want.
 */
export type EntityScopePreference = (typeof ENTITY_SCOPES)[number]

export const ENTITY_SCOPES = ['mine', 'shared', 'public', 'all'] as const

/** The value type stored under each preference key. */
export interface PreferenceValues {
  objectsView: ObjectViewType
  processView: ProcessViewType
  propertiesView: PropertiesViewType
  filesView: FilesViewType
  /** Opening access slice, per list. Objects and processes only — see the library note below. */
  objectsScope: EntityScopePreference
  processScope: EntityScopePreference
  formulaScope: EntityScopePreference
  constantScope: EntityScopePreference
  templateScope: EntityScopePreference
  /**
   * Column ids HIDDEN on each list. Hidden rather than visible, so a column
   * added in a later release shows up by default instead of depending on how a
   * saved blob that predates it is read.
   */
  objectColumnsHidden: string[]
  processColumnsHidden: string[]
  /** Tour ids the user has completed or dismissed. */
  toursSeen: string[]
  /** The `ONBOARDING_EPOCH` the stored onboarding state was written under. */
  onboardingEpoch: number
  theme: ThemePreference
  locale: Locale
  /** Rows per page, for every server-paginated table. */
  pageSize: number
}

export type PreferenceKey = keyof PreferenceValues

/**
 * Shared frozen defaults for the collection keys.
 *
 * One frozen instance rather than a fresh `[]` per read: `usePreference` hands
 * the default straight back when nothing is stored, so a stable identity keeps
 * `useMemo`/`useEffect` consumers from re-running every render, and freezing
 * makes the "never mutate a default" rule enforced rather than documented.
 */
const NO_STRINGS = Object.freeze([]) as unknown as string[]

/** Validator for a key whose value is one of a fixed set. */
const oneOf =
  <T>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    (allowed as readonly unknown[]).includes(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Runtime schema: the hardcoded default and a validator for each key. A stored
 * value that fails `validate` (e.g. a view removed in a later release, or a
 * hand-edited blob) is ignored on read and falls back to `default`.
 *
 * `validate` is a predicate rather than the allow-list this used to carry,
 * because not every preference is a scalar drawn from a fixed set — `toursSeen`
 * is an open-ended array of ids, and `allowed.includes(value)` can never be
 * true for it. `oneOf` keeps the old ergonomics for the keys that are scalars.
 */
export const PREFERENCES: {
  [K in PreferenceKey]: {
    /** Which namespace this key lives under in the node's preference bag. */
    ns: string
    /** Storage key inside `ns`, when it differs from the registry key. */
    key?: string
    default: PreferenceValues[K]
    validate: (value: unknown) => value is PreferenceValues[K]
  }
} = {
  objectsView: {
    ns: PREF_NS.ui,
    default: 'table',
    validate: oneOf(ENABLED_OBJECT_VIEW_TYPES.map((t) => t.value)),
  },
  processView: {
    ns: PREF_NS.ui,
    default: 'table',
    validate: oneOf(ENABLED_PROCESS_VIEW_TYPES.map((t) => t.value)),
  },
  propertiesView: {
    ns: PREF_NS.ui,
    default: 'detailed',
    validate: oneOf(['detailed', 'grid'] as const),
  },
  filesView: {
    ns: PREF_NS.ui,
    default: 'list',
    validate: oneOf(['list', 'grid'] as const),
  },
  objectsScope: {
    ns: PREF_NS.defaults,
    default: 'all',
    validate: oneOf(ENTITY_SCOPES),
  },
  processScope: {
    ns: PREF_NS.defaults,
    default: 'all',
    validate: oneOf(ENTITY_SCOPES),
  },
  formulaScope: {
    ns: PREF_NS.defaults,
    default: 'all',
    validate: oneOf(ENTITY_SCOPES),
  },
  constantScope: {
    ns: PREF_NS.defaults,
    default: 'all',
    validate: oneOf(ENTITY_SCOPES),
  },
  templateScope: {
    ns: PREF_NS.defaults,
    default: 'all',
    validate: oneOf(ENTITY_SCOPES),
  },
  objectColumnsHidden: {
    ns: PREF_NS.ui,
    default: NO_STRINGS,
    validate: isStringArray,
  },
  processColumnsHidden: {
    ns: PREF_NS.ui,
    default: NO_STRINGS,
    validate: isStringArray,
  },
  toursSeen: {
    ns: PREF_NS.onboarding,
    default: NO_STRINGS,
    validate: isStringArray,
  },
  onboardingEpoch: {
    ns: PREF_NS.onboarding,
    default: 0,
    validate: isFiniteNumber,
  },
  theme: {
    ns: PREF_NS.ui,
    // `light`, not `system`. The toggle only offers light and dark, so `system`
    // is a third state nothing in the UI can show as selected — and it makes the
    // first paint depend on the OS rather than on a value we chose.
    default: 'light',
    validate: oneOf(THEME_VALUES),
  },
  locale: {
    ns: PREF_NS.locale,
    key: 'app',
    default: routing.defaultLocale,
    validate: oneOf(routing.locales),
  },
  pageSize: {
    ns: PREF_NS.defaults,
    // Restricted to the OFFERED sizes, not just any finite number: the value
    // becomes a real `?size=` the node has to serve, so a hand-edited 10000
    // would be a request rather than a rendering glitch.
    default: DEFAULT_TABLE_PAGE_SIZE,
    validate: (value): value is number =>
      isFiniteNumber(value) && DEFAULT_TABLE_PAGE_SIZE_OPTIONS.includes(value),
  },
}
