/**
 * Metadata types for the new Sankey diagram lifecycle and emissions tracking
 * Based on docs/sankey-diagram-plan.md section 3.1
 */

export type LifecycleStage =
  | 'PRIMARY_INPUT'        // virgin raw material, never used in a building before
  | 'SECONDARY_INPUT'      // recycled material (e.g. aggregate) coming from previous buildings
  | 'REUSED_COMPONENT'     // intact component reused from an existing building (door, window, beam)
  | 'PROCESSING'           // intermediate processing step (sorting, crushing, cutting, cleaning)
  | 'COMPONENT'            // building component (wall, floor, window unit, etc.)
  | 'PRODUCT'              // complete product/building
  | 'USE_PHASE'            // in-use building/material (optional for future "in use" flows)
  | 'WASTE'                // waste fraction after a process
  | 'DISPOSAL'             // landfill / incineration / final sink

export type FlowCategory =
  | 'STANDARD'      // normal process flow
  | 'RECYCLING'     // recycling process (crushing, re-melting, re-processing)
  | 'REUSE'         // direct reuse of components between buildings
  | 'DOWNCYCLING'   // quality goes down (e.g. concrete → aggregate)
  | 'CIRCULAR'      // explicit circular loop (back into earlier lifecycle stages)
  | 'WASTE_FLOW'    // to waste management / disposal

export type ProcessCategory =
  | 'CONSTRUCTION'
  | 'DECONSTRUCTION'
  | 'SORTING'
  | 'RECYCLING'
  | 'REFURBISHMENT'
  | 'TRANSPORT'
  | 'DEMOLITION'
  | 'DISPOSAL'

export type QualityChangeCode = 'UPCYCLED' | 'SAME' | 'DOWNCYCLED'

/**
 * Process-level metadata (applies to all I/O of a process instance)
 */
export interface ProcessMetadata {
  // Core fields (existing)
  processName: string
  processType: string
  quantity: number
  unit: string

  // Process-level lifecycle metadata
  processCategory?: ProcessCategory
  flowCategory?: FlowCategory  // For diagram link styling
  
  // Impact data (process-level)
  emissionsTotal?: number       // kgCO2e emitted
  emissionsUnit?: string        // e.g. 'kgCO2e'
  materialLossPercent?: number  // 0–100%
  qualityChangeCode?: QualityChangeCode
  notes?: string               // Process notes
  
  // Legacy fields (for backward compatibility)
  isRecycling?: boolean
  isDeconstruction?: boolean
  sourceBuildingUuid?: string  // building that materials are recovered from
  targetBuildingUuid?: string  // building that materials are used in
  sector?: string
  domain?: string

  // Allow additional metadata
  [key: string]: any
}

/**
 * Material-level metadata (per input/output selection)
 * These are added as additional properties per statement
 * Field names are simplified - namespace prefix (input_/output_) is added when storing
 */
export interface MaterialFlowMetadata {
  // Simplified lifecycle metadata (namespace prefix added when storing)
  lifecycleStage?: LifecycleStage
  categoryCode?: string    // e.g. 'CONCRETE', 'WINDOW_UNIT', 'STEEL_BEAM'
  
  // Legacy field names (for backward compatibility with existing data)
  inputLifecycleStage?: LifecycleStage
  outputLifecycleStage?: LifecycleStage
  inputCategoryCode?: string
  outputCategoryCode?: string
  
  // Namespaced quantity/unit (added by useCreateProcessFlow)
  input_quantity?: number
  input_unit?: string
  output_quantity?: number
  output_unit?: string
  
  // Allow additional metadata (for custom properties)
  [key: string]: any
}

/**
 * Extended MaterialObject type for Sankey visualization
 */
export interface EnhancedMaterialObject {
  uuid: string
  name: string
  type: 'input' | 'output' | 'intermediate'

  // NEW: lifecycle and reuse metadata (derived from statement properties)
  lifecycleStage?: LifecycleStage
  isRecyclingMaterial?: boolean
  isReusedComponent?: boolean
  reuseCycleIndex?: number             // 0 = first life, 1 = second life, etc.
  domainCategoryCode?: string
  sourceBuildingUuid?: string
  targetBuildingUuid?: string
  
  // Existing fields
  category?: string
  color?: string
}

/**
 * Material-specific data structure
 */
export interface MaterialData {
  quantity?: number
  unit?: string
  lifecycleStage?: string
  categoryCode?: string
  customProperties?: Record<string, string>
}

/**
 * Extended MaterialRelationship type for Sankey visualization
 */
export interface EnhancedMaterialRelationship {
  predicate: 'IS_INPUT_OF' | 'IS_OUTPUT_OF'
  subject: { uuid: string; name: string }
  object: { uuid: string; name: string }
  quantity?: number  // Legacy field - use inputMaterial.quantity instead
  unit?: string      // Legacy field - use inputMaterial.unit instead
  processName?: string

  // NEW: flow and impact metadata (derived from statement properties)
  processTypeCode?: string
  flowCategory?: FlowCategory
  isCircular?: boolean

  // NEW: user-provided impact metrics for hover tooltips
  emissionsTotal?: number
  emissionsUnit?: string
  materialLossPercent?: number
  qualityChangeCode?: QualityChangeCode
  notes?: string
  
  // LEGACY: custom properties from material metadata (for backward compatibility)
  customProperties?: Record<string, string>
  
  // NEW: Separated input/output material data
  inputMaterial?: MaterialData
  outputMaterial?: MaterialData
}

/**
 * Domain category codes for material classification
 */
export const DOMAIN_CATEGORY_CODES = {
  // Structural materials
  CONCRETE: 'Concrete and concrete products',
  STEEL: 'Steel and steel products',
  TIMBER: 'Timber and wood products',
  MASONRY: 'Brick, stone, and masonry',
  
  // Building components
  WINDOW_UNIT: 'Windows and glazing systems',
  DOOR_UNIT: 'Doors and door systems',
  ROOFING: 'Roofing materials and systems',
  INSULATION: 'Thermal and acoustic insulation',
  
  // Systems
  HVAC: 'Heating, ventilation, and air conditioning',
  ELECTRICAL: 'Electrical systems and components',
  PLUMBING: 'Plumbing and water systems',
  
  // Finishes
  FLOORING: 'Flooring materials and systems',
  WALL_FINISH: 'Wall finishes and cladding',
  CEILING: 'Ceiling systems and finishes',
  
  // Waste streams
  MIXED_WASTE: 'Mixed construction waste',
  HAZARDOUS_WASTE: 'Hazardous materials and waste',
} as const

export type DomainCategoryCode = keyof typeof DOMAIN_CATEGORY_CODES

