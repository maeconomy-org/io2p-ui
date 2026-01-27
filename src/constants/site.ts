/**
 * Site configuration and branding
 */

// App branding (Static)
export const APP_NAME = 'Internet of Materials'
export const APP_DESCRIPTION = 'Material Management System'
export const APP_ACRONYM = 'IoM'

// Navigation
export const NAV_ITEMS = [
  { name: 'Objects', path: '/objects' },
  { name: 'I/O Processes', path: '/processes' },
  { name: 'Models', path: '/models' },
  { name: 'Import', path: '/import' },
]

// Footer links
export const FOOTER_LINKS = [
  { name: 'Import Status', path: '/import-status' },
  { name: 'Help', path: '/help' },
]

// Process types (based on actual API model)
export const PROCESS_TYPES = [
  { value: 'processing', label: 'Processing' },
  { value: 'assembly', label: 'Assembly' },
  { value: 'recycling', label: 'Recycling' },
  { value: 'disposal', label: 'Disposal' },
]

// Unit categories for material selection
export const UNIT_CATEGORIES = {
  volume: { label: 'Volume', units: ['L', 'mL', 'm³', 'gal'] },
  weight: { label: 'Weight/Mass', units: ['kg', 'g', 't', 'lb'] },
  area: { label: 'Area', units: ['m²', 'cm²', 'ft²'] },
  length: { label: 'Length', units: ['m', 'mm', 'cm', 'ft', 'in'] },
  count: { label: 'Count', units: ['pcs', 'ea', 'units', 'items'] },
  energy: {
    label: 'Energy/Environmental',
    units: ['kWh', 'kg CO2e', 'MJ', 'BTU'],
  },
}
