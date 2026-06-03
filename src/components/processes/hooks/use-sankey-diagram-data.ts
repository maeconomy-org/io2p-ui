import { useMemo } from 'react'
import type { UUID, UUStatementDTO, UUObjectDTO } from 'iom-sdk'

import { useStatements, useObjects } from '@/hooks/api'
import type {
  EnhancedMaterialObject,
  EnhancedMaterialRelationship,
  LifecycleStage,
  FlowCategory,
  ProcessCategory,
  QualityChangeCode,
} from '@/types'
import {
  limitStatementDepth,
  limitStatementDepthBidirectional,
  getMaxStatementDepth,
  computeStatementDepths,
} from '@/components/processes/utils'
import {
  decodeEdgeProperties,
  decodeProcessProperties,
} from '@/components/processes/utils/process-codec'
import { parseQuantity } from '@/lib/units/parse-quantity'
import { logger } from '@/lib'

interface SankeyDiagramData {
  materials: EnhancedMaterialObject[]
  relationships: EnhancedMaterialRelationship[]
  isLoading: boolean
  error?: Error
  totalNodeCount: number
  /** Number of topological levels in the full graph — drives the depth pager. */
  totalLevels: number
}

interface SankeyLayoutData {
  nodes: Array<EnhancedMaterialObject & { layer: number; x: number }>
  links: EnhancedMaterialRelationship[]
  recyclingFlows: EnhancedMaterialRelationship[]
  stats: {
    totalFlows: number
    recyclingFlows: number
    recyclingRate: number
    totalQuantity: number
    recyclingQuantity: number
  }
}

/**
 * New unified hook for Sankey diagram data that reads metadata from statement properties
 * Replaces the old chain of useSankeyData + useMaterialFlowProcessing + createLayeredLayout
 */
export function useSankeyDiagramData(
  objectUuid?: UUID,
  options?: {
    maxDepth?: number
    minDepth?: number
    focusNode?: string
    focusNodeBidirectional?: string
  }
): SankeyDiagramData & { layoutData: SankeyLayoutData | null } {
  const { useStatementsByPredicate, useObjectRelationships } = useStatements()
  const { useObjectsByUUIDs } = useObjects()
  const maxDepth = options?.maxDepth
  const minDepth = options?.minDepth ?? 0
  const focusNode = options?.focusNode
  const focusNodeBidirectional = options?.focusNodeBidirectional

  // Fetch input relationships

  const inputStatementsQuery = objectUuid
    ? useObjectRelationships(objectUuid, { predicate: 'IS_INPUT_OF' })
    : useStatementsByPredicate('IS_INPUT_OF')

  // Extract participating object UUIDs (with optional depth limiting)
  // When maxDepth is set, we compute topological depth from statements alone
  // and only fetch objects within the depth limit — avoids fetching deep nodes.
  const uuidResult = useMemo(() => {
    let statements: UUStatementDTO[] = []

    if (objectUuid) {
      const data = inputStatementsQuery.data
      if (data && typeof data === 'object' && 'combined' in data) {
        statements = data.combined
      }
    } else {
      statements = Array.isArray(inputStatementsQuery.data)
        ? inputStatementsQuery.data
        : []
    }

    if (!statements.length)
      return { kept: [] as UUID[], total: 0, totalLevels: 0 }

    // Collect all unique UUIDs
    const allUuids = new Set<UUID>()
    statements.forEach((stmt: UUStatementDTO) => {
      allUuids.add(stmt.subject)
      allUuids.add(stmt.object)
    })
    const total = allUuids.size
    // Full-graph depth (independent of the current window) so the pager knows
    // how many slices exist. Levels = max 0-based depth + 1.
    const totalLevels = getMaxStatementDepth(statements) + 1

    // Bidirectional focus takes priority: show 1 level upstream + downstream from a node
    if (focusNodeBidirectional) {
      const keptSet = limitStatementDepthBidirectional(
        statements,
        1,
        focusNodeBidirectional
      )
      return { kept: Array.from(keptSet) as UUID[], total, totalLevels }
    }

    // If maxDepth is set, only include UUIDs inside the window [minDepth, +maxDepth)
    if (maxDepth !== undefined) {
      const keptSet = limitStatementDepth(
        statements,
        maxDepth,
        focusNode,
        minDepth
      )
      return { kept: Array.from(keptSet) as UUID[], total, totalLevels }
    }

    return { kept: Array.from(allUuids) as UUID[], total, totalLevels }
  }, [
    inputStatementsQuery.data,
    objectUuid,
    maxDepth,
    minDepth,
    focusNode,
    focusNodeBidirectional,
  ])

  const participatingUUIDs = uuidResult.kept
  const totalNodeCount = uuidResult.total
  const totalLevels = uuidResult.totalLevels

  // Fetch participating objects
  const objectsQuery = useObjectsByUUIDs(participatingUUIDs, {
    enabled: participatingUUIDs.length > 0,
    includeDeleted: false,
  })

  // Process statements and objects into enhanced materials and relationships
  const processedData = useMemo(() => {
    let statements: UUStatementDTO[] = []

    if (objectUuid) {
      const data = inputStatementsQuery.data
      if (data && typeof data === 'object' && 'combined' in data) {
        statements = data.combined
      }
    } else {
      statements = Array.isArray(inputStatementsQuery.data)
        ? inputStatementsQuery.data
        : []
    }

    const objects = objectsQuery.data || []

    if (!statements.length || !objects.length) {
      return { materials: [], relationships: [] }
    }

    const result = processStatementsWithMetadata(statements, objects)
    return result
  }, [inputStatementsQuery.data, objectsQuery.data, objectUuid])

  // Compute layout data
  const layoutData = useMemo(() => {
    if (!processedData.materials.length) return null
    return computeMetadataDrivenLayout(
      processedData.materials,
      processedData.relationships
    )
  }, [processedData])

  const isLoading = inputStatementsQuery.isLoading || objectsQuery.isLoading

  return {
    materials: processedData.materials,
    relationships: processedData.relationships,
    layoutData,
    isLoading,
    totalNodeCount,
    totalLevels,
    error: inputStatementsQuery.error || objectsQuery.error || undefined,
  }
}

/**
 * Process statements and objects into enhanced materials and relationships
 * using metadata from statement properties instead of name-based heuristics
 */
function processStatementsWithMetadata(
  statements: UUStatementDTO[],
  objects: UUObjectDTO[]
): {
  materials: EnhancedMaterialObject[]
  relationships: EnhancedMaterialRelationship[]
} {
  // Create object lookup map
  const objectMap = new Map(objects.map((obj) => [obj.uuid, obj]))

  // ALAP column per node, computed over the FULL graph so columns stay stable as
  // the user pages depth slices (and so the chart matches the fetch window).
  const nodeDepths = computeStatementDepths(statements)

  // Analyze graph structure for material roles (same as before)
  const allSubjects = new Set(statements.map((s) => s.subject))
  const allObjects = new Set(statements.map((s) => s.object))

  const inputMaterials = new Set<string>()
  const outputMaterials = new Set<string>()
  const intermediateMaterials = new Set<string>()

  statements.forEach((statement) => {
    const subjectUuid = statement.subject
    const objectUuid = statement.object

    if (!allObjects.has(subjectUuid)) {
      inputMaterials.add(subjectUuid)
    } else {
      intermediateMaterials.add(subjectUuid)
    }

    if (!allSubjects.has(objectUuid)) {
      outputMaterials.add(objectUuid)
    } else {
      intermediateMaterials.add(objectUuid)
    }
  })

  // Clean up overlaps
  intermediateMaterials.forEach((uuid) => {
    inputMaterials.delete(uuid)
    outputMaterials.delete(uuid)
  })

  const allParticipatingMaterials = new Set([
    ...inputMaterials,
    ...outputMaterials,
    ...intermediateMaterials,
  ])

  // Create enhanced materials with metadata from statements
  const materials: EnhancedMaterialObject[] = objects
    .filter((obj) => allParticipatingMaterials.has(obj.uuid))
    .map((obj): EnhancedMaterialObject => {
      let type: 'input' | 'output' | 'intermediate' = 'intermediate'

      if (inputMaterials.has(obj.uuid)) {
        type = 'input'
      } else if (outputMaterials.has(obj.uuid)) {
        type = 'output'
      }

      // Extract lifecycle metadata from statements involving this object
      const relatedStatements = statements.filter(
        (stmt) => stmt.subject === obj.uuid || stmt.object === obj.uuid
      )

      const lifecycleStage = extractLifecycleStage(
        relatedStatements,
        obj.uuid,
        type
      )

      // Derive recycling/reuse status from lifecycle stage (not separate properties)
      const isRecyclingMaterial = lifecycleStage === 'SECONDARY_INPUT'
      const isReusedComponent = lifecycleStage === 'REUSED_COMPONENT'

      // Extract category code - try namespaced first, then legacy
      const firstStatement = relatedStatements[0]
      const domainCategoryCode =
        (firstStatement
          ? getNamespacedPropertyValue(firstStatement, 'input', 'categoryCode')
          : undefined) ||
        (firstStatement
          ? getNamespacedPropertyValue(firstStatement, 'output', 'categoryCode')
          : undefined) ||
        extractStringProperty(relatedStatements, 'inputCategoryCode') ||
        extractStringProperty(relatedStatements, 'outputCategoryCode')
      const sourceBuildingUuid = extractStringProperty(
        relatedStatements,
        'sourceBuildingUuid'
      )
      const targetBuildingUuid = extractStringProperty(
        relatedStatements,
        'targetBuildingUuid'
      )

      return {
        uuid: obj.uuid,
        name: obj.name || 'Unnamed Object',
        type,
        category: obj.description || 'Uncategorized',
        color: getLifecycleStageColor(lifecycleStage, type),
        lifecycleStage,
        isRecyclingMaterial,
        isReusedComponent,
        domainCategoryCode,
        sourceBuildingUuid,
        targetBuildingUuid,
        depth: nodeDepths.get(obj.uuid),
      }
    })

  // Create enhanced relationships with metadata
  const relationshipMap = new Map<string, EnhancedMaterialRelationship>()

  statements.forEach((statement) => {
    const subjectObj = objectMap.get(statement.subject)
    const objectObj = objectMap.get(statement.object)

    if (!subjectObj || !objectObj) {
      // Expected under depth-limiting: an edge crossing the visible slice's
      // boundary points to a node we intentionally did not fetch, so we drop it.
      // Debug-level (not warn) — this is normal, not an error.
      logger.debug('Skipping boundary relationship (object not in window)', {
        subject: statement.subject,
        object: statement.object,
      })
      return
    }

    // Extract process metadata
    const processName =
      getPropertyValue(statement, 'processName') || 'Unknown Process'

    // Decode each side's dynamic properties via the codec (clean labels, no raw keys).
    // Display uses the raw value as typed; chart magnitude uses the canonical value.
    const inSide = extractMaterialSide(statement, 'in', {
      quantity:
        getNamespacedNumberValue(statement, 'input', 'quantity') ||
        parseFloat(getPropertyValue(statement, 'quantity') || '0'),
      unit:
        getNamespacedPropertyValue(statement, 'input', 'unit') ||
        getPropertyValue(statement, 'unit') ||
        '',
    })
    const outSide = extractMaterialSide(statement, 'out', {
      quantity: getNamespacedNumberValue(statement, 'output', 'quantity') || 0,
      unit: getNamespacedPropertyValue(statement, 'output', 'unit') || '',
    })

    // Only require a valid process name. Quantities are optional — a process with no
    // quantity still renders (the chart falls back to a default magnitude).
    if (!processName || processName === 'Unknown Process') {
      return
    }

    // Extract flow metadata
    const processTypeCode = getPropertyValue(
      statement,
      'processCategory'
    ) as ProcessCategory
    const flowCategory = getPropertyValue(
      statement,
      'flowCategory'
    ) as FlowCategory
    const isCircular =
      getBooleanPropertyValue(statement, 'isRecycling') ||
      getBooleanPropertyValue(statement, 'isDeconstruction')

    // Extract impact metadata (process-level)
    const emissionsTotal =
      parseFloat(getPropertyValue(statement, 'emissionsTotal') || '0') ||
      undefined
    const emissionsUnit =
      getPropertyValue(statement, 'emissionsUnit') || 'kgCO2e'
    const materialLossPercent =
      parseFloat(getPropertyValue(statement, 'materialLossPercent') || '0') ||
      undefined
    const qualityChangeCode = getPropertyValue(
      statement,
      'qualityChangeCode'
    ) as QualityChangeCode
    const notes =
      getPropertyValue(statement, 'notes') ||
      getPropertyValue(statement, 'processDescription')

    // Extract input and output material metadata (try new simplified names first, then legacy)
    const inputLifecycleStage =
      getNamespacedPropertyValue(statement, 'input', 'lifecycleStage') || // New: input_lifecycleStage
      getNamespacedPropertyValue(statement, 'input', 'inputLifecycleStage') || // Legacy: input_inputLifecycleStage
      getPropertyValue(statement, 'inputLifecycleStage') // Very old: inputLifecycleStage
    const outputLifecycleStage =
      getNamespacedPropertyValue(statement, 'output', 'lifecycleStage') || // New: output_lifecycleStage
      getNamespacedPropertyValue(statement, 'output', 'outputLifecycleStage') || // Legacy: output_outputLifecycleStage
      getPropertyValue(statement, 'outputLifecycleStage') // Very old: outputLifecycleStage
    const inputCategoryCode =
      getNamespacedPropertyValue(statement, 'input', 'categoryCode') || // New: input_categoryCode
      getNamespacedPropertyValue(statement, 'input', 'inputCategoryCode') || // Legacy: input_inputCategoryCode
      getPropertyValue(statement, 'inputCategoryCode') // Very old: inputCategoryCode
    const outputCategoryCode =
      getNamespacedPropertyValue(statement, 'output', 'categoryCode') || // New: output_categoryCode
      getNamespacedPropertyValue(statement, 'output', 'outputCategoryCode') || // Legacy: output_outputCategoryCode
      getPropertyValue(statement, 'outputCategoryCode') // Very old: outputCategoryCode

    const uniqueKey = `${statement.subject}-${statement.object}-${processName}-${inSide.displayValue}`

    if (!relationshipMap.has(uniqueKey)) {
      relationshipMap.set(uniqueKey, {
        predicate: 'IS_INPUT_OF' as const,
        subject: {
          uuid: statement.subject,
          name: subjectObj.name || 'Unnamed Object',
        },
        object: {
          uuid: statement.object,
          name: objectObj.name || 'Unnamed Object',
        },
        processName,
        processTypeCode,
        flowCategory,
        isCircular,
        emissionsTotal,
        emissionsUnit,
        materialLossPercent,
        qualityChangeCode,
        notes,
        customProperties: inSide.customProperties,
        processProperties: Object.fromEntries(
          decodeProcessProperties(statement).map((p) => [
            p.label || p.key,
            p.values.filter(Boolean).join(', '),
          ])
        ),
        // Separated input/output data
        inputMaterial: {
          quantity: inSide.quantity,
          unit: inSide.unit,
          canonicalQuantity: inSide.canonicalQuantity,
          displayValue: inSide.displayValue,
          quantityLabel: inSide.quantityLabel,
          lifecycleStage: inputLifecycleStage,
          categoryCode: inputCategoryCode,
          customProperties: inSide.customProperties,
        },
        outputMaterial: {
          quantity: outSide.quantity,
          unit: outSide.unit,
          canonicalQuantity: outSide.canonicalQuantity,
          displayValue: outSide.displayValue,
          quantityLabel: outSide.quantityLabel,
          lifecycleStage: outputLifecycleStage,
          categoryCode: outputCategoryCode,
          customProperties: outSide.customProperties,
        },
      })
    }
  })

  const relationships = Array.from(relationshipMap.values())

  // Drop orphan nodes: a node kept by depth-limiting whose only edges point to
  // excluded (deep) nodes would otherwise float with no visible flow. Show only
  // materials that still participate in a surviving relationship.
  const connectedUuids = new Set<string>()
  relationships.forEach((rel) => {
    connectedUuids.add(rel.subject.uuid)
    connectedUuids.add(rel.object.uuid)
  })
  const connectedMaterials = materials.filter((m) => connectedUuids.has(m.uuid))

  return {
    materials: connectedMaterials,
    relationships,
  }
}

/**
 * Extract lifecycle stage from statement properties, with fallbacks based on graph role
 */
function extractLifecycleStage(
  statements: UUStatementDTO[],
  objectUuid: UUID,
  graphRole: 'input' | 'output' | 'intermediate'
): LifecycleStage | undefined {
  // Look for explicit lifecycle stage in statements
  const inputStage = extractStringProperty(
    statements,
    'inputLifecycleStage'
  ) as LifecycleStage
  const outputStage = extractStringProperty(
    statements,
    'outputLifecycleStage'
  ) as LifecycleStage

  if (inputStage) return inputStage
  if (outputStage) return outputStage

  // Fallback based on graph role and other metadata
  const isReused = extractBooleanProperty(statements, 'isReusedInput')
  const isRecycling = extractBooleanProperty(statements, 'isRecyclingMaterial')

  if (isReused) return 'REUSED_COMPONENT'
  if (isRecycling) return 'SECONDARY_INPUT'

  // Default fallbacks based on graph role
  switch (graphRole) {
    case 'input':
      return 'PRIMARY_INPUT'
    case 'output':
      return 'PRODUCT'
    case 'intermediate':
      return 'PROCESSING'
    default:
      return undefined
  }
}

/**
 * Get color based on lifecycle stage instead of name-based heuristics
 */
function getLifecycleStageColor(
  stage: LifecycleStage | undefined,
  fallbackType: string
): string {
  switch (stage) {
    case 'PRIMARY_INPUT':
      return '#FFBCBA' // Salmon pink - raw materials
    case 'SECONDARY_INPUT':
      return '#C8E6C3' // Sage green - recycled materials
    case 'REUSED_COMPONENT':
      return '#B4CDE3' // Steel blue - reused components
    case 'PROCESSING':
      return '#B4CDE3' // Steel blue - processing steps
    case 'COMPONENT':
      return '#C8E6C3' // Sage green - building components
    case 'PRODUCT':
      return '#CFC0E8' // Lavender - finished products
    case 'USE_PHASE':
      return '#CFC0E8' // Lavender - existing buildings
    case 'WASTE':
      return '#FFBCBA' // Salmon pink - waste streams
    case 'DISPOSAL':
      return '#FFBCBA' // Salmon pink - disposal/landfill
    default:
      // Fallback using the same palette by graph role
      switch (fallbackType) {
        case 'input':
          return '#FFBCBA' // Salmon pink
        case 'output':
          return '#CFC0E8' // Lavender
        default:
          return '#B4CDE3' // Steel blue
      }
  }
}

/**
 * Compute metadata-driven layout (replaces createLayeredLayout)
 */
function computeMetadataDrivenLayout(
  materials: EnhancedMaterialObject[],
  relationships: EnhancedMaterialRelationship[]
): SankeyLayoutData {
  // Assign stage levels based on lifecycle metadata instead of names
  const nodes = materials.map((material) => ({
    ...material,
    layer: getStageFromLifecycle(material.lifecycleStage, material.type),
    x: getStageFromLifecycle(material.lifecycleStage, material.type),
  }))

  // Separate recycling/circular flows from standard flows
  const recyclingFlows: EnhancedMaterialRelationship[] = []
  const standardFlows: EnhancedMaterialRelationship[] = []

  relationships.forEach((rel) => {
    const isRecyclingFlow =
      rel.flowCategory === 'RECYCLING' ||
      rel.flowCategory === 'CIRCULAR' ||
      rel.flowCategory === 'REUSE' ||
      rel.flowCategory === 'DOWNCYCLING' ||
      rel.isCircular

    if (isRecyclingFlow) {
      recyclingFlows.push(rel)
    }
    standardFlows.push(rel) // Include recycling flows in main diagram too
  })

  // Calculate statistics
  const totalQuantity = relationships.reduce(
    (sum, rel) => sum + (rel.quantity || 0),
    0
  )
  const recyclingQuantity = recyclingFlows.reduce(
    (sum, rel) => sum + (rel.quantity || 0),
    0
  )
  const recyclingRate =
    totalQuantity > 0
      ? Math.round((recyclingQuantity / totalQuantity) * 100)
      : 0

  return {
    nodes,
    links: standardFlows,
    recyclingFlows,
    stats: {
      totalFlows: relationships.length,
      recyclingFlows: recyclingFlows.length,
      recyclingRate,
      totalQuantity,
      recyclingQuantity,
    },
  }
}

/**
 * Get stage number from lifecycle metadata instead of name-based heuristics
 */
function getStageFromLifecycle(
  stage: LifecycleStage | undefined,
  fallbackType: string
): number {
  switch (stage) {
    case 'PRIMARY_INPUT':
      return 0.0
    case 'SECONDARY_INPUT':
      return 0.2
    case 'REUSED_COMPONENT':
      return 0.8
    case 'PROCESSING':
      return 1.5
    case 'COMPONENT':
      return 3.0
    case 'PRODUCT':
      return 3.5
    case 'USE_PHASE':
      return 3.7
    case 'WASTE':
      return 4.2
    case 'DISPOSAL':
      return 4.8
    default:
      // Fallback based on graph role
      switch (fallbackType) {
        case 'input':
          return 0.0
        case 'intermediate':
          return 2.0
        case 'output':
          return 3.5
        default:
          return 2.0
      }
  }
}

// Helper functions for extracting metadata from statement properties
function getPropertyValue(
  statement: UUStatementDTO,
  key: string
): string | undefined {
  const property = statement.properties?.find((prop) => prop.key === key)
  const value = property?.values?.[0]?.value
  return value
}

function getBooleanPropertyValue(
  statement: UUStatementDTO,
  key: string
): boolean {
  const value = getPropertyValue(statement, key)
  return value === 'true'
}

function getNamespacedPropertyValue(
  statement: UUStatementDTO,
  namespace: 'input' | 'output',
  key: string
): string | undefined {
  // Try namespaced version first
  const namespacedKey = `${namespace}_${key}`
  const namespacedValue = getPropertyValue(statement, namespacedKey)
  if (namespacedValue) return namespacedValue

  // Fall back to non-namespaced for backward compatibility
  return getPropertyValue(statement, key)
}

function getNamespacedNumberValue(
  statement: UUStatementDTO,
  namespace: 'input' | 'output',
  key: string
): number | undefined {
  const value = getNamespacedPropertyValue(statement, namespace, key)
  return value ? parseFloat(value) || undefined : undefined
}

interface MaterialSide {
  quantity: number // raw numeric value for display
  unit: string // raw unit as typed
  canonicalQuantity: number // canonical value for chart magnitude
  displayValue: string // raw value string as typed (e.g. "0.1 t")
  quantityLabel?: string // label of the quantity property (e.g. "Quantity")
  customProperties: Record<string, string> // non-quantity properties, label -> value
}

/**
 * Resolve one side of an edge using the codec. New-format edges decode cleanly (quantity +
 * labelled extras); when none are present, fall back to the legacy quantity/unit.
 */
function extractMaterialSide(
  statement: UUStatementDTO,
  side: 'in' | 'out',
  legacy: { quantity: number; unit: string }
): MaterialSide {
  const props = decodeEdgeProperties(statement, side)

  if (props.length === 0) {
    const display = legacy.quantity
      ? `${legacy.quantity} ${legacy.unit}`.trim()
      : ''
    return {
      quantity: legacy.quantity,
      unit: legacy.unit,
      canonicalQuantity: legacy.quantity,
      displayValue: display,
      customProperties: {},
    }
  }

  const qty = props.find((p) => p.isQuantity)
  const parsed = qty ? parseQuantity(qty.values[0] ?? '') : null

  const customProperties: Record<string, string> = {}
  props
    .filter((p) => !p.isQuantity)
    .forEach((p) => {
      customProperties[p.label || p.key] = p.values.filter(Boolean).join(', ')
    })

  return {
    quantity: parsed?.value ?? 0,
    unit: qty?.unit ?? parsed?.unit ?? '',
    canonicalQuantity:
      qty?.canonicalValue ?? parsed?.canonicalValue ?? parsed?.value ?? 0,
    displayValue: qty?.values[0] ?? '',
    quantityLabel: qty?.label,
    customProperties,
  }
}

function extractStringProperty(
  statements: UUStatementDTO[],
  key: string
): string | undefined {
  for (const stmt of statements) {
    const value = getPropertyValue(stmt, key)
    if (value) return value
  }
  return undefined
}

function extractBooleanProperty(
  statements: UUStatementDTO[],
  key: string
): boolean {
  for (const stmt of statements) {
    const value = getBooleanPropertyValue(stmt, key)
    if (value) return value
  }
  return false
}
