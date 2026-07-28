import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SheetLifecycleFooter } from '@/components/entity-sheet/sheet-lifecycle-footer'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

function renderFooter(
  props: Partial<React.ComponentProps<typeof SheetLifecycleFooter>> = {}
) {
  const handlers = {
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onRestore: vi.fn(),
  }
  const view = render(
    <SheetLifecycleFooter
      editing={false}
      isCreate={false}
      isDeleted={false}
      isDirty={false}
      isSubmitting={false}
      lifecycleBusy={false}
      canDelete
      {...handlers}
      {...props}
    />
  )
  return { ...view, ...handlers }
}

describe('SheetLifecycleFooter', () => {
  it('offers Edit and Delete in view mode', () => {
    renderFooter()
    expect(screen.getByText('common.edit')).toBeInTheDocument()
    expect(screen.getByText('common.delete')).toBeInTheDocument()
    expect(screen.queryByText('common.save')).not.toBeInTheDocument()
  })

  it('hides Delete when the caller cannot delete', () => {
    renderFooter({ canDelete: false })
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  it('hides Delete on a create draft, which has nothing to delete yet', () => {
    renderFooter({ isCreate: true })
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument()
  })

  describe('two-step delete', () => {
    it('asks for confirmation before firing', () => {
      const { onDelete } = renderFooter()
      fireEvent.click(screen.getByText('common.delete'))
      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.getByText('common.confirm')).toBeInTheDocument()

      fireEvent.click(screen.getByText('common.confirm'))
      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    // A half-pressed delete that survived would fire on the next single click, in a sheet the user
    // may have reopened on a different entity.
    it('resets the confirmation on blur', () => {
      const { onDelete } = renderFooter()
      const button = screen.getByText('common.delete')
      fireEvent.click(button)
      fireEvent.blur(screen.getByText('common.confirm'))

      expect(screen.getByText('common.delete')).toBeInTheDocument()
      expect(onDelete).not.toHaveBeenCalled()
    })
  })

  describe('edit mode', () => {
    it('offers Cancel and a submit-type Save', () => {
      renderFooter({ editing: true, isDirty: true })
      expect(screen.getByText('common.cancel')).toBeInTheDocument()
      expect(screen.getByText('common.save').closest('button')).toHaveAttribute(
        'type',
        'submit'
      )
    })

    // Cancel sits inside the sheet's <form>; without an explicit type it would submit on click.
    it('gives every non-save button type="button"', () => {
      renderFooter({ editing: true, isDirty: true })
      expect(
        screen.getByText('common.cancel').closest('button')
      ).toHaveAttribute('type', 'button')
    })

    it('disables Save while clean and while submitting', () => {
      const clean = renderFooter({ editing: true, isDirty: false })
      expect(clean.getByText('common.save').closest('button')).toBeDisabled()
      clean.unmount()

      renderFooter({ editing: true, isDirty: true, isSubmitting: true })
      expect(screen.getByText('common.save').closest('button')).toBeDisabled()
    })
  })

  describe('a soft-deleted entity', () => {
    // Deleted entities are shown rather than hidden, but must be restored before they can be edited
    // — so Restore replaces the whole set instead of joining it.
    it('offers only Restore', () => {
      const { onRestore } = renderFooter({ isDeleted: true })
      expect(screen.queryByText('common.edit')).not.toBeInTheDocument()
      expect(screen.queryByText('common.delete')).not.toBeInTheDocument()

      fireEvent.click(screen.getByText('common.restore'))
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('disables Restore while a lifecycle call is in flight', () => {
      renderFooter({ isDeleted: true, lifecycleBusy: true })
      expect(
        screen.getByText('common.restore').closest('button')
      ).toBeDisabled()
    })
  })
})
