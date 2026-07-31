import {
  ENABLED_OBJECT_VIEW_TYPES,
  ENABLED_PROCESS_VIEW_TYPES,
  type ObjectViewType,
  type ProcessViewType,
} from './view-types'

/**
 * Client-side user-preference storage (no backend API yet).
 *
 * All preferences live in a single per-account blob at
 * `${PREFERENCES_ROOT}:${PREFERENCES_VERSION}:${userUUID}`. Bump the version to
 * invalidate every account's blob at once (mirrors `CONFIG_CACHE_VERSION` in
 * `client.ts`). Keying by `userUUID` isolates accounts on a shared machine.
 */
export const PREFERENCES_ROOT = 'iom:prefs'
export const PREFERENCES_VERSION = 'v1'

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
  /** Hint ids the user has dismissed. */
  hintsDismissed: string[]
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
    default: PreferenceValues[K]
    validate: (value: unknown) => value is PreferenceValues[K]
  }
} = {
  objectsView: {
    default: 'table',
    validate: oneOf(ENABLED_OBJECT_VIEW_TYPES.map((t) => t.value)),
  },
  processView: {
    default: 'table',
    validate: oneOf(ENABLED_PROCESS_VIEW_TYPES.map((t) => t.value)),
  },
  propertiesView: {
    default: 'detailed',
    validate: oneOf(['detailed', 'grid'] as const),
  },
  filesView: {
    default: 'list',
    validate: oneOf(['list', 'grid'] as const),
  },
  toursSeen: {
    default: NO_STRINGS,
    validate: isStringArray,
  },
  hintsDismissed: {
    default: NO_STRINGS,
    validate: isStringArray,
  },
  onboardingEpoch: {
    default: 0,
    validate: isFiniteNumber,
  },
}
