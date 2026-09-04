import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const objects = {
  get: vi.fn(),
  create: vi.fn(),
  paginate: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({ useIomClient: () => ({ objects }) }))

import {
  useDuplicateObjects,
  DuplicateIntoOwnSubtreeError,
} from '@/hooks/api/use-duplicate-objects'

/** An async generator over a fixed list, matching `client.objects.paginate`. */
function pageOf(ids: string[]) {
  return (async function* () {
    for (const id of ids) yield { id, name: id }
  })()
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

  it('refuses a destination inside the subtree being copied', async () => {
    objects.paginate.mockImplementation(() => pageOf(['a', 'dest', 'b']))

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
    objects.paginate.mockImplementation(() => pageOf(['dest']))

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
})
