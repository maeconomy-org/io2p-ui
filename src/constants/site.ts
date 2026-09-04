/**
 * Site configuration and navigation
 */

import { TOUR_ANCHORS } from './tour-anchors'

/**
 * A name, not a component. Importing `lucide-react` here would put the React
 * runtime behind `@/constants`, which 51 modules import — Server Components
 * among them. `NAV_ICONS` in the navbar resolves the name.
 */
export type NavIcon =
  | 'objects'
  | 'processes'
  | 'shares'
  | 'library'
  | 'formulas'
  | 'constants'
  | 'rollupRules'
  | 'import'

export interface NavItem {
  readonly key: string
  readonly path: string
  readonly icon?: NavIcon
  readonly dataTour?: string
  readonly children?: readonly NavItem[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: 'objects',
    path: '/objects',
    icon: 'objects',
    dataTour: TOUR_ANCHORS.navObjects,
  },
  {
    key: 'processes',
    path: '/processes',
    icon: 'processes',
    dataTour: TOUR_ANCHORS.navProcesses,
  },
  {
    key: 'shares',
    path: '/shares',
    icon: 'shares',
    dataTour: TOUR_ANCHORS.navShares,
  },
  {
    key: 'library',
    path: '/templates',
    icon: 'library',
    dataTour: TOUR_ANCHORS.navLibrary,
    children: [
      { key: 'models', path: '/templates', icon: 'library' },
      { key: 'formulas', path: '/formulas', icon: 'formulas' },
      { key: 'constants', path: '/constants', icon: 'constants' },
      { key: 'rollupRules', path: '/rollup-rules', icon: 'rollupRules' },
    ],
  },
  {
    key: 'import',
    path: '/import',
    icon: 'import',
    dataTour: TOUR_ANCHORS.navImport,
  },
]

export const SECURITY_CONTACT_EMAIL = 'info@maeconomy.org'

export const FOOTER_LINKS = [
  { key: 'help', path: '/help' },
  { key: 'security', path: '/security' },
] as const

export const PROCESS_TYPES = [
  { value: 'processing', labelKey: 'processing' },
  { value: 'assembly', labelKey: 'assembly' },
  { value: 'recycling', labelKey: 'recycling' },
  { value: 'disposal', labelKey: 'disposal' },
] as const

// Unit categories for material selection
export const UNIT_CATEGORIES = {
  volume: { labelKey: 'volume', units: ['L', 'mL', 'm³', 'gal'] },
  weight: { labelKey: 'weight', units: ['kg', 'g', 't', 'lb'] },
  area: { labelKey: 'area', units: ['m²', 'cm²', 'ft²'] },
  length: { labelKey: 'length', units: ['m', 'mm', 'cm', 'ft', 'in'] },
  count: { labelKey: 'count', units: ['pcs', 'ea', 'units', 'items'] },
  energy: {
    labelKey: 'energy',
    units: ['kWh', 'kg CO2e', 'MJ', 'BTU'],
  },
} as const

export const DEFAULT_TABLE_PAGE_SIZE = 20
export const DEFAULT_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/**
 * The largest `size` the node accepts on a list. Asking for more is a 400, not a clamp.
 *
 * Named because the raw number has now been got wrong twice: `/v1/users` once asked for 200 and
 * 400'd on every render, and the Owner column showed uuids as if the API had no names. A caller
 * that wants "all of them" wants THIS, and a caller that needs more than this needs to paginate.
 */
export const MAX_LIST_PAGE_SIZE = 100

/**
 * How many rows a type-to-search picker fetches per keystroke.
 *
 * Small on purpose: the picker reaches the rest through `q` at the node, so a bigger page only
 * costs a longer list to scroll before the user types. A picker WITHOUT `q` must not use this —
 * it would silently cap what is reachable at all.
 */
export const SEARCH_SIZE = 20

/**
 * The theme values that may be STORED, which is a superset of the two the
 * toggle offers — next-themes writes `system` whenever the user has never
 * chosen, and that value has to survive a round trip through the node.
 */
export const THEME_VALUES = ['light', 'dark', 'system'] as const
export type ThemePreference = (typeof THEME_VALUES)[number]
