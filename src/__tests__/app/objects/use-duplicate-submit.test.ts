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

import {
  DuplicateIntoOwnSubtreeError,
  DuplicateTooDeepError,
} from '@/hooks/api/use-duplicate-objects'
import { useDuplicateSubmit } from '@/app/objects/components/duplicate-objects/use-duplicate-submit'

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

  it('warns that some copies may exist after a failure part-way', async () => {
    duplicateObjects.mockRejectedValue(new Error('node down'))
    const { result } = renderHook(() => useDuplicateSubmit({ onDone: vi.fn() }))
    await act(() => result.current.submit(options))

    expect(toast.error).toHaveBeenCalledWith('objects.duplicate.failedPartial')
  })
})
