import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useEntityLifecycle } from '@/components/entity-sheet/hooks/use-entity-lifecycle'

const toastError = vi.fn()
const loggerError = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }))

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
  },
}))

type Mutate = (variables: { id: string }) => Promise<unknown>

/** A typed mutation stub; resolves by default, or rejects when given a failing impl. */
const mutate = (impl: Mutate = async () => ({})) => vi.fn(impl)

function makeResource(
  remove: Mutate,
  restore: Mutate,
  pending = { remove: false, restore: false }
) {
  return {
    useRemove: () => ({ mutateAsync: remove, isPending: pending.remove }),
    useRestore: () => ({ mutateAsync: restore, isPending: pending.restore }),
  }
}

describe('useEntityLifecycle', () => {
  beforeEach(() => {
    toastError.mockClear()
    loggerError.mockClear()
  })

  it('deletes by id and runs onDone', async () => {
    const remove = mutate()
    const restore = mutate()
    const onDone = vi.fn()
    const { result } = renderHook(() =>
      useEntityLifecycle(makeResource(remove, restore), 'Object', onDone)
    )

    await act(() => result.current.run('delete', 'obj-1'))

    expect(remove).toHaveBeenCalledWith({ id: 'obj-1' })
    expect(restore).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('restores by id and runs onDone', async () => {
    const remove = mutate()
    const restore = mutate()
    const onDone = vi.fn()
    const { result } = renderHook(() =>
      useEntityLifecycle(makeResource(remove, restore), 'Object', onDone)
    )

    await act(() => result.current.run('restore', 'obj-1'))

    expect(restore).toHaveBeenCalledWith({ id: 'obj-1' })
    expect(remove).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  // A failure that still ran onDone would drop the sheet back to view mode and read as success.
  it('toasts and does NOT run onDone when the mutation rejects', async () => {
    const remove = mutate(() => Promise.reject(new Error('boom')))
    const onDone = vi.fn()
    const { result } = renderHook(() =>
      useEntityLifecycle(makeResource(remove, mutate()), 'Object', onDone)
    )

    await act(() => result.current.run('delete', 'obj-1'))

    expect(onDone).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(loggerError).toHaveBeenCalledWith(
      'Object delete failed',
      expect.objectContaining({ entityId: 'obj-1' })
    )
  })

  it('never rejects, so a click handler cannot leave an unhandled rejection', async () => {
    const remove = mutate(() => Promise.reject(new Error('boom')))
    const { result } = renderHook(() =>
      useEntityLifecycle(makeResource(remove, mutate()), 'Object')
    )

    await expect(result.current.run('delete', 'obj-1')).resolves.toBeUndefined()
  })

  it('labels the log line with the entity kind', async () => {
    const restore = mutate(() => Promise.reject(new Error('nope')))
    const { result } = renderHook(() =>
      useEntityLifecycle(makeResource(mutate(), restore), 'Template')
    )

    await act(() => result.current.run('restore', 'tpl-9'))

    expect(loggerError).toHaveBeenCalledWith(
      'Template restore failed',
      expect.objectContaining({ entityId: 'tpl-9' })
    )
  })

  it('reports busy while either mutation is pending', () => {
    const idle = renderHook(() =>
      useEntityLifecycle(makeResource(mutate(), mutate()), 'Object')
    )
    expect(idle.result.current.isBusy).toBe(false)

    const deleting = renderHook(() =>
      useEntityLifecycle(
        makeResource(mutate(), mutate(), { remove: true, restore: false }),
        'Object'
      )
    )
    expect(deleting.result.current.isBusy).toBe(true)

    const restoring = renderHook(() =>
      useEntityLifecycle(
        makeResource(mutate(), mutate(), { remove: false, restore: true }),
        'Object'
      )
    )
    expect(restoring.result.current.isBusy).toBe(true)
  })
})
