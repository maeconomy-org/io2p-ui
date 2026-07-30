/**
 * Site configuration and navigation
 */

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
  { key: 'objects', path: '/objects', dataTour: 'nav-objects' },
  { key: 'processes', path: '/processes', dataTour: 'nav-processes' },
  // `/groups` is intentionally absent: it still talks to the retired node through `iom-sdk`, and
  // io2p has no groups API to migrate it to — a Share is the successor. The route stays on disk
  // until `/shares` replaces it; it is only unreachable from the nav.
  {
    key: 'library',
    path: '/templates',
    dataTour: 'nav-models',
    children: [
      { key: 'models', path: '/templates' },
      { key: 'formulas', path: '/formulas' },
      { key: 'constants', path: '/constants' },
    ],
  },
  { key: 'import', path: '/import', dataTour: 'nav-import' },
]

// Footer links
export const FOOTER_LINKS = [
  { key: 'importStatus', path: '/import-status' },
  { key: 'help', path: '/help' },
] as const

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
