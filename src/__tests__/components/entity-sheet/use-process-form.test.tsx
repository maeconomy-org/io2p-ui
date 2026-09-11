import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ProcessDTO } from 'io2p-client'

import { useProcessForm } from '@/components/entity-sheet/hooks/use-process-form'

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ processes: { get: vi.fn() }, files: {} }),
}))
vi.mock('@/contexts/upload-queue-context', () => ({
  useOptionalUploadQueue: () => ({ enqueue: vi.fn() }),
}))
vi.mock('@/hooks/api/entities', () => ({
  useProcesses: () => ({
    useCreate: () => ({ mutateAsync: vi.fn() }),
    useUpdate: () => ({ mutateAsync: vi.fn() }),
  }),
}))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    children
  )
}

function process(over: Partial<ProcessDTO> = {}): ProcessDTO {
  return {
    id: 'p1',
    name: 'Real Name',
    description: 'desc',
    currentVersion: 1,
    properties: [],
    inputs: [],
    outputs: [],
    ...over,
  } as unknown as ProcessDTO
}

/**
 * Mounts a real input against `register`, the way MetadataFields does. The DOM node is what the
 * regression is about: the sheet opens in edit mode BEFORE the fetch resolves, so the field is
 * already registered when the process lands.
 */
function mountInput(
  form: ReturnType<typeof useProcessForm>['form'],
  name: 'name' | 'description'
) {
  const el = document.createElement('input')
  const field = form.register(name)
  el.name = field.name
  act(() => field.ref(el))
  // React wires `onChange` as a prop, so a bare DOM event would never reach the form.
  const type = (text: string) =>
    act(() => {
      el.value = text
      void field.onChange({ target: el, type: 'change' })
    })
  return { el, type }
}

describe('useProcessForm', () => {
  it('keeps an already-registered field alive when the process arrives late', () => {
    const { result, rerender } = renderHook(
      ({ p }: { p?: ProcessDTO }) => useProcessForm(p),
      { wrapper, initialProps: {} as { p?: ProcessDTO } }
    )

    const { el: name } = mountInput(result.current.form, 'name')
    expect(name.value).toBe('')

    rerender({ p: process() })

    // The load must reach the mounted input, not just the form's internal values — a reset that
    // drops `_fields` leaves this node blank and unable to dirty, which is the bug this pins.
    expect(name.value).toBe('Real Name')
    expect(result.current.form.getValues('name')).toBe('Real Name')
  })

  it('still reports a typed change after the late load', () => {
    const { result, rerender } = renderHook(
      ({ p }: { p?: ProcessDTO }) => useProcessForm(p),
      { wrapper, initialProps: {} as { p?: ProcessDTO } }
    )

    const description = mountInput(result.current.form, 'description')
    rerender({ p: process() })

    description.type('typed')

    expect(result.current.form.getValues('description')).toBe('typed')
    expect(result.current.form.formState.dirtyFields.description).toBe(true)
  })

  it('re-syncs when a different process is loaded', () => {
    const { result, rerender } = renderHook(
      ({ p }: { p?: ProcessDTO }) => useProcessForm(p),
      { wrapper, initialProps: { p: process() } as { p?: ProcessDTO } }
    )

    const { el: name } = mountInput(result.current.form, 'name')
    expect(name.value).toBe('Real Name')

    rerender({ p: process({ id: 'p2', name: 'Second' }) })

    expect(name.value).toBe('Second')
    expect(result.current.form.getValues('name')).toBe('Second')
  })

  it('does not discard a pending edit when the same version is refetched', () => {
    const { result, rerender } = renderHook(
      ({ p }: { p?: ProcessDTO }) => useProcessForm(p),
      { wrapper, initialProps: { p: process() } as { p?: ProcessDTO } }
    )

    const name = mountInput(result.current.form, 'name')
    name.type('Edited')

    // A background refetch hands back a fresh object with the same identity — an upload landing
    // does exactly this, and it must not overwrite what the user is typing.
    rerender({ p: process() })

    expect(result.current.form.getValues('name')).toBe('Edited')
  })
})
