import { ProcessCategory } from '@/types/sankey-metadata'

export const PROCESS_CATEGORIES: ProcessCategory[] = [
  'CONSTRUCTION',
  'DECONSTRUCTION', 
  'SORTING',
  'RECYCLING',
  'REFURBISHMENT',
  'TRANSPORT',
  'DEMOLITION',
  'DISPOSAL'
]

export const FLOW_CATEGORY_OPTIONS = [
  { value: 'STANDARD', label: 'Standard Flow' },
  { value: 'RECYCLING', label: 'Recycling' },
  { value: 'REUSE', label: 'Reuse' },
  { value: 'DOWNCYCLING', label: 'Downcycling' },
  { value: 'CIRCULAR', label: 'Circular Flow' },
  { value: 'WASTE_FLOW', label: 'Waste Flow' },
] as const

export const QUALITY_CHANGE_OPTIONS = [
  { value: 'UPCYCLED', label: 'Upcycled (Improved Quality)' },
  { value: 'SAME', label: 'Same Quality' },
  { value: 'DOWNCYCLED', label: 'Downcycled (Reduced Quality)' },
] as const

// Color palettes for charts
export const PROCESS_CATEGORY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
]

export const LIFECYCLE_STAGE_COLORS = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
]
