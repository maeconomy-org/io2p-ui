import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useColumnMapper,
  DEFAULT_PROPERTIES,
} from '@/hooks/import/use-column-mapper'

// Mock sessionStorage and localStorage
const mockStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
}

describe('useColumnMapper', () => {
  let sessionStorageMock: ReturnType<typeof mockStorage>
  let localStorageMock: ReturnType<typeof mockStorage>

  beforeEach(() => {
    sessionStorageMock = mockStorage()
    localStorageMock = mockStorage()

    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
    })
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const sampleSheetData = [
    ['Name', 'Description', 'Version', 'Custom Field'],
    ['Item 1', 'Desc 1', '1.0', 'Value 1'],
    ['Item 2', 'Desc 2', '2.0', 'Value 2'],
    ['Item 3', 'Desc 3', '3.0', 'Value 3'],
  ]

  describe('initial state', () => {
    it('should initialize with empty column mapping', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      expect(result.current.columnMapping).toEqual({})
    })

    it('should use initial mapping if provided', () => {
      const initialMapping = { 0: 'name', 1: 'description' }

      const { result } = renderHook(() =>
        useColumnMapper({
          sheetData: sampleSheetData,
          initialMapping,
        })
      )

      expect(result.current.columnMapping).toEqual(initialMapping)
    })

    it('should extract headers from first row', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      expect(result.current.headers).toEqual([
        'Name',
        'Description',
        'Version',
        'Custom Field',
      ])
    })
  })

  describe('handleMappingChange', () => {
    it('should update column mapping', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(0, 'name')
      })

      expect(result.current.columnMapping[0]).toBe('name')
    })

    it('should set empty string for "none" selection', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(0, 'name')
      })

      act(() => {
        result.current.handleMappingChange(0, '')
      })

      expect(result.current.columnMapping[0]).toBe('')
    })

    it('should handle "As Property" mapping with header', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(3, '__property__')
      })

      expect(result.current.columnMapping[3]).toContain('__property__:')
      expect(result.current.columnMapping[3]).toContain('custom_field')
    })
  })

  describe('requiredFieldsMapped', () => {
    it('should return false when required fields are not mapped', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      expect(result.current.requiredFieldsMapped).toBe(false)
    })

    it('should return true when all required fields are mapped', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(0, 'name')
      })

      expect(result.current.requiredFieldsMapped).toBe(true)
    })
  })

  describe('resetMapping', () => {
    it('should clear all mappings', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(0, 'name')
        result.current.handleMappingChange(1, 'description')
      })

      expect(Object.keys(result.current.columnMapping).length).toBe(2)

      act(() => {
        result.current.resetMapping()
      })

      expect(result.current.columnMapping).toEqual({})
    })
  })

  describe('processData', () => {
    it('should return empty array when no mapping', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      const processed = result.current.processData()
      expect(processed).toEqual([])
    })

    it('should process data with mapping', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(0, 'name')
        result.current.handleMappingChange(1, 'description')
      })

      const processed = result.current.processData()

      expect(processed.length).toBe(3) // 3 data rows
      expect(processed[0].name).toBe('Item 1')
      expect(processed[0].description).toBe('Desc 1')
    })

    it('should handle property mappings', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(0, 'name')
        result.current.handleMappingChange(3, '__property__')
      })

      const processed = result.current.processData()

      expect(processed[0].properties).toBeDefined()
      expect(processed[0].properties.length).toBeGreaterThan(0)
      expect(processed[0].properties[0].values[0].value).toBe('Value 1')
    })
  })

  describe('unmappedHeaders', () => {
    it('should return all headers when nothing is mapped', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      expect(result.current.unmappedHeaders.length).toBe(4)
    })

    it('should exclude mapped headers', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      act(() => {
        result.current.handleMappingChange(0, 'name')
      })

      expect(result.current.unmappedHeaders.length).toBe(3)
      expect(
        result.current.unmappedHeaders.find((h) => h.value === 0)
      ).toBeUndefined()
    })
  })

  describe('handleMapMultipleAsProperties', () => {
    it('should map unmapped columns as properties', () => {
      const { result } = renderHook(() =>
        useColumnMapper({ sheetData: sampleSheetData })
      )

      // First map the name field
      act(() => {
        result.current.handleMappingChange(0, 'name')
      })

      // Then map remaining as properties
      act(() => {
        result.current.handleMapMultipleAsProperties()
      })

      // All columns should now be mapped
      expect(Object.keys(result.current.columnMapping).length).toBe(4)

      // Columns 1, 2, 3 should be mapped as properties
      expect(result.current.columnMapping[1]).toContain('__property__:')
      expect(result.current.columnMapping[2]).toContain('__property__:')
      expect(result.current.columnMapping[3]).toContain('__property__:')
    })
  })

  describe('DEFAULT_PROPERTIES', () => {
    it('should have name as required field', () => {
      const nameProperty = DEFAULT_PROPERTIES.find((p) => p.key === 'name')
      expect(nameProperty?.required).toBe(true)
    })

    it('should have __property__ as custom property', () => {
      const customProperty = DEFAULT_PROPERTIES.find(
        (p) => p.key === '__property__'
      )
      expect(customProperty?.isCustomProperty).toBe(true)
    })
  })
})
