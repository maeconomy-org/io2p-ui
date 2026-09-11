import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PreconditionFailedError, type TemplateDTO } from 'io2p-client'

import { useTemplateForm } from '@/components/entity-sheet/hooks/use-template-form'

const templates = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  restore: vi.fn(),
}
const files = { upload: vi.fn(), uploadAll: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ templates, files }),
}))

const enqueue = vi.fn()
vi.mock('@/contexts/upload-queue-context', () => ({
  useOptionalUploadQueue: () => ({ enqueue }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function template(over: Partial<TemplateDTO> = {}): TemplateDTO {
  return {
    id: 'tpl-1',
    type: 'object',
    name: 'Wall',
    version: '1.0',
    system: false,
    currentVersion: 3,
    properties: [],
    ...over,
  } as unknown as TemplateDTO
}

describe('useTemplateForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a template from an empty draft', async () => {
    templates.create.mockResolvedValue(template({ id: 'tpl-new' }))
    const onSaved = vi.fn()
    const { result } = renderHook(() => useTemplateForm(null, { onSaved }), {
      wrapper: makeWrapper(),
    })

    act(() => result.current.form.setValue('name', 'New Template'))
    await act(async () => {
      await result.current.submit()
    })

    expect(templates.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'object', name: 'New Template' }),
      undefined
    )
    expect(onSaved).toHaveBeenCalledWith('tpl-new')
  })

  it('refuses a nameless template rather than saving one', async () => {
    const { result } = renderHook(() => useTemplateForm(null), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(templates.create).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('templates.nameRequired')
  })

  // Templates replace rather than diff, so an unchanged save must send nothing at all — a body of
  // `{}` would still be a full replacement of every collection it names.
  it('sends no request when nothing changed', async () => {
    const onSaved = vi.fn()
    const { result } = renderHook(
      () => useTemplateForm(template(), { onSaved }),
      { wrapper: makeWrapper() }
    )

    await act(async () => {
      await result.current.submit()
    })

    expect(templates.update).not.toHaveBeenCalled()
    // Still a successful save from the user's point of view — the sheet leaves edit mode.
    expect(onSaved).toHaveBeenCalledWith('tpl-1')
  })

  it('patches only what changed', async () => {
    templates.update.mockResolvedValue(template({ name: 'Renamed' }))
    const { result } = renderHook(() => useTemplateForm(template()), {
      wrapper: makeWrapper(),
    })

    act(() =>
      result.current.form.setValue('name', 'Renamed', { shouldDirty: true })
    )
    await act(async () => {
      await result.current.submit()
    })

    expect(templates.update).toHaveBeenCalledWith('tpl-1', { name: 'Renamed' })
  })

  // io2p cannot make a template an upload target, so there is no post-save attach phase at all —
  // nothing may reach the background queue from here.
  it('never enqueues an upload', async () => {
    templates.create.mockResolvedValue(template({ id: 'tpl-new' }))
    const { result } = renderHook(() => useTemplateForm(null), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.form.setValue('name', 'T')
      result.current.form.setValue('properties', [
        {
          key: 'spec',
          values: [
            {
              data: 'v',
              files: [
                {
                  _localId: 'l1',
                  kind: 'upload' as const,
                  blob: new File(['x'], 'a.pdf'),
                },
              ],
            },
          ],
        },
      ])
    })
    await act(async () => {
      await result.current.submit()
    })

    expect(enqueue).not.toHaveBeenCalled()
    expect(files.upload).not.toHaveBeenCalled()
    expect(templates.get).not.toHaveBeenCalled()
  })

  it('keeps the draft dirty and does not call onSaved when the write fails', async () => {
    templates.update.mockRejectedValue(
      new PreconditionFailedError({
        type: 'about:blank',
        title: 'Precondition Failed',
        status: 412,
      })
    )
    const onSaved = vi.fn()
    const { result } = renderHook(
      () => {
        const r = useTemplateForm(template(), { onSaved })
        // RHF's formState is a proxy that only tracks fields read during render, exactly as
        // TemplateSheet reads them — without this the hook never subscribes to isDirty.
        void r.form.formState.isDirty
        return r
      },
      { wrapper: makeWrapper() }
    )

    act(() =>
      result.current.form.setValue('name', 'Renamed', { shouldDirty: true })
    )
    await act(async () => {
      await result.current.submit()
    })

    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.form.formState.isDirty).toBe(true)
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('does not reject, so submit cannot leave an unhandled rejection', async () => {
    templates.update.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useTemplateForm(template()), {
      wrapper: makeWrapper(),
    })

    act(() =>
      result.current.form.setValue('name', 'Renamed', { shouldDirty: true })
    )
    await expect(result.current.submit()).resolves.toBeUndefined()
  })
})
