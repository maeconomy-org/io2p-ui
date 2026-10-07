// Delete is non-cascading (D32/D74), so a live object legitimately keeps a link to a tombstoned
// parent. An unmarked chip reads as an ordinary parent — the flag has to reach the render.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({
    useList: () => ({ data: undefined, isFetching: false }),
  }),
}))

vi.mock('@/components/entity-list', () => ({ OwnerHint: () => null }))

import { ParentsField } from '@/components/entity-sheet/fields/parents-field'
import type { EntityDraft } from '@/lib/entity'

function Harness({
  deletedParentIds,
  editing = false,
  movable,
  parentIds = ['dead-1', 'live-1'],
}: {
  deletedParentIds?: Set<string>
  editing?: boolean
  movable?: boolean
  parentIds?: string[]
}) {
  const form = useForm<EntityDraft>({
    defaultValues: { parentIds } as EntityDraft,
  })
  return (
    <ParentsField
      form={form}
      editing={editing}
      parentNames={
        new Map([
          ['dead-1', 'Blok A'],
          ['live-1', 'Blok B'],
        ])
      }
      deletedParentIds={deletedParentIds}
      movable={movable}
    />
  )
}

describe('ParentsField deleted parents', () => {
  it('strikes through a deleted parent and marks it', () => {
    render(<Harness deletedParentIds={new Set(['dead-1'])} />)

    expect(screen.getByTestId('parent-deleted-dead-1')).toBeInTheDocument()
    expect(screen.getByTestId('parent-link-dead-1').className).toContain(
      'line-through'
    )
  })

  it('leaves a live parent alone', () => {
    render(<Harness deletedParentIds={new Set(['dead-1'])} />)

    expect(screen.queryByTestId('parent-deleted-live-1')).toBeNull()
    expect(screen.getByTestId('parent-link-live-1').className).not.toContain(
      'line-through'
    )
  })

  it('marks nothing when no parent is deleted', () => {
    render(<Harness />)

    expect(screen.queryByTestId('parent-deleted-dead-1')).toBeNull()
  })

  it('keeps a deleted parent removable while editing', () => {
    // Unlinking a tombstoned parent must stay possible — core keeps the existing edge, so the UI
    // is the only place to break it.
    render(<Harness deletedParentIds={new Set(['dead-1'])} editing />)

    expect(
      screen.getByRole('button', { name: /common.remove Blok A/ })
    ).toBeEnabled()
  })
})

describe('ParentsField for a viewer who may edit but not move', () => {
  it('offers no picker and no remove, and says why', () => {
    render(<Harness editing movable={false} />)

    expect(screen.queryByTestId('parent-picker')).toBeNull()
    expect(screen.queryByRole('button', { name: /common.remove/ })).toBeNull()
    expect(screen.getByTestId('parents-move-locked')).toHaveTextContent(
      'objects.detailsSheet.moveNeedsAdmin'
    )
  })

  it('keeps the parents as links', () => {
    render(<Harness editing movable={false} />)

    expect(screen.getByTestId('parent-link-live-1')).toBeInTheDocument()
  })

  it('says why even when the object has no parents', () => {
    render(<Harness editing movable={false} parentIds={[]} />)

    expect(screen.getByTestId('parents-empty')).toBeInTheDocument()
    expect(screen.getByTestId('parents-move-locked')).toBeInTheDocument()
  })

  it('offers the picker and remove to a viewer who may move', () => {
    render(<Harness editing movable />)

    expect(screen.getByTestId('parent-picker')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /common.remove Blok B/ })
    ).toBeEnabled()
    expect(screen.queryByTestId('parents-move-locked')).toBeNull()
  })

  it('shows no note outside edit mode', () => {
    render(<Harness movable={false} />)

    expect(screen.queryByTestId('parents-move-locked')).toBeNull()
  })
})
