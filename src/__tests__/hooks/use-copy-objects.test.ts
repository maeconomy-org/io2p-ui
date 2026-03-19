import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapAggregateToImportData,
  createParentChildStatements,
  copyFileReferences,
  fetchDescendants,
} from '@/hooks/api/use-copy-objects'

// ─── Mock data factories ────────────────────────────────────────────────────

function createMockAggregate(overrides: Record<string, any> = {}) {
  return {
    uuid: 'source-uuid-1',
    name: 'Test Object',
    abbreviation: 'TO',
    version: '1.0',
    description: 'A test object',
    properties: [
      {
        key: 'color',
        label: 'Color',
        type: 'string',
        softDeleted: false,
        values: [
          { value: 'red', valueTypeCast: 'string', sourceType: 'manual' },
        ],
        files: [],
      },
      {
        key: 'deleted-prop',
        label: 'Deleted',
        type: 'string',
        softDeleted: true,
        values: [],
        files: [],
      },
    ],
    files: [
      {
        fileName: 'doc.pdf',
        fileReference: 'https://storage.example.com/doc.pdf',
        label: 'Document',
        contentType: 'application/pdf',
        size: 1024,
        softDeleted: false,
      },
      {
        fileName: 'deleted.txt',
        fileReference: 'https://storage.example.com/deleted.txt',
        label: 'Deleted File',
        contentType: 'text/plain',
        size: 100,
        softDeleted: true,
      },
    ],
    address: {
      fullAddress: '123 Main St, City',
      street: 'Main St',
      houseNumber: '123',
      city: 'City',
      postalCode: '12345',
      country: 'NL',
      state: 'Province',
      district: undefined,
    },
    children: [],
    parents: [],
    ...overrides,
  }
}

function createMockClient() {
  return {
    node: {
      createStatement: vi.fn().mockResolvedValue({}),
      uploadFileByReference: vi.fn().mockResolvedValue({}),
      searchAggregates: vi.fn().mockResolvedValue({
        content: [],
        last: true,
      }),
    },
  }
}

// ─── mapAggregateToImportData ───────────────────────────────────────────────

describe('mapAggregateToImportData', () => {
  const baseOptions = {
    namePrefix: '',
    copyProperties: true,
    copyAddress: true,
  }

  it('should map basic object fields', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, baseOptions)

    expect(result.name).toBe('Test Object')
    expect(result.abbreviation).toBe('TO')
    expect(result.version).toBe('1.0')
    expect(result.description).toBe('A test object')
  })

  it('should NOT include parents in the payload', () => {
    const aggregate = createMockAggregate({
      parents: ['parent-uuid-1', 'parent-uuid-2'],
    })
    const result = mapAggregateToImportData(aggregate, baseOptions)

    expect(result.parents).toBeUndefined()
  })

  it('should NOT include files in the payload', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, baseOptions)

    expect(result.files).toBeUndefined()
  })

  it('should apply name prefix when provided', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      namePrefix: 'Copy of',
    })

    expect(result.name).toBe('Copy of Test Object')
  })

  it('should use original name when prefix is empty', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      namePrefix: '',
    })

    expect(result.name).toBe('Test Object')
  })

  it('should copy properties when enabled', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyProperties: true,
    })

    expect(result.properties).toBeDefined()
    expect(result.properties).toHaveLength(1) // soft-deleted filtered out
    expect(result.properties![0].key).toBe('color')
    expect(result.properties![0].values![0].value).toBe('red')
  })

  it('should filter out soft-deleted properties', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyProperties: true,
    })

    const keys = result.properties!.map((p: any) => p.key)
    expect(keys).not.toContain('deleted-prop')
  })

  it('should skip properties when disabled', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyProperties: false,
    })

    expect(result.properties).toBeUndefined()
  })

  it('should strip file attachments from property values', () => {
    const aggregate = createMockAggregate({
      properties: [
        {
          key: 'prop-with-files',
          label: 'Prop',
          type: 'string',
          softDeleted: false,
          values: [
            {
              value: 'test',
              valueTypeCast: 'string',
              files: [{ uuid: 'file-1', fileName: 'attached.pdf' }],
            },
          ],
          files: [{ uuid: 'file-2', fileName: 'prop-file.pdf' }],
        },
      ],
    })

    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyProperties: true,
    })

    expect(result.properties![0].values![0].files).toEqual([])
    expect(result.properties![0].files).toEqual([])
  })

  it('should copy address when enabled', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyAddress: true,
    })

    expect(result.address).toBeDefined()
    expect(result.address!.street).toBe('Main St')
    expect(result.address!.city).toBe('City')
    expect(result.address!.country).toBe('NL')
  })

  it('should skip address when disabled', () => {
    const aggregate = createMockAggregate()
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyAddress: false,
    })

    expect(result.address).toBeUndefined()
  })

  it('should skip address when aggregate has no address', () => {
    const aggregate = createMockAggregate({ address: null })
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyAddress: true,
    })

    expect(result.address).toBeUndefined()
  })

  it('should handle aggregate with no properties', () => {
    const aggregate = createMockAggregate({ properties: [] })
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      copyProperties: true,
    })

    expect(result.properties).toBeUndefined()
  })

  it('should handle aggregate with empty name', () => {
    const aggregate = createMockAggregate({ name: '' })
    const result = mapAggregateToImportData(aggregate, {
      ...baseOptions,
      namePrefix: 'Copy of',
    })

    expect(result.name).toBe('Copy of ')
  })

  it('should handle aggregate with null name', () => {
    const aggregate = createMockAggregate({ name: null })
    const result = mapAggregateToImportData(aggregate, baseOptions)

    expect(result.name).toBe('')
  })
})

// ─── createParentChildStatements ────────────────────────────────────────────

describe('createParentChildStatements', () => {
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
  })

  it('should create IS_PARENT_OF and IS_CHILD_OF statements', async () => {
    await createParentChildStatements(mockClient, 'parent-uuid', 'child-uuid')

    expect(mockClient.node.createStatement).toHaveBeenCalledTimes(2)

    expect(mockClient.node.createStatement).toHaveBeenCalledWith({
      subject: 'parent-uuid',
      predicate: 'IS_PARENT_OF',
      object: 'child-uuid',
    })

    expect(mockClient.node.createStatement).toHaveBeenCalledWith({
      subject: 'child-uuid',
      predicate: 'IS_CHILD_OF',
      object: 'parent-uuid',
    })
  })

  it('should call statements in order (parent first, child second)', async () => {
    const callOrder: string[] = []
    mockClient.node.createStatement.mockImplementation(async (stmt: any) => {
      callOrder.push(stmt.predicate)
      return {}
    })

    await createParentChildStatements(mockClient, 'parent-uuid', 'child-uuid')

    expect(callOrder).toEqual(['IS_PARENT_OF', 'IS_CHILD_OF'])
  })
})

// ─── copyFileReferences ─────────────────────────────────────────────────────

describe('copyFileReferences', () => {
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
  })

  it('should copy non-deleted files with references', async () => {
    const aggregate = createMockAggregate()

    await copyFileReferences(mockClient, aggregate, 'target-uuid')

    // Only 1 file — the soft-deleted one is filtered out
    expect(mockClient.node.uploadFileByReference).toHaveBeenCalledTimes(1)
    expect(mockClient.node.uploadFileByReference).toHaveBeenCalledWith({
      fileReference: 'https://storage.example.com/doc.pdf',
      uuidToAttach: 'target-uuid',
      fileName: 'doc.pdf',
      label: 'Document',
      contentType: 'application/pdf',
      size: 1024,
    })
  })

  it('should skip files without fileReference', async () => {
    const aggregate = createMockAggregate({
      files: [
        {
          fileName: 'no-ref.pdf',
          fileReference: null,
          softDeleted: false,
        },
      ],
    })

    await copyFileReferences(mockClient, aggregate, 'target-uuid')

    expect(mockClient.node.uploadFileByReference).not.toHaveBeenCalled()
  })

  it('should handle empty files array', async () => {
    const aggregate = createMockAggregate({ files: [] })

    await copyFileReferences(mockClient, aggregate, 'target-uuid')

    expect(mockClient.node.uploadFileByReference).not.toHaveBeenCalled()
  })

  it('should handle null files', async () => {
    const aggregate = createMockAggregate({ files: null })

    await copyFileReferences(mockClient, aggregate, 'target-uuid')

    expect(mockClient.node.uploadFileByReference).not.toHaveBeenCalled()
  })

  it('should continue on individual file copy failure', async () => {
    const aggregate = createMockAggregate({
      files: [
        {
          fileName: 'fail.pdf',
          fileReference: 'https://storage.example.com/fail.pdf',
          softDeleted: false,
        },
        {
          fileName: 'success.pdf',
          fileReference: 'https://storage.example.com/success.pdf',
          softDeleted: false,
        },
      ],
    })

    mockClient.node.uploadFileByReference
      .mockRejectedValueOnce(new Error('Upload failed'))
      .mockResolvedValueOnce({})

    await copyFileReferences(mockClient, aggregate, 'target-uuid')

    // Both were attempted
    expect(mockClient.node.uploadFileByReference).toHaveBeenCalledTimes(2)
  })
})

// ─── fetchDescendants ───────────────────────────────────────────────────────

describe('fetchDescendants', () => {
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
  })

  it('should return empty array when no children', async () => {
    mockClient.node.searchAggregates.mockResolvedValue({
      content: [],
      last: true,
    })

    const result = await fetchDescendants(mockClient, 'parent-uuid')

    expect(result).toEqual([])
    expect(mockClient.node.searchAggregates).toHaveBeenCalledWith({
      parentUUID: 'parent-uuid',
      hasParentUUIDFilter: true,
      page: 0,
      size: 50,
      searchBy: { softDeleted: false },
      accessFind: { readDefaultGroup: true },
    })
  })

  it('should return direct children', async () => {
    const child1 = createMockAggregate({
      uuid: 'child-1',
      name: 'Child 1',
      children: [],
    })
    const child2 = createMockAggregate({
      uuid: 'child-2',
      name: 'Child 2',
      children: [],
    })

    mockClient.node.searchAggregates.mockResolvedValue({
      content: [child1, child2],
      last: true,
    })

    const result = await fetchDescendants(mockClient, 'parent-uuid')

    expect(result).toHaveLength(2)
    expect(result[0].uuid).toBe('child-1')
    expect(result[1].uuid).toBe('child-2')
  })

  it('should recursively fetch grandchildren', async () => {
    const grandchild = createMockAggregate({
      uuid: 'grandchild-1',
      name: 'Grandchild 1',
      children: [],
    })
    const child = createMockAggregate({
      uuid: 'child-1',
      name: 'Child 1',
      children: [{ uuid: 'grandchild-1' }], // has children
    })

    // First call: parent's children
    mockClient.node.searchAggregates
      .mockResolvedValueOnce({
        content: [child],
        last: true,
      })
      // Second call: child's children (grandchildren)
      .mockResolvedValueOnce({
        content: [grandchild],
        last: true,
      })

    const result = await fetchDescendants(mockClient, 'parent-uuid')

    expect(result).toHaveLength(2)
    expect(result[0].uuid).toBe('child-1')
    expect(result[1].uuid).toBe('grandchild-1')
  })

  it('should handle pagination', async () => {
    const child1 = createMockAggregate({
      uuid: 'child-1',
      children: [],
    })
    const child2 = createMockAggregate({
      uuid: 'child-2',
      children: [],
    })

    // Page 0: not last
    mockClient.node.searchAggregates
      .mockResolvedValueOnce({
        content: [child1],
        last: false,
      })
      // Page 1: last
      .mockResolvedValueOnce({
        content: [child2],
        last: true,
      })

    const result = await fetchDescendants(mockClient, 'parent-uuid')

    expect(result).toHaveLength(2)
    expect(mockClient.node.searchAggregates).toHaveBeenCalledTimes(2)

    // Verify page numbers
    expect(mockClient.node.searchAggregates).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 0 })
    )
    expect(mockClient.node.searchAggregates).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 1 })
    )
  })

  it('should handle empty content response', async () => {
    mockClient.node.searchAggregates.mockResolvedValue({
      content: null,
      last: true,
    })

    const result = await fetchDescendants(mockClient, 'parent-uuid')

    expect(result).toEqual([])
  })
})
