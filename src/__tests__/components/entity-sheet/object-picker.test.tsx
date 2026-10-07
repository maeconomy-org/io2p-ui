import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ObjectPicker } from '@/components/entity-sheet/fields/object-picker'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const rows = [
  { id: 'read-1', name: 'Read Box', permission: 'read' },
  { id: 'write-1', name: 'Write Box', permission: 'write' },
]

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({
    useList: () => ({
      data: { data: rows, page: { totalElements: rows.length } },
      isFetching: false,
    }),
  }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

vi.mock('@/components/entity-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/entity-list')>()),
  OwnerHint: () => null,
}))

const open = (onSelect = vi.fn(), requireLinkable?: boolean) => {
  render(
    <ObjectPicker
      value=""
      onSelect={onSelect}
      requireLinkable={requireLinkable}
    />
  )
  fireEvent.click(screen.getByTestId('object-picker'))
  return onSelect
}

describe('ObjectPicker with requireLinkable', () => {
  it('shows a read-only row as unavailable, with the reason and a note', () => {
    open(vi.fn(), true)

    const row = screen.getByTestId('object-option-read-1')
    expect(row).toHaveAttribute('aria-disabled', 'true')
    expect(row).toHaveTextContent('objects.needsWriteAccess')
    expect(screen.getByTestId('object-picker-view-only')).toBeInTheDocument()
  })

  it('does not pick a read-only row', () => {
    const onSelect = open(vi.fn(), true)
    fireEvent.click(screen.getByTestId('object-option-read-1'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('picks a row the viewer may write', () => {
    const onSelect = open(vi.fn(), true)
    fireEvent.click(screen.getByTestId('object-option-write-1'))

    expect(onSelect).toHaveBeenCalledWith('write-1', 'Write Box')
  })
})

describe('ObjectPicker without requireLinkable', () => {
  it('still offers a read-only row, as a process flow needs', () => {
    const onSelect = open()

    const row = screen.getByTestId('object-option-read-1')
    expect(row).not.toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByTestId('object-picker-view-only')).toBeNull()
    fireEvent.click(row)
    expect(onSelect).toHaveBeenCalledWith('read-1', 'Read Box')
  })
})
