// The ladder has three outcomes in this footer, not two: `write` keeps Edit but must not offer
// Delete, which the node guards at `admin`.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { SheetLifecycleFooter } from '@/components/entity-sheet/sheet-lifecycle-footer'
import { canDelete, canEdit } from '@/components/entity-list/permission'
import type { Permission } from '@/components/entity-list/permission'

const renderFor = (permission?: Permission, isDeleted = false) =>
  render(
    <SheetLifecycleFooter
      editing={false}
      isCreate={false}
      isDeleted={isDeleted}
      isDirty={false}
      isSubmitting={false}
      lifecycleBusy={false}
      canEdit={canEdit(permission)}
      canDelete={canDelete(permission)}
      entityName="Wall A"
      onEdit={vi.fn()}
      onCancel={vi.fn()}
      onDelete={vi.fn()}
      onRestore={vi.fn()}
    />
  )

const editButton = () => screen.queryByRole('button', { name: 'common.edit' })
const deleteButton = () =>
  screen.queryByRole('button', { name: 'common.delete' })

describe('the sheet footer against the permission ladder', () => {
  it('offers a read-only viewer nothing, and says why', () => {
    renderFor('read')
    expect(editButton()).toBeNull()
    expect(deleteButton()).toBeNull()
    expect(screen.getByTestId('sheet-read-only')).toBeInTheDocument()
  })

  it('lets a write grantee edit but not delete', () => {
    renderFor('write')
    expect(editButton()).toBeInTheDocument()
    // Delete is guarded at `admin`; offering it here is the 403-on-click this gate exists to stop.
    expect(deleteButton()).toBeNull()
  })

  it('gives an admin grantee both', () => {
    renderFor('admin')
    expect(editButton()).toBeInTheDocument()
    expect(deleteButton()).toBeInTheDocument()
  })

  it('withholds restore from a write grantee, the same rung as delete', () => {
    renderFor('write', true)
    expect(screen.queryByTestId('sheet-restore')).toBeNull()
    expect(screen.getByTestId('sheet-read-only')).toBeInTheDocument()
  })

  it('offers restore to an admin grantee', () => {
    renderFor('admin', true)
    expect(screen.getByTestId('sheet-restore')).toBeInTheDocument()
  })

  it('stays fully enabled when the node sent no verdict', () => {
    renderFor(undefined)
    expect(editButton()).toBeInTheDocument()
    expect(deleteButton()).toBeInTheDocument()
  })
})
