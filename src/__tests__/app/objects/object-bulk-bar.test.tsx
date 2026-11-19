import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ObjectListItem } from 'io2p-client'

import { ObjectBulkBar } from '@/app/objects/components/object-bulk-bar'
import type { ObjectListPageState } from '@/app/objects/components/use-object-list-page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const row = (id: string) => ({ id, name: `Object ${id}` }) as ObjectListItem

const stateWith = (
  selected: ObjectListItem[],
  movable: ObjectListItem[]
): ObjectListPageState =>
  ({
    selectedObjects: selected,
    movableObjects: movable,
    shareableObjects: [],
    canDeleteSelection: false,
    anySelectedDeleted: false,
    isBusy: false,
    clearSelection: vi.fn(),
    setConfirmBulkDelete: vi.fn(),
    runBulkRestore: vi.fn(),
    setShareBundleOpen: vi.fn(),
    setBulkParentOpen: vi.fn(),
  }) as unknown as ObjectListPageState

describe('ObjectBulkBar Set parent', () => {
  it('is not offered when no selected object can move', () => {
    render(<ObjectBulkBar state={stateWith([row('a'), row('b')], [])} />)

    expect(screen.queryByTestId('bulk-set-parent')).toBeNull()
  })

  it('is offered when a selected object can move', () => {
    render(
      <ObjectBulkBar state={stateWith([row('a'), row('b')], [row('a')])} />
    )

    expect(screen.getByTestId('bulk-set-parent')).toBeInTheDocument()
  })
})
