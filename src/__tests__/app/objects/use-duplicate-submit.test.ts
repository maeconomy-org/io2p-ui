import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const duplicateObjects = vi.fn()
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/hooks/api/use-duplicate-objects', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/hooks/api/use-duplicate-objects')
  >()),
  useDuplicateObjects: () => ({ duplicateObjects, isDuplicating: false }),
}))

import { ForbiddenError, ValidationError } from 'io2p-client'

import {
  DuplicateIntoOwnSubtreeError,
  DuplicateWriteError,
  DuplicateTooDeepError,
  DuplicateTooLargeError,
} from '@/hooks/api/use-duplicate-objects'
import { useDuplicateSubmit } from '@/app/objects/components/duplicate-objects/use-duplicate-submit'

function problem(status: number, detail?: string) {
  return { type: 'about:blank', title: 'Error', status, detail }
}

const options = {
  sourceObjects: [{ uuid: 'a', name: 'A' }],
  targetParentUuids: ['p'],
  namePrefix: 'Copy of ',
  includeChildren: true,
  copyProperties: true,
  copyFiles: false,
  copyAddress: false,
}

describe('useDuplicateSubmit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('copies with the sheet options and closes on success', async () => {
    const onDone = vi.fn()
    const { result } = renderHook(() => useDuplicateSubmit({ onDone }))
    await act(() => result.current.submit(options))

    expect(duplicateObjects).toHaveBeenCalledWith({
      sourceIds: ['a'],
      targetParentIds: ['p'],
      namePrefix: 'Copy of ',
      includeChildren: true,
      copyProperties: true,
      copyFiles: false,
      copyAddress: false,
    })
    expect(toast.success).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('hands the options to a caller onConfirm instead of copying', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDuplicateSubmit({ onConfirm, isCopying: true, onDone: vi.fn() })
    )
    await act(() => result.current.submit(options))

    expect(onConfirm).toHaveBeenCalledWith(options)
    expect(duplicateObjects).not.toHaveBeenCalled()
    expect(result.current.isCopying).toBe(true)
  })

  it('names a target inside the source, and stays open', async () => {
    duplicateObjects.mockRejectedValue(new DuplicateIntoOwnSubtreeError())
    const onDone = vi.fn()
    const { result } = renderHook(() => useDuplicateSubmit({ onDone }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith(
      'objects.duplicate.targetInsideSource'
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('says nothing was copied when the tree is too deep, and stays open', async () => {
    duplicateObjects.mockRejectedValue(new DuplicateTooDeepError())
    const onDone = vi.fn()
    const { result } = renderHook(() => useDuplicateSubmit({ onDone }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith('objects.duplicate.tooDeep')
    expect(toast.error).not.toHaveBeenCalledWith(
      'objects.duplicate.failedPartial'
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('says nothing was copied when the copy is too large, and stays open', async () => {
    duplicateObjects.mockRejectedValue(new DuplicateTooLargeError())
    const onDone = vi.fn()
    const { result } = renderHook(() => useDuplicateSubmit({ onDone }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith('objects.duplicate.tooLarge')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('warns that some copies may exist after a failure part-way', async () => {
    duplicateObjects.mockRejectedValue(
      new DuplicateWriteError(2, new Error('node down'))
    )
    const onDone = vi.fn()
    const { result } = renderHook(() => useDuplicateSubmit({ onDone }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith('objects.duplicate.failedPartial')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('gives the real reason when the first write is refused, not "some may exist"', async () => {
    duplicateObjects.mockRejectedValue(
      new DuplicateWriteError(0, new ForbiddenError(problem(403)))
    )
    const onDone = vi.fn()
    const { result } = renderHook(() => useDuplicateSubmit({ onDone }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith('objects.permissionDenied')
    expect(toast.error).not.toHaveBeenCalledWith(
      'objects.duplicate.failedPartial'
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  // A timeout can land after the node committed the create, so "nothing was copied" is not known.
  it('keeps the part-way warning when the first write fails without an answer', async () => {
    duplicateObjects.mockRejectedValue(
      new DuplicateWriteError(0, new Error('network down'))
    )
    const { result } = renderHook(() => useDuplicateSubmit({ onDone: vi.fn() }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith('objects.duplicate.failedPartial')
  })

  it('names a validation refusal on the first write', async () => {
    duplicateObjects.mockRejectedValue(
      new DuplicateWriteError(0, new ValidationError(problem(422, 'bad')))
    )
    const { result } = renderHook(() => useDuplicateSubmit({ onDone: vi.fn() }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith('objects.saveError.invalid')
  })

  const leave = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }

  it('asks before the tab closes while a copy runs, and not after', () => {
    const { rerender } = renderHook(
      ({ isCopying }) => useDuplicateSubmit({ isCopying, onDone: vi.fn() }),
      { initialProps: { isCopying: true } }
    )
    expect(leave()).toBe(true)

    rerender({ isCopying: false })
    expect(leave()).toBe(false)
  })
})
