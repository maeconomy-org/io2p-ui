import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useObjectProcesses } from '@/hooks/process/use-object-processes'

// Mock dependencies
const mockUseObjectRelationships = vi.fn()
const mockUseObjectsByUUIDs = vi.fn()

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useStatements: () => ({
      useObjectRelationships: mockUseObjectRelationships,
    }),
    useObjects: () => ({
      useObjectsByUUIDs: mockUseObjectsByUUIDs,
    }),
  }
})

describe('useObjectProcesses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty arrays when no data is available', () => {
    mockUseObjectRelationships.mockReturnValue({ data: null, isLoading: false })
    mockUseObjectsByUUIDs.mockReturnValue({ data: null, isLoading: false })

    const { result } = renderHook(() =>
      useObjectProcesses({ objectUuid: 'test-uuid' })
    )

    expect(result.current.createdBy).toEqual([])
    expect(result.current.usedIn).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('should transform relationships and resolve names', () => {
    const objectUuid = 'obj-1'
    const relationships = {
      asSubject: [
        {
          subject: 'obj-1',
          object: 'obj-2',
          properties: [
            { key: 'processName', values: [{ value: 'Process A' }] },
            { key: 'quantity', values: [{ value: '10' }] },
            { key: 'unit', values: [{ value: 'kg' }] },
          ],
        },
      ],
      asObject: [
        {
          subject: 'obj-3',
          object: 'obj-1',
          properties: [
            { key: 'processName', values: [{ value: 'Process B' }] },
            { key: 'quantity', values: [{ value: '5' }] },
            { key: 'unit', values: [{ value: 'm' }] },
          ],
        },
      ],
    }

    const objects = [
      { uuid: 'obj-1', name: 'Original Object' },
      { uuid: 'obj-2', name: 'Output Object' },
      { uuid: 'obj-3', name: 'Input Object' },
    ]

    mockUseObjectRelationships.mockReturnValue({
      data: relationships,
      isLoading: false,
    })
    mockUseObjectsByUUIDs.mockReturnValue({ data: objects, isLoading: false })

    const { result } = renderHook(() => useObjectProcesses({ objectUuid }))

    // usedIn (asSubject)
    expect(result.current.usedIn).toHaveLength(1)
    expect(result.current.usedIn[0]).toEqual({
      processName: 'Process A',
      quantity: 10,
      unit: 'kg',
      inputObjectUuid: 'obj-1',
      inputObjectName: 'Original Object',
      outputObjectUuid: 'obj-2',
      outputObjectName: 'Output Object',
    })

    // createdBy (asObject)
    expect(result.current.createdBy).toHaveLength(1)
    expect(result.current.createdBy[0]).toEqual({
      processName: 'Process B',
      quantity: 5,
      unit: 'm',
      inputObjectUuid: 'obj-3',
      inputObjectName: 'Input Object',
      outputObjectUuid: 'obj-1',
      outputObjectName: 'Original Object',
    })
  })

  it('should filter out relationships without processName', () => {
    const relationships = {
      asSubject: [
        {
          subject: 'obj-1',
          object: 'obj-2',
          properties: [{ key: 'quantity', values: [{ value: '10' }] }], // No processName
        },
      ],
      asObject: [],
    }

    mockUseObjectRelationships.mockReturnValue({
      data: relationships,
      isLoading: false,
    })
    mockUseObjectsByUUIDs.mockReturnValue({ data: [], isLoading: false })

    const { result } = renderHook(() =>
      useObjectProcesses({ objectUuid: 'obj-1' })
    )

    expect(result.current.usedIn).toHaveLength(0)
  })

  it('should handle loading state', () => {
    mockUseObjectRelationships.mockReturnValue({ data: null, isLoading: true })
    mockUseObjectsByUUIDs.mockReturnValue({ data: null, isLoading: false })

    const { result } = renderHook(() =>
      useObjectProcesses({ objectUuid: 'obj-1' })
    )

    expect(result.current.isLoading).toBe(true)
  })
})
