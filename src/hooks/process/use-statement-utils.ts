import { useMemo } from 'react'
import type { UUStatementDTO } from 'iom-sdk'

/**
 * Shared utility for processing relationship statements
 * Used by both ProcessesTab and useInputOutputProcessesData
 */

export interface ProcessedRelationship {
  processName: string
  quantity: number
  unit: string
  subject: string
  object: string
  isValid: boolean
}

/**
 * Extract property value from statement
 */
export function getPropertyValue(
  statement: UUStatementDTO,
  key: string
): string | null {
  const property = statement.properties?.find((p) => p.key === key)
  return property?.values?.[0]?.value || null
}

/**
 * Process a single relationship statement into structured data
 */
export function processRelationshipStatement(
  statement: UUStatementDTO
): ProcessedRelationship {
  const processName =
    getPropertyValue(statement, 'processName') || 'Unknown Process'
  const quantity = parseFloat(getPropertyValue(statement, 'quantity') || '0')
  const unit = getPropertyValue(statement, 'unit') || ''

  const isValid = !!(
    processName &&
    processName !== 'Unknown Process' &&
    processName.trim()
  )

  return {
    processName,
    quantity,
    unit,
    subject: statement.subject,
    object: statement.object,
    isValid,
  }
}

/**
 * Hook to process relationships for object-specific views
 * Categorizes relationships as "created by" vs "used in"
 */
export function useObjectRelationshipProcessing(
  relationshipsData: {
    asSubject?: UUStatementDTO[]
    asObject?: UUStatementDTO[]
  } | null,
  objectUuid: string
) {
  return useMemo(() => {
    if (!relationshipsData || !objectUuid) {
      return { createdBy: [], usedIn: [] }
    }

    const createdBy: any[] = []
    const usedIn: any[] = []

    // Process "created by" relationships (this object is the output)
    relationshipsData.asObject?.forEach((rel) => {
      const processed = processRelationshipStatement(rel)

      if (processed.isValid) {
        createdBy.push({
          ...rel,
          type: 'created_by' as const,
          processName: processed.processName,
          quantity: processed.quantity,
          unit: processed.unit,
          inputObjectUuid: rel.subject,
          outputObjectUuid: rel.object,
        })
      }
    })

    // Process "used in" relationships (this object is the input)
    relationshipsData.asSubject?.forEach((rel) => {
      const processed = processRelationshipStatement(rel)

      if (processed.isValid) {
        usedIn.push({
          ...rel,
          type: 'used_in' as const,
          processName: processed.processName,
          quantity: processed.quantity,
          unit: processed.unit,
          inputObjectUuid: rel.subject,
          outputObjectUuid: rel.object,
        })
      }
    })

    return { createdBy, usedIn }
  }, [relationshipsData, objectUuid])
}
