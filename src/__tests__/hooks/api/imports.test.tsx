import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useRunImport } from '@/hooks/api/imports'
import {
  ImportWatchProvider,
  useOptionalImportWatch,
} from '@/contexts/import-watch-context'
import { ImportWatchers } from '@/components/shell/import-watchers'
import { queryKeys } from '@/lib/query-keys'

const imports = {
  create: vi.fn(),
  stage: vi.fn(),
  validate: vi.fn(),
  start: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ imports }),
}))

const JOB = { id: 'j1', status: 'queued', total: 1, ok: 0 }

function primeHappyPath() {
  imports.create.mockResolvedValue({ id: 'j1' })
  imports.stage.mockResolvedValue(undefined)
  imports.validate.mockResolvedValue({ ok: true, problems: [] })
  imports.start.mockResolvedValue(JOB)
  imports.get.mockResolvedValue(JOB)
  imports.cancel.mockResolvedValue({ ...JOB, status: 'cancelled' })
}

// Published from an effect: assigning a module binding during render is a render side effect.
const watched = { ids: [] as readonly string[] }
function Probe() {
  const ids = useOptionalImportWatch()?.jobIds
  React.useEffect(() => {
    watched.ids = ids ?? []
  }, [ids])
  return null
}

/** Stands in for `/import`: unmounts when the user navigates away. */
const page = { start: () => {} }
function Page() {
  const run = useRunImport()
  React.useEffect(() => {
    page.start = () => run.mutate({ items: [], filename: 'sheet.xlsx' })
  }, [run])
  return null
}

describe('import watching', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    watched.ids = []
    primeHappyPath()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    queryClient.clear()
  })

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ImportWatchProvider>
          {children}
          <ImportWatchers />
          <Probe />
        </ImportWatchProvider>
      </QueryClientProvider>
    )
  }

  it('registers a started job with the watcher', async () => {
    const { result } = renderHook(() => useRunImport(), { wrapper })

    await act(async () => {
      result.current.mutate({ items: [], filename: 'sheet.xlsx' })
    })

    await waitFor(() => expect(watched.ids).toEqual(['j1']))
  })

  it('does not watch a run the dry-run refused', async () => {
    // Nothing was handed over, so there is no job to poll — and the draft it left behind is
    // retired by the wizard rather than followed to a terminal status that never comes.
    imports.validate.mockResolvedValue({
      ok: false,
      problems: [{ seq: 0, message: 'no such parent' }],
    })
    const { result } = renderHook(() => useRunImport(), { wrapper })

    await act(async () => {
      result.current.mutate({ items: [], filename: 'sheet.xlsx' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(imports.start).not.toHaveBeenCalled()
    expect(watched.ids).toEqual([])
  })

  it('invalidates the objects list after the import page has unmounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    const view = render(<Page />, { wrapper })

    await act(async () => {
      page.start()
    })
    await waitFor(() => expect(watched.ids).toEqual(['j1']))

    // Navigate away: the page goes, the provider above the router stays.
    view.rerender(<></>)

    imports.get.mockResolvedValue({ ...JOB, status: 'completed', ok: 1 })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.objects.all,
      })
    )
  })

  it('stops watching a job once it settles, so the set stays bounded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() => useRunImport(), { wrapper })

    await act(async () => {
      result.current.mutate({ items: [], filename: 'sheet.xlsx' })
    })
    await waitFor(() => expect(watched.ids).toEqual(['j1']))

    imports.get.mockResolvedValue({ ...JOB, status: 'completed', ok: 1 })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await waitFor(() => expect(watched.ids).toEqual([]))
  })
})
