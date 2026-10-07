import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ParentSelector } from '@/app/objects/components/duplicate-objects/components/parent-selector'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const rows = [
  { id: 'read-1', name: 'Read Box', permission: 'read' },
  { id: 'write-1', name: 'Write Box', permission: 'write' },
]

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    objects: { list: async () => ({ data: rows }) },
  }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

vi.mock('@/components/entity-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/entity-list')>()),
  OwnerHint: () => null,
}))

vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

const itemFor = async (name: string) =>
  (await screen.findAllByText(name))
    .map((el) => el.closest('[cmdk-item]'))
    .find(Boolean) as HTMLElement

const open = (initialParentUuids?: string[]) => {
  const onParentsChange = vi.fn()
  render(
    <ParentSelector
      allowInlineCreate={false}
      maxSelections={1}
      initialParentUuids={initialParentUuids}
      onParentsChange={onParentsChange}
    />
  )
  fireEvent.click(screen.getByRole('combobox'))
  return onParentsChange
}

describe('ParentSelector rows the viewer cannot copy into', () => {
  it('shows a read-only row as unavailable, with the reason and a note', async () => {
    open()

    const row = await itemFor('Read Box')
    expect(row).toHaveAttribute('aria-disabled', 'true')
    expect(row).toHaveTextContent('objects.needsWriteAccess')
    expect(screen.getByTestId('parent-selector-view-only')).toBeInTheDocument()
  })

  it('does not choose a read-only row', async () => {
    const onParentsChange = open()
    fireEvent.click(await itemFor('Read Box'))

    expect(onParentsChange).not.toHaveBeenCalled()
  })

  it('chooses a row the viewer may write', async () => {
    const onParentsChange = open()
    fireEvent.click(await itemFor('Write Box'))

    expect(onParentsChange).toHaveBeenCalledWith(['write-1'])
  })

  it('lets a selected read-only row be unselected', async () => {
    open(['read-1'])

    expect(await itemFor('Read Box')).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })
})
