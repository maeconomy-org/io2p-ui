/**
 * Site configuration and navigation
 */

// Navigation
export const NAV_ITEMS = [
  { key: 'objects', path: '/objects', dataTour: 'nav-objects' },
  { key: 'processes', path: '/processes', dataTour: 'nav-processes' },
  { key: 'groups', path: '/groups', dataTour: 'nav-groups' },
  { key: 'models', path: '/models', dataTour: 'nav-models' },
  { key: 'import', path: '/import', dataTour: 'nav-import' },
] as const

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
