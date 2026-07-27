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

/** Properties tab list/grid toggle — not part of the view-types config. */
export type PropertiesViewType = 'detailed' | 'grid'

/** Files tab rows/thumbnails toggle. */
export type FilesViewType = 'list' | 'grid'

/** The value type stored under each preference key. */
export interface ViewPreferenceValues {
  objectsView: ObjectViewType
  processView: ProcessViewType
  propertiesView: PropertiesViewType
  filesView: FilesViewType
}

export type ViewPreferenceKey = keyof ViewPreferenceValues

/**
 * Runtime schema: the hardcoded default and the allowed set for each key. A
 * stored value not in `allowed` (e.g. a view removed in a later release) is
 * ignored on read and falls back to `default`. `allowed` is derived from the
 * enabled view-type lists so the two can't drift.
 */
export const VIEW_PREFERENCES: {
  [K in ViewPreferenceKey]: {
    default: ViewPreferenceValues[K]
    allowed: readonly ViewPreferenceValues[K][]
  }
} = {
  objectsView: {
    default: 'table',
    allowed: ENABLED_OBJECT_VIEW_TYPES.map((t) => t.value),
  },
  processView: {
    default: 'dashboard',
    allowed: ENABLED_PROCESS_VIEW_TYPES.map((t) => t.value),
  },
  propertiesView: {
    default: 'detailed',
    allowed: ['detailed', 'grid'],
  },
  filesView: {
    default: 'list',
    allowed: ['list', 'grid'],
  },
}
