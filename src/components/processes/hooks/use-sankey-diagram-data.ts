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
import { logger } from '@/lib'

interface SankeyDiagramData {
  materials: EnhancedMaterialObject[]
  relationships: EnhancedMaterialRelationship[]
  isLoading: boolean
  error?: Error
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
  objectUuid?: UUID
): SankeyDiagramData & { layoutData: SankeyLayoutData | null } {
  const { useStatementsByPredicate, useObjectRelationships } = useStatements()
  const { useObjectsByUUIDs } = useObjects()

  // Fetch input relationships
  const inputStatementsQuery = objectUuid
    ? useObjectRelationships(objectUuid, { predicate: 'IS_INPUT_OF' })
    : useStatementsByPredicate('IS_INPUT_OF')

  // Debug: Log raw API responses
  logger.info('Raw API responses:', {
    objectUuid,
    inputStatementsQuery: {
      data: inputStatementsQuery.data,
      isLoading: inputStatementsQuery.isLoading,
      error: inputStatementsQuery.error,
    },
  })

  // Extract participating object UUIDs
  const participatingUUIDs = useMemo(() => {
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

    const uuids = new Set<UUID>()
    statements.forEach((stmt: UUStatementDTO) => {
      uuids.add(stmt.subject)
      uuids.add(stmt.object)
    })

    return Array.from(uuids)
  }, [inputStatementsQuery.data, objectUuid])

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
      }
    })

  // Create enhanced relationships with metadata
  const relationshipMap = new Map<string, EnhancedMaterialRelationship>()

  statements.forEach((statement) => {
    const subjectObj = objectMap.get(statement.subject)
    const objectObj = objectMap.get(statement.object)

    if (!subjectObj || !objectObj) {
      console.warn('Skipping relationship with missing objects:', {
        subject: statement.subject,
        object: statement.object,
      })
      return
    }

    // Extract process metadata
    const processName =
      getPropertyValue(statement, 'processName') || 'Unknown Process'

    // Extract input material data (namespaced)
    const inputQuantity =
      getNamespacedNumberValue(statement, 'input', 'quantity') ||
      parseFloat(getPropertyValue(statement, 'quantity') || '0')
    const inputUnit =
      getNamespacedPropertyValue(statement, 'input', 'unit') ||
      getPropertyValue(statement, 'unit') ||
      ''

    // Extract output material data (namespaced)
    const outputQuantity = getNamespacedNumberValue(
      statement,
      'output',
      'quantity'
    )
    const outputUnit = getNamespacedPropertyValue(statement, 'output', 'unit')

    if (
      !processName ||
      processName === 'Unknown Process' ||
      inputQuantity <= 0
    ) {
      console.warn('Skipping relationship with invalid process data:', {
        processName,
        inputQuantity,
        subject: subjectObj.name,
        object: objectObj.name,
        statement: statement,
      })
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
    const notes = getPropertyValue(statement, 'notes')

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

    // Extract custom properties (separated by input/output)
    const customProperties = extractCustomProperties(statement)

    const uniqueKey = `${statement.subject}-${statement.object}-${processName}-${inputQuantity}-${inputUnit}`

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
        customProperties: customProperties.input, // Use input custom properties for backward compatibility
        // NEW: Separated input/output data
        inputMaterial: {
          quantity: inputQuantity,
          unit: inputUnit,
          lifecycleStage: inputLifecycleStage,
          categoryCode: inputCategoryCode,
          customProperties: customProperties.input,
        },
        outputMaterial: {
          quantity: outputQuantity,
          unit: outputUnit,
          lifecycleStage: outputLifecycleStage,
          categoryCode: outputCategoryCode,
          customProperties: customProperties.output,
        },
      })
    }
  })

  return {
    materials,
    relationships: Array.from(relationshipMap.values()),
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
      return '#8B5CF6' // Purple - raw materials
    case 'SECONDARY_INPUT':
      return '#059669' // Emerald - recycled materials
    case 'REUSED_COMPONENT':
      return '#0EA5E9' // Sky blue - reused components (highlighting reuse)
    case 'PROCESSING':
      return '#F59E0B' // Amber - processing steps
    case 'COMPONENT':
      return '#10B981' // Green - building components
    case 'PRODUCT':
      return '#10B981' // Emerald - new buildings
    case 'USE_PHASE':
      return '#6366F1' // Indigo - existing buildings
    case 'WASTE':
      return '#F97316' // Orange - waste streams
    case 'DISPOSAL':
      return '#DC2626' // Red - disposal/landfill
    default:
      // Fallback to enhanced color scheme
      switch (fallbackType) {
        case 'input':
          return '#64748B' // Slate gray
        case 'output':
          return '#10B981' // Emerald
        default:
          return '#9CA3AF' // Gray
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

function extractCustomProperties(statement: UUStatementDTO): {
  input: Record<string, string>
  output: Record<string, string>
} {
  const inputCustomProperties: Record<string, string> = {}
  const outputCustomProperties: Record<string, string> = {}

  // Known metadata keys that are not custom properties (including namespaced versions)
  const knownKeys = new Set([
    // Process-level fields
    'processName',
    'processType',
    'quantity',
    'unit',
    'processCategory',
    'flowCategory',
    'isRecycling',
    'isDeconstruction',
    'sourceBuildingUuid',
    'targetBuildingUuid',
    'emissionsTotal',
    'emissionsUnit',
    'materialLossPercent',
    'qualityChangeCode',
    'notes',
    // Legacy material-level fields
    'inputLifecycleStage',
    'outputLifecycleStage',
    'inputCategoryCode',
    'outputCategoryCode',
    'isReusedInput',
    'isRecyclingMaterial',
    // Namespaced versions (new simplified names)
    'input_quantity',
    'input_unit',
    'output_quantity',
    'output_unit',
    'input_lifecycleStage',
    'input_categoryCode',
    'output_lifecycleStage',
    'output_categoryCode',
    // Namespaced versions (legacy double-prefixed names)
    'input_inputLifecycleStage',
    'input_inputCategoryCode',
    'input_isReusedInput',
    'input_isRecyclingMaterial',
    'output_outputLifecycleStage',
    'output_outputCategoryCode',
    'output_isReusedInput',
    'output_isRecyclingMaterial',
  ])

  statement.properties?.forEach((property) => {
    const key = property.key
    const value = property.values?.[0]?.value

    if (!value || !key) return

    if (key.startsWith('input_') && !knownKeys.has(key)) {
      // Remove "input_" prefix for display
      const displayKey = key.substring(6)
      inputCustomProperties[displayKey] = value
    } else if (key.startsWith('output_') && !knownKeys.has(key)) {
      // Remove "output_" prefix for display
      const displayKey = key.substring(7)
      outputCustomProperties[displayKey] = value
    } else if (
      !knownKeys.has(key) &&
      !key.startsWith('input_') &&
      !key.startsWith('output_')
    ) {
      // Legacy custom properties (not namespaced) - treat as input for backward compatibility
      inputCustomProperties[key] = value
    }
  })

  return { input: inputCustomProperties, output: outputCustomProperties }
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
