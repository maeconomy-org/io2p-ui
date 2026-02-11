import { ProcessCategory, LifecycleStage } from '@/types/sankey-metadata'

export const PROCESS_CATEGORIES: ProcessCategory[] = [
  'CONSTRUCTION',
  'DECONSTRUCTION',
  'SORTING',
  'RECYCLING',
  'REFURBISHMENT',
  'TRANSPORT',
  'DEMOLITION',
  'DISPOSAL',
]

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  'PRIMARY_INPUT',
  'SECONDARY_INPUT',
  'REUSED_COMPONENT',
  'PROCESSING',
  'COMPONENT',
  'PRODUCT',
  'USE_PHASE',
  'WASTE',
  'DISPOSAL',
]

export const FLOW_CATEGORY_OPTIONS = [
  { value: 'STANDARD', labelKey: 'STANDARD' },
  { value: 'RECYCLING', labelKey: 'RECYCLING' },
  { value: 'REUSE', labelKey: 'REUSE' },
  { value: 'DOWNCYCLING', labelKey: 'DOWNCYCLING' },
  { value: 'CIRCULAR', labelKey: 'CIRCULAR' },
  { value: 'WASTE_FLOW', labelKey: 'WASTE_FLOW' },
] as const

export const QUALITY_CHANGE_OPTIONS = [
  { value: 'UPCYCLED', labelKey: 'UPCYCLED' },
  { value: 'SAME', labelKey: 'SAME' },
  { value: 'DOWNCYCLED', labelKey: 'DOWNCYCLED' },
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

export const DOMAIN_CATEGORY_CODES = {
  // Structural materials
  CONCRETE: 'CONCRETE',
  STEEL: 'STEEL',
  TIMBER: 'TIMBER',
  MASONRY: 'MASONRY',

  // Building components
  WINDOW_UNIT: 'WINDOW_UNIT',
  DOOR_UNIT: 'DOOR_UNIT',
  ROOFING: 'ROOFING',
  INSULATION: 'INSULATION',

  // Systems
  HVAC: 'HVAC',
  ELECTRICAL: 'ELECTRICAL',
  PLUMBING: 'PLUMBING',

  // Finishes
  FLOORING: 'FLOORING',
  WALL_FINISH: 'WALL_FINISH',
  CEILING: 'CEILING',

  // Waste streams
  MIXED_WASTE: 'MIXED_WASTE',
  HAZARDOUS_WASTE: 'HAZARDOUS_WASTE',
} as const
