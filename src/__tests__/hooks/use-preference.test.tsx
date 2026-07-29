import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
  usePreference,
  keyFor,
  readBlob,
  resolve,
  writePreference,
} from '@/hooks/ui/use-preference'

const USER_A = 'user-a-uuid'
const USER_B = 'user-b-uuid'

let currentUUID: string | undefined = USER_A

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ userId: currentUUID }),
}))

describe('usePreference', () => {
  beforeEach(() => {
    localStorage.clear()
    currentUUID = USER_A
  })

  it('returns the hardcoded default when nothing is stored', () => {
    const { result } = renderHook(() => usePreference('objectsView'))
    expect(result.current[0]).toBe('table')
  })

  it('persists a set value and reads it back from the per-account blob', () => {
    const { result } = renderHook(() => usePreference('objectsView'))
    act(() => result.current[1]('columns'))

    expect(result.current[0]).toBe('columns')
    const raw = localStorage.getItem(keyFor(USER_A))
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual({ objectsView: 'columns' })
  })

  it('merges multiple keys into a single account blob', () => {
    const objects = renderHook(() => usePreference('objectsView'))
    const processes = renderHook(() => usePreference('processView'))

    act(() => objects.result.current[1]('columns'))
    act(() => processes.result.current[1]('sankey'))

    expect(JSON.parse(localStorage.getItem(keyFor(USER_A)) as string)).toEqual({
      objectsView: 'columns',
      processView: 'sankey',
    })
  })

  it('falls back to the default when the stored value is not allowed', () => {
    localStorage.setItem(
      keyFor(USER_A),
      JSON.stringify({ objectsView: 'bogus' })
    )
    const { result } = renderHook(() => usePreference('objectsView'))
    expect(result.current[0]).toBe('table')
  })

  it('falls back to the default when the blob is unparseable', () => {
    localStorage.setItem(keyFor(USER_A), '{not-json')
    const { result } = renderHook(() => usePreference('processView'))
    expect(result.current[0]).toBe('table')
  })

  it('isolates preferences per account', () => {
    const { result, rerender } = renderHook(() => usePreference('objectsView'))
    act(() => result.current[1]('columns'))
    expect(result.current[0]).toBe('columns')

    // Different account on the same machine sees defaults, not A's choice.
    currentUUID = USER_B
    rerender()
    expect(result.current[0]).toBe('table')

    // Switching back restores A's preference.
    currentUUID = USER_A
    rerender()
    expect(result.current[0]).toBe('columns')
  })

  it('reflects an external write in the same tab (notify)', () => {
    const { result } = renderHook(() => usePreference('propertiesView'))
    expect(result.current[0]).toBe('detailed')

    act(() => writePreference(USER_A, 'propertiesView', 'grid'))
    expect(result.current[0]).toBe('grid')
  })

  it('reflects a cross-tab write via the storage event', () => {
    const { result } = renderHook(() => usePreference('objectsView'))
    expect(result.current[0]).toBe('table')

    act(() => {
      localStorage.setItem(
        keyFor(USER_A),
        JSON.stringify({ objectsView: 'columns' })
      )
      window.dispatchEvent(new StorageEvent('storage', { key: keyFor(USER_A) }))
    })

    expect(result.current[0]).toBe('columns')
  })

  it('returns the default and does not persist when userUUID is undefined', () => {
    currentUUID = undefined
    const { result } = renderHook(() => usePreference('objectsView'))
    expect(result.current[0]).toBe('table')

    act(() => result.current[1]('columns'))

    expect(result.current[0]).toBe('table')
    expect(localStorage.length).toBe(0)
  })

  describe('pure helpers', () => {
    it('resolve validates the stored value and falls back to the default', () => {
      expect(resolve(USER_A, 'objectsView')).toBe('table')
      writePreference(USER_A, 'objectsView', 'columns')
      expect(resolve(USER_A, 'objectsView')).toBe('columns')
      expect(resolve(undefined, 'objectsView')).toBe('table')
    })

    it('readBlob returns {} for a missing or corrupt blob', () => {
      expect(readBlob(USER_A)).toEqual({})
      localStorage.setItem(keyFor(USER_A), 'not-json')
      expect(readBlob(USER_A)).toEqual({})
    })
  })
})
