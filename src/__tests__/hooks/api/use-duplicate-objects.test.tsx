import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createClient } from 'io2p-client'

const objects = {
  get: vi.fn(),
  create: vi.fn(),
  paginate: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({ useIomClient: () => ({ objects }) }))

import {
  useDuplicateObjects,
  DuplicateIntoOwnSubtreeError,
  DuplicatePartialError,
  DuplicateTooDeepError,
  DuplicateTooLargeError,
  MAX_DUPLICATE_DEPTH,
  MAX_DUPLICATE_OBJECTS,
} from '@/hooks/api/use-duplicate-objects'

/** An async generator over a fixed list, matching `client.objects.paginate`. */
function pageOf(ids: string[]) {
  return (async function* () {
    for (const id of ids) yield { id, name: id }
  })()
}

/**
 * A real SDK client over a fake node that answers like the real one: it counts a list up to 1,000
 * and answers 1001 above that, so `totalPages` is a lower limit.
 */
function cappedNode(rowsFor: (query: URLSearchParams) => string[]) {
  const fetch = async (input: string | URL) => {
    const url = new URL(String(input))
    const all = rowsFor(url.searchParams)
    const page = Number(url.searchParams.get('page') ?? 1)
    const size = Number(url.searchParams.get('size') ?? 20)
    const totalElements = all.length > 1000 ? 1001 : all.length
    const body = {
      data: all
        .slice((page - 1) * size, page * size)
        .map((id) => ({ id, name: id })),
      page: {
        number: page,
        size,
        totalElements,
        totalPages: Math.ceil(totalElements / size),
      },
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return createClient({
    baseUrl: 'http://node.test',
    getToken: async () => 'token',
    fetch: fetch as typeof globalThis.fetch,
  })
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
)

function render() {
  return renderHook(() => useDuplicateObjects(), { wrapper })
}

describe('useDuplicateObjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    objects.get.mockResolvedValue({ id: 'src', name: 'Room', parents: [] })
    objects.create.mockImplementation(async () => ({ id: 'copy-1' }))
    objects.paginate.mockImplementation(() => pageOf([]))
  })

  it('walks EVERY page of children, not just the first', async () => {
    // A single `list` capped the walk at 100, so copying a floor with 150 rooms
    // produced 100 and reported success. Only the SOURCE has children here —
    // a mock that answers the same list at every depth recurses to MAX_DEPTH
    // and allocates 150^10 objects.
    const many = Array.from({ length: 150 }, (_, i) => `child-${i}`)
    objects.paginate.mockImplementation(
      ({ parent }: { parent?: string; ancestor?: string }) =>
        parent === 'src' ? pageOf(many) : pageOf([])
    )

    const { result } = render()
    await act(async () => {
      await result.current.duplicateObjects({
        sourceIds: ['src'],
        targetParentIds: ['dest'],
        includeChildren: true,
      })
    })

    // 1 root copy + 150 children. A single page would have produced 101.
    expect(objects.create).toHaveBeenCalledTimes(151)
  })

  it('refuses a parent with 1,150 children as too large, and writes nothing', async () => {
    const many = Array.from({ length: 1150 }, (_, i) => `child-${i}`)
    const node = cappedNode((q) => (q.get('parent') === 'src' ? many : []))
    objects.paginate.mockImplementation((query) => node.objects.paginate(query))

    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['dest'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateTooLargeError)
    expect(objects.create).not.toHaveBeenCalled()
  })

  it('refuses a destination deep in a long child list (past several pages)', async () => {
    const children = Array.from({ length: 480 }, (_, i) =>
      i === 450 ? 'dest' : `d-${i}`
    )
    const node = cappedNode((q) => (q.get('parent') === 'src' ? children : []))
    objects.paginate.mockImplementation((query) => node.objects.paginate(query))

    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['dest'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateIntoOwnSubtreeError)
    expect(objects.create).not.toHaveBeenCalled()
  })

  it('refuses a destination inside the subtree being copied', async () => {
    objects.paginate.mockImplementation(({ parent }: { parent?: string }) =>
      parent === 'src'
        ? pageOf(['a', 'b'])
        : parent === 'b'
          ? pageOf(['dest'])
          : pageOf([])
    )

    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['dest'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateIntoOwnSubtreeError)
  })

  it('creates NOTHING when it refuses — the check runs before any write', async () => {
    // Discovering the cycle half-way would leave a partial subtree behind,
    // which is the state the guard exists to prevent.
    objects.paginate.mockImplementation(({ parent }: { parent?: string }) =>
      parent === 'src' ? pageOf(['dest']) : pageOf([])
    )

    const { result } = render()
    await act(async () => {
      await result.current
        .duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['dest'],
          includeChildren: true,
        })
        .catch(() => {})
    })

    expect(objects.create).not.toHaveBeenCalled()
  })

  /** The error `duplicateObjects` rejects with. */
  async function failure(
    params: Parameters<
      ReturnType<typeof useDuplicateObjects>['duplicateObjects']
    >[0]
  ) {
    const { result } = render()
    let caught: unknown
    await act(async () => {
      await result.current.duplicateObjects(params).catch((e) => {
        caught = e
      })
    })
    return caught
  }

  it('reports 0 created, with the cause, when the first write is refused', async () => {
    const refused = new Error('403')
    objects.create.mockRejectedValueOnce(refused)

    const error = await failure({
      sourceIds: ['src'],
      targetParentIds: ['dest'],
    })

    expect(error).toBeInstanceOf(DuplicatePartialError)
    expect((error as DuplicatePartialError).created).toBe(0)
    expect((error as DuplicatePartialError).cause).toBe(refused)
  })

  it('counts the copies already made when a later write fails', async () => {
    objects.create
      .mockResolvedValueOnce({ id: 'copy-1' })
      .mockRejectedValueOnce(new Error('403'))

    const error = await failure({
      sourceIds: ['src'],
      targetParentIds: ['dest-1', 'dest-2'],
    })

    expect((error as DuplicatePartialError).created).toBe(1)
  })

  it('refuses copying an object into itself', async () => {
    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['src'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateIntoOwnSubtreeError)
  })

  it('allows a descendant destination when children do NOT travel', async () => {
    // One flat object landing under a descendant is legal, if odd — there is no
    // subtree to bury inside itself.
    objects.paginate.mockImplementation(() => pageOf(['dest']))

    const { result } = render()
    await act(async () => {
      await result.current.duplicateObjects({
        sourceIds: ['src'],
        targetParentIds: ['dest'],
        includeChildren: false,
      })
    })

    expect(objects.create).toHaveBeenCalledTimes(1)
  })

  /** A chain `src` → `n1` → … → `n<levels>`: `levels` generations below the source. */
  function chain(levels: number) {
    objects.paginate.mockImplementation(({ parent }: { parent?: string }) => {
      const at = parent === 'src' ? 0 : Number(parent?.slice(1))
      return at < levels ? pageOf([`n${at + 1}`]) : pageOf([])
    })
  }

  it(`copies a tree exactly ${MAX_DUPLICATE_DEPTH} levels deep, all of it`, async () => {
    chain(MAX_DUPLICATE_DEPTH)
    const { result } = render()
    await act(async () => {
      await result.current.duplicateObjects({
        sourceIds: ['src'],
        targetParentIds: ['dest'],
        includeChildren: true,
      })
    })
    expect(objects.create).toHaveBeenCalledTimes(MAX_DUPLICATE_DEPTH + 1)
  })

  it('refuses a deeper tree before writing anything, instead of a silent partial copy', async () => {
    chain(MAX_DUPLICATE_DEPTH + 1)
    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['dest'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateTooDeepError)
    expect(objects.create).not.toHaveBeenCalled()
  })

  it('does not read the tree at all when children do not travel', async () => {
    chain(MAX_DUPLICATE_DEPTH + 5)
    const { result } = render()
    await act(async () => {
      await result.current.duplicateObjects({
        sourceIds: ['src'],
        targetParentIds: ['dest'],
        includeChildren: false,
      })
    })
    expect(objects.paginate).not.toHaveBeenCalled()
    expect(objects.create).toHaveBeenCalledTimes(1)
  })

  /** `src` with `n` direct children. */
  function children(n: number) {
    const ids = Array.from({ length: n }, (_, i) => `c-${i}`)
    objects.paginate.mockImplementation(({ parent }: { parent?: string }) =>
      parent === 'src' ? pageOf(ids) : pageOf([])
    )
  }

  it(`copies exactly ${MAX_DUPLICATE_OBJECTS} objects`, async () => {
    children(MAX_DUPLICATE_OBJECTS - 1)
    const { result } = render()
    await act(async () => {
      await result.current.duplicateObjects({
        sourceIds: ['src'],
        targetParentIds: ['dest'],
        includeChildren: true,
      })
    })
    expect(objects.create).toHaveBeenCalledTimes(MAX_DUPLICATE_OBJECTS)
  })

  it(`refuses ${MAX_DUPLICATE_OBJECTS + 1} objects before writing any`, async () => {
    children(MAX_DUPLICATE_OBJECTS)
    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['dest'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateTooLargeError)
    expect(objects.create).not.toHaveBeenCalled()
  })

  it('counts each destination: 250 objects into two parents is 500 copies', async () => {
    children(249)
    const { result } = render()
    await act(async () => {
      await result.current.duplicateObjects({
        sourceIds: ['src'],
        targetParentIds: ['dest-1', 'dest-2'],
        includeChildren: true,
      })
    })
    expect(objects.create).toHaveBeenCalledTimes(500)
  })

  it('refuses 251 objects into two parents (502 copies)', async () => {
    children(250)
    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['src'],
          targetParentIds: ['dest-1', 'dest-2'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateTooLargeError)
    expect(objects.create).not.toHaveBeenCalled()
  })

  /** Sources `a` and `b`, each with `n` direct children. */
  function twoTrees(n: number) {
    objects.paginate.mockImplementation(({ parent }: { parent?: string }) =>
      parent === 'a' || parent === 'b'
        ? pageOf(Array.from({ length: n }, (_, i) => `${parent}-${i}`))
        : pageOf([])
    )
  }

  it('shares one limit across all sources: two trees of 250 copy', async () => {
    twoTrees(249)
    const { result } = render()
    await act(async () => {
      await result.current.duplicateObjects({
        sourceIds: ['a', 'b'],
        targetParentIds: ['dest'],
        includeChildren: true,
      })
    })
    expect(objects.create).toHaveBeenCalledTimes(500)
  })

  it('shares one limit across all sources: two trees of 251 are refused', async () => {
    twoTrees(250)
    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['a', 'b'],
          targetParentIds: ['dest'],
          includeChildren: true,
        })
      })
    ).rejects.toThrow(DuplicateTooLargeError)
    expect(objects.create).not.toHaveBeenCalled()
  })

  it('refuses more than the limit without children too: 2 sources into 251 parents', async () => {
    const { result } = render()
    await expect(
      act(async () => {
        await result.current.duplicateObjects({
          sourceIds: ['a', 'b'],
          targetParentIds: Array.from({ length: 251 }, (_, i) => `dest-${i}`),
          includeChildren: false,
        })
      })
    ).rejects.toThrow(DuplicateTooLargeError)
    expect(objects.create).not.toHaveBeenCalled()
  })
})
