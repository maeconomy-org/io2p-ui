import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TemplateSelector } from '@/components/entity-sheet/fields'

const list = vi.fn()

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ templates: { list } }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const PRESET = {
  id: 'tpl-1',
  name: 'Concrete wall',
  type: 'process' as const,
  system: false,
  currentVersion: 1,
  createdAt: 1719230000000,
  updatedAt: 1719230000000,
  createdBy: 'u1',
  deleted: false,
  properties: [
    { key: 'weight', values: [{ data: '100 kg' }] },
    { key: 'volume', values: [{ data: '2 m3' }] },
  ],
  inputs: [{ ref: 'obj-a', properties: [{ key: 'quantity' }] }],
  outputs: [{ properties: [{ key: 'quantity' }] }],
}

function renderSelector(props: Record<string, unknown> = {}) {
  const onSelect = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(TemplateSelector, {
        onSelect,
        selected: null,
        ...props,
      })
    )
  )
  return { ...view, onSelect }
}

/**
 * The list only fires once the popover opens. Waits on the OPTION rather than the name: with a
 * template already selected the trigger shows that same text, so a text query would match the
 * closed trigger and never wait for the list at all.
 */
async function open() {
  fireEvent.click(screen.getByRole('combobox'))
  return screen.findByRole('option')
}

describe('TemplateSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({
      data: [PRESET],
      page: { number: 1, size: 8, totalElements: 1, totalPages: 1 },
    })
  })

  // THE REGRESSION. A templates list row is lean: no `properties`, and no `inputs`/`outputs` at all.
  // Without `full: true` a pick prefills the name and nothing else, with no error anywhere.
  it('asks for the full preset, not a lean row', async () => {
    renderSelector()
    await open()

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ full: true, size: 8, page: 1 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('hands the whole preset to the caller — properties and both flow bags', async () => {
    const { onSelect } = renderSelector()
    await open()
    fireEvent.click(screen.getByRole('option'))

    const choice = onSelect.mock.calls[0][0]
    expect(choice.properties).toHaveLength(2)
    // The flows are what a process template exists for; they vanish first on a lean row.
    expect(choice.inputs).toHaveLength(1)
    expect(choice.outputs).toHaveLength(1)
    // A preset value carries its formula recipe, not just text.
    expect(choice.properties[0].values[0].data).toBe('100 kg')
  })

  it('forwards the kind so an object create is not offered process templates', async () => {
    renderSelector({ type: 'process' })
    await open()

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'process' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('counts the preset properties on the row', async () => {
    renderSelector()
    await open()

    expect(
      screen.getByText('objects.templateSelector.propertyCount:{"count":2}')
    ).toBeTruthy()
  })

  it('clears the choice when the selected template is picked again', async () => {
    const { onSelect } = renderSelector({
      selected: { id: 'tpl-1', name: 'Concrete wall' },
    })
    await open()
    fireEvent.click(screen.getByRole('option'))

    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
