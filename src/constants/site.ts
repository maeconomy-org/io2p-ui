/**
 * Site configuration and navigation
 */

import { TOUR_ANCHORS } from './tour-anchors'

export interface NavItem {
  readonly key: string
  readonly path: string
  readonly dataTour?: string
  /** A grouped entry: the parent is a menu, not a destination. */
  readonly children?: readonly NavItem[]
}

/**
 * Top-level navigation.
 *
 * "Library" groups the reusable definitions — templates, formulas, constants — as against the data
 * itself. They belong together, and flattening them would put Constants at the same weight as
 * Objects in a bar that is already five items wide.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'objects', path: '/objects', dataTour: TOUR_ANCHORS.navObjects },
  { key: 'processes', path: '/processes', dataTour: TOUR_ANCHORS.navProcesses },
  // Shares takes the slot `/groups` held. It is the successor concept, not a rename: a group
  // bundled people AND resources under one word, a Share bundles only resources and lists its
  // members inline.
  { key: 'shares', path: '/shares', dataTour: TOUR_ANCHORS.navShares },
  {
    key: 'library',
    path: '/templates',
    dataTour: TOUR_ANCHORS.navLibrary,
    children: [
      { key: 'models', path: '/templates' },
      { key: 'formulas', path: '/formulas' },
      { key: 'constants', path: '/constants' },
    ],
  },
  { key: 'import', path: '/import', dataTour: TOUR_ANCHORS.navImport },
]

// Footer links
export const FOOTER_LINKS = [{ key: 'help', path: '/help' }] as const

// Process types (based on actual API model)
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
 * The theme values that may be STORED, which is a superset of the two the
 * toggle offers — next-themes writes `system` whenever the user has never
 * chosen, and that value has to survive a round trip through the node.
 */
export const THEME_VALUES = ['light', 'dark', 'system'] as const
export type ThemePreference = (typeof THEME_VALUES)[number]
