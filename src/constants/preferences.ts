import {
  ENABLED_OBJECT_VIEW_TYPES,
  ENABLED_PROCESS_VIEW_TYPES,
  type ObjectViewType,
  type ProcessViewType,
} from './view-types'

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

/** Properties tab list/grid toggle — not part of the view-types config. */
export type PropertiesViewType = 'detailed' | 'grid'

/** Files tab rows/thumbnails toggle. */
export type FilesViewType = 'list' | 'grid'

/** The value type stored under each preference key. */
export interface PreferenceValues {
  objectsView: ObjectViewType
  processView: ProcessViewType
  propertiesView: PropertiesViewType
  filesView: FilesViewType
  /** Tour ids the user has completed or dismissed. */
  toursSeen: string[]
  /** The `ONBOARDING_EPOCH` the stored onboarding state was written under. */
  onboardingEpoch: number
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
}
