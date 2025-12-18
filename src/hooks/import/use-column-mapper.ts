import { useState, useEffect, useMemo, useCallback } from 'react'

import { logger } from '@/lib'
import {
  IMPORT_HEADER_ROW_KEY,
  IMPORT_START_ROW_KEY,
  IMPORT_COLUMN_MAPPING_KEY,
  IMPORT_MAPPING_TEMPLATES_KEY,
  MAX_PREVIEW_ROWS,
} from '@/constants'

// Types
export interface PropertyDefinition {
  key: string
  label: string
  required?: boolean
  isCustomProperty?: boolean
}

export interface MappingTemplate {
  id: string
  name: string
  mapping: Record<string, string>
}

export interface UseColumnMapperProps {
  sheetData: any[]
  suggestedStartRow?: number
  initialMapping?: Record<string, string>
}

export interface UseColumnMapperResult {
  // State values
  columnMapping: Record<string, string>
  headers: any[]
  previewData: any[]
  headerRowIndex: number
  startRowIndex: number
  useFirstRowAsHeaders: boolean
  mappingTemplates: MappingTemplate[]
  activeTemplateId: string | null

  // Derived values
  mappedData: any[]
  mappedHeaders: { label: string; value: string }[]
  unmappedHeaders: { label: string; value: number }[]
  requiredFieldsMapped: boolean

  // Actions
  handleMappingChange: (columnIndex: number, propertyKey: string) => void
  setHeaderRowIndex: (index: number) => void
  toggleUseFirstRowAsHeaders: () => void
  saveTemplate: (name: string) => void
  applyTemplate: (templateId: string) => void
  resetMapping: () => void
  processData: () => any[] // Returns the processed data
  handleMapMultipleAsProperties: () => void
}

// Default property definitions
export const DEFAULT_PROPERTIES: PropertyDefinition[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'description', label: 'Description' },
  { key: 'version', label: 'Version' },
  { key: 'abbreviation', label: 'Abbreviation' },
  { key: '__property__', label: 'As Property', isCustomProperty: true },
]

export function useColumnMapper({
  sheetData,
  suggestedStartRow = 0,
  initialMapping = {},
}: UseColumnMapperProps): UseColumnMapperResult {
  // Clear any legacy localStorage mappings on initialization to avoid confusion
  // TODO: Remove this once we've confirmed that the new session storage is working
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('import_last_column_mapping')
    }
  }, [])
  // Helper to get stored values from storage
  const getSessionValue = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue
    const stored = sessionStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  }

  // Helper to get stored values from local storage
  const getLocalStorageValue = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  }

  // State for column mapping - try to get from initialMapping, then sessionStorage only
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    () => {
      if (Object.keys(initialMapping).length > 0) {
        return initialMapping
      }

      // Try to get from sessionStorage first (for current session only)
      const sessionMapping = getSessionValue(IMPORT_COLUMN_MAPPING_KEY, {})
      if (Object.keys(sessionMapping).length > 0) {
        return sessionMapping
      }

      // Start fresh - no localStorage fallback to avoid confusion between different CSV structures
      return {}
    }
  )

  // State for header toggle and indices
  const [useFirstRowAsHeaders, setUseFirstRowAsHeaders] = useState(true)
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(
    getSessionValue(IMPORT_HEADER_ROW_KEY, suggestedStartRow)
  )
  const [startRowIndex, setStartRowIndex] = useState<number>(
    getSessionValue(IMPORT_START_ROW_KEY, suggestedStartRow + 1)
  )

  // Template state
  const [mappingTemplates, setMappingTemplates] = useState<MappingTemplate[]>(
    []
  )
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

  // Store values in session storage when they change
  useEffect(() => {
    sessionStorage.setItem(
      IMPORT_HEADER_ROW_KEY,
      JSON.stringify(headerRowIndex)
    )
  }, [headerRowIndex])

  useEffect(() => {
    sessionStorage.setItem(IMPORT_START_ROW_KEY, JSON.stringify(startRowIndex))
  }, [startRowIndex])

  // Store column mapping in session storage for current session only (no localStorage persistence)
  useEffect(() => {
    if (typeof window === 'undefined' || !columnMapping) return

    // Only store in session storage for current session (no localStorage persistence)
    if (Object.keys(columnMapping).length > 0) {
      // Store in session storage for current session only
      sessionStorage.setItem(
        IMPORT_COLUMN_MAPPING_KEY,
        JSON.stringify(columnMapping)
      )
      // Note: Removed localStorage persistence to avoid confusion between different CSV structures
    }
  }, [columnMapping])

  // Load templates from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const templatesString = localStorage.getItem(IMPORT_MAPPING_TEMPLATES_KEY)
      if (templatesString) {
        const templates = JSON.parse(templatesString)
        setMappingTemplates(templates)
      }
    } catch (error) {
      logger.error('Failed to load mapping templates:', error)
    }
  }, [])

  // Extract headers from sheet data
  const headers = useMemo(() => {
    return Array.isArray(sheetData) && sheetData.length > headerRowIndex
      ? sheetData[headerRowIndex]
      : []
  }, [sheetData, headerRowIndex])

  // Get data rows (limited to avoid performance issues in UI only)
  const previewData = useMemo(() => {
    if (!Array.isArray(sheetData) || sheetData.length <= startRowIndex)
      return []
    // Only take limited rows for preview to avoid UI performance issues
    return sheetData.slice(startRowIndex, startRowIndex + MAX_PREVIEW_ROWS)
  }, [sheetData, startRowIndex])

  // Get mapped headers for display
  const mappedHeaders = useMemo(() => {
    return Object.entries(columnMapping).map(([index, propKey]) => {
      // Handle property mappings (e.g., __property__:name:Display Name)
      if (propKey.startsWith('__property__:')) {
        const [, key, label] = propKey.split(':')
        return {
          value: propKey,
          label: `Custom Property: ${label || key}`,
        }
      }

      // Find matching property definition
      const prop = DEFAULT_PROPERTIES.find((p) => p.key === propKey)
      return {
        value: propKey,
        label: prop?.label || propKey,
      }
    })
  }, [columnMapping])

  // Get unmapped headers
  const unmappedHeaders = useMemo(() => {
    const mapped = new Set(Object.keys(columnMapping).map(Number))

    return headers
      .map((header: any, index: number) => ({
        label: useFirstRowAsHeaders
          ? header || `Column ${index + 1}`
          : `Column ${index + 1}`,
        value: index,
      }))
      .filter((h: { value: number }) => !mapped.has(h.value))
  }, [headers, columnMapping, useFirstRowAsHeaders])

  // Check if all required fields are mapped
  const requiredFieldsMapped = useMemo(() => {
    const mappedFields = new Set(Object.values(columnMapping))
    return DEFAULT_PROPERTIES.filter((prop) => prop.required).every((prop) =>
      mappedFields.has(prop.key)
    )
  }, [columnMapping])

  // Process data with current mapping
  const processData = useCallback(() => {
    // Important: Process ALL data, not just preview data
    if (
      !Array.isArray(sheetData) ||
      !Object.keys(columnMapping).length ||
      sheetData.length <= startRowIndex
    )
      return []

    // Use all rows from start index, not just preview rows
    const allDataRows = sheetData.slice(startRowIndex)

    return allDataRows.map((row) => {
      const obj: Record<string, any> = {
        properties: [], // Initialize properties as an array of objects, not a nested object
      }

      Object.entries(columnMapping).forEach(([colIndex, propKey]) => {
        // Skip empty string values (explicitly unmapped)
        if (propKey === '') return

        const index = Number(colIndex)
        const value = row[index]

        // Skip null/undefined values
        if (value === null || value === undefined) return

        // Handle property mapping (as custom property)
        if (propKey.startsWith('__property__:')) {
          const [, key, label] = propKey.split(':')

          // Add as a property object with key, label, and values array
          obj.properties.push({
            key,
            label: label || key,
            values: [{ value: String(value) }],
          })
        } else {
          // Regular field mapping
          obj[propKey] = String(value)
        }
      })

      return obj
    })
  }, [sheetData, startRowIndex, columnMapping])

  // Map multiple columns as properties
  const handleMapMultipleAsProperties = useCallback(() => {
    // Track columns that were explicitly set to "none" in a separate Set
    // We'll use an empty string value in columnMapping to represent explicitly set "none" values
    const explicitlyUnmapped = new Set(
      Object.entries(columnMapping)
        .filter(([_, value]) => value === '')
        .map(([index, _]) => Number(index))
    )

    // Find columns that have no mapping AND aren't explicitly set to "none"
    const unmappedColumns = headers
      .map((_: any, index: number) => index)
      .filter(
        (index: number) =>
          // Has no mapping at all
          !(index in columnMapping) &&
          // And is not in our explicitly unmapped set
          !explicitlyUnmapped.has(index)
      )

    if (unmappedColumns.length === 0) return

    // Create a new mapping with eligible unmapped columns set to properties
    const newMapping = { ...columnMapping }

    unmappedColumns.forEach((columnIndex: number) => {
      if (useFirstRowAsHeaders && headers[columnIndex]) {
        const headerValue = headers[columnIndex]
        const propertyKey = String(headerValue)
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w]/g, '')

        newMapping[columnIndex] = `__property__:${propertyKey}:${headerValue}`
      }
    })

    setColumnMapping(newMapping)
  }, [headers, columnMapping, useFirstRowAsHeaders])

  // Get mapped data
  const mappedData = useMemo(() => processData(), [processData])

  // Handle mapping change
  const handleMappingChange = useCallback(
    (columnIndex: number, propertyKey: string) => {
      if (propertyKey === '') {
        // For 'none' selection - don't remove the mapping, set it to empty string
        // so we can track that this was explicitly set as "don't import"
        setColumnMapping((prev) => ({
          ...prev,
          [columnIndex]: '', // Empty string represents "don't import this column"
        }))
      } else if (propertyKey === '__property__') {
        // For "As Property" option, we need to get the header as the property key
        if (useFirstRowAsHeaders && headers[columnIndex]) {
          // Use the header as the property key
          const headerValue = headers[columnIndex]
          const propertyKey = String(headerValue)
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\w]/g, '')

          // Store it with a special prefix to identify it as a custom property
          setColumnMapping((prev) => ({
            ...prev,
            [columnIndex]: `__property__:${propertyKey}:${headerValue}`,
          }))
        } else {
          // If no header, prompt for a property key
          const customKey = prompt('Enter a property key for this column:')
          if (customKey) {
            setColumnMapping((prev) => ({
              ...prev,
              [columnIndex]: `__property__:${customKey}:${customKey}`,
            }))
          }
        }
      } else {
        // Add or update mapping for this column
        setColumnMapping((prev) => ({
          ...prev,
          [columnIndex]: propertyKey,
        }))
      }
    },
    [headers, useFirstRowAsHeaders]
  )

  // Toggle use of headers
  const toggleUseFirstRowAsHeaders = useCallback(() => {
    setUseFirstRowAsHeaders((prev) => !prev)

    // If we're now using headers, adjust the start row
    if (!useFirstRowAsHeaders) {
      setStartRowIndex(headerRowIndex + 1)
    }
  }, [useFirstRowAsHeaders, headerRowIndex])

  // Reset mapping
  const resetMapping = useCallback(() => {
    setColumnMapping({})
    setActiveTemplateId(null)
  }, [])

  // Save template
  const saveTemplate = useCallback(
    (name: string) => {
      if (!name.trim() || !Object.keys(columnMapping).length) return

      const newTemplate: MappingTemplate = {
        id: Date.now().toString(),
        name: name.trim(),
        mapping: columnMapping,
      }

      const updatedTemplates = [...mappingTemplates, newTemplate]

      // Save to localStorage
      try {
        localStorage.setItem(
          IMPORT_MAPPING_TEMPLATES_KEY,
          JSON.stringify(updatedTemplates)
        )
        setMappingTemplates(updatedTemplates)
        setActiveTemplateId(newTemplate.id)
      } catch (error) {
        logger.error('Failed to save template:', error)
      }
    },
    [columnMapping, mappingTemplates]
  )

  // Apply template
  const applyTemplate = useCallback(
    (templateId: string) => {
      const template = mappingTemplates.find((t) => t.id === templateId)
      if (!template) return

      setColumnMapping(template.mapping)
      setActiveTemplateId(templateId)
    },
    [mappingTemplates]
  )

  return {
    // State
    columnMapping,
    headers,
    previewData,
    headerRowIndex,
    startRowIndex,
    useFirstRowAsHeaders,
    mappingTemplates,
    activeTemplateId,

    // Derived values
    mappedData,
    mappedHeaders,
    unmappedHeaders,
    requiredFieldsMapped,

    // Actions
    handleMappingChange,
    setHeaderRowIndex,
    toggleUseFirstRowAsHeaders,
    saveTemplate,
    applyTemplate,
    resetMapping,
    processData,
    handleMapMultipleAsProperties,
  }
}
